// Dependency-free administrator contract tests. Run: node scripts/test-admin-mock.mjs
// Uses isolated temporary files and browser storage doubles. Never opens SQLite.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-main-test-'));
const storage = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k), clear: () => values.clear() };
};
globalThis.window = { localStorage: storage(), sessionStorage: storage(), dispatchEvent: () => {} };
window.localStorage.setItem('owner-mock-db-v1', 'OWNER_DATA_MUST_STAY_UNCHANGED');
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS ' + name); }

try {
  fs.cpSync(path.join(root,'lib/admin'), path.join(temp,'lib/admin'), {recursive:true});
  fs.writeFileSync(path.join(temp,'package.json'), '{"type":"module"}');
  function rewrite(dir) {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir,name);
      if (fs.statSync(file).isDirectory()) rewrite(file);
      else if (file.endsWith('.js')) fs.writeFileSync(file, fs.readFileSync(file,'utf8').replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_,a,b,c) => a + (b.endsWith('.js') ? b : b+'.js') + c));
    }
  }
  rewrite(path.join(temp,'lib'));
  const { adminMockRequest: request, resetAdminDemo } = await import(pathToFileURL(path.join(temp,'lib/admin/mock/server.js')));
  const { ADMIN_DEMO_STORAGE_KEY: key, withAdminMockDatabase } = await import(pathToFileURL(path.join(temp,'lib/admin/mock/storage.js')));
  const getDb = () => JSON.parse(window.localStorage.getItem(key));
  const changeDb = fn => { const d=getDb(); fn(d); window.localStorage.setItem(key,JSON.stringify(d)); };
  const call = async(method,url,body,expected=200) => {
    const res=await request(method,url,body);
    assert.equal(res.status,expected,`${method} ${url}: ${JSON.stringify(res.json)}`);
    return res.json.data;
  };
  await test('A-03 / unauthenticated access is rejected', () => call('GET','/auth/me',undefined,401));
  await test('A-01 / invalid credentials are rejected', () => call('POST','/auth/login',{email:'admin@test.com',password:'wrong'},401));
  await test('Authorization / non-admin member cannot access admin routes', async() => {
    await call('POST','/auth/login',{email:'owner@test.com',password:'test1234'});
    await call('GET','/admin/summary',undefined,403);
    await call('POST','/auth/logout');
  });
  await test('A-01 A-03 / administrator login and session', async() => {
    const me=await call('POST','/auth/login',{email:'admin@test.com',password:'test1234'});
    assert.equal(me.role,'ADMIN'); assert.equal((await call('GET','/auth/me')).memberId,me.memberId);
  });
  await test('X-00 / dashboard summary', async() => {
    const s=await call('GET','/admin/summary');
    assert.equal(s.pendingApplications,3); assert(s.pendingReports>0); assert.equal(s.activeRestrictions,2);
  });
  let pending, first;
  await test('X-01 / application list, ordering, paging and status validation',async()=>{
    pending=await call('GET','/admin/store-applications?status=PENDING'); first=pending[0];
    assert.equal(pending.length,3); assert(pending[0].appliedAt<=pending[1].appliedAt);
    const page=await call('GET','/admin/store-applications?status=PENDING&page=1&size=2'); assert.equal(page.items.length,2); assert.equal(page.totalCount,3);
    await call('GET','/admin/store-applications?status=INVALID',undefined,400);
  });
  await test('X-02 / full application details and hours',async()=>{
    const d=await call('GET',`/admin/store-applications/${first.applicationId}`);
    assert(d.ownerEmail);assert(d.hours.length);assert(Array.isArray(d.history));
    await call('GET','/admin/store-applications/no-id',undefined,400);
  });
  await test('X-03 / approval updates application and current store status',async()=>{
    await call('POST',`/admin/store-applications/${first.applicationId}/approve`);
    const d=getDb(); assert.equal(d.adminApplications.find(a=>a.applicationId===first.applicationId).status,'APPROVED');
    const store=d.stores.find(s=>s.storeId===first.storeId);assert.equal(store.approvalStatus,'APPROVED');assert.equal(store.operStored,'PAUSED');
    await call('POST',`/admin/store-applications/${first.applicationId}/approve`,undefined,409);
  });
  await test('X-04 / rejection reason is required; invalid write leaves state intact',async()=>{
    const id=pending[1].applicationId;
    await call('POST',`/admin/store-applications/${id}/reject`,{rejectReason:' '},400);
    assert.equal(getDb().adminApplications.find(a=>a.applicationId===id).status,'PENDING');
    await call('POST',`/admin/store-applications/${id}/reject`,{rejectReason:'Business number needs correction.'});
    assert.equal(getDb().stores.find(s=>s.storeId===pending[1].storeId).approvalStatus,'REJECTED');
  });
  let report;
  await test('X-05 X-06 / reported review and linked order/writer',async()=>{
    const list=await call('GET','/admin/review-reports?status=PENDING'); report=list[0];
    const d=await call('GET',`/admin/review-reports/${report.reportId}`);assert(d.writer.memberId);assert(d.order.orderId);assert(d.review.reviewId);
  });
  await test('X-07 / rejecting a report cannot restrict its author',async()=>{
    await call('POST',`/admin/review-reports/${report.reportId}/process`,{decision:'REJECTED',note:'Not valid.',restrictWriter:true},400);
    assert.equal(getDb().reports.find(r=>r.reportId===report.reportId).status,'PENDING');
  });
  await test('X-07 / accepted report hides review and creates restriction',async()=>{
    const d=await call('POST',`/admin/review-reports/${report.reportId}/process`,{decision:'ACCEPTED',note:'Confirmed policy violation.',restrictWriter:true});
    assert.equal(d.reviewHidden,true);assert.equal(d.writerRestricted,true);
    await call('POST',`/admin/review-reports/${report.reportId}/process`,{decision:'ACCEPTED',note:'Repeat'},409);
  });
  await test('X-14 / member search excludes administrators',async()=>{
    await call('GET','/admin/members',undefined,400);
    const list=await call('GET','/admin/members?keyword=customer&role=CUSTOMER');assert(list.length>=5);assert(list.every(u=>u.role==='CUSTOMER'));
    assert((await call('GET','/admin/members?keyword=test')).every(u=>u.role!=='ADMIN'));
  });
  let freeUser, restriction;
  await test('X-09 / customer-only restriction and duplicate protection',async()=>{
    await call('POST','/admin/restrictions',{memberId:3,reason:'Test'},400);
    freeUser=getDb().users.find(u=>u.role==='CUSTOMER'&&!getDb().adminRestrictions.some(r=>r.memberId===u.memberId&&!r.endedAt));
    restriction=await call('POST','/admin/restrictions',{memberId:freeUser.memberId,reason:'Repeated violation.'},201);
    await call('POST','/admin/restrictions',{memberId:freeUser.memberId,reason:'Repeat'},409);
  });
  await test('X-08 X-10 / active list, release and release conflict',async()=>{
    assert((await call('GET','/admin/restrictions?active=true')).some(r=>r.restrictionId===restriction.restrictionId));
    await call('POST',`/admin/restrictions/${restriction.restrictionId}/release`);
    await call('POST',`/admin/restrictions/${restriction.restrictionId}/release`,undefined,409);
    assert(!(await call('GET','/admin/restrictions?active=true')).some(r=>r.restrictionId===restriction.restrictionId));
  });
  await test('X-11 X-12 / order lookup and amount consistency',async()=>{
    const rows=await call('GET','/admin/orders?keyword=customer1%40example.test');assert(rows.length>0&&rows.length<=50);
    const d=await call('GET',`/admin/orders/${rows[0].orderId}`);
    assert.equal(d.payAmount,d.items.reduce((sum,item)=>sum+item.lineTotal,0)+d.deliveryTip);assert(d.timeline);
    await call('GET','/admin/orders?keyword=bad',undefined,400);await call('GET','/admin/orders/99999999',undefined,404);
  });
  await test('X-13 / completed orders cannot be canceled',async()=>{
    const done=getDb().orders.find(o=>o.status==='DONE');
    await call('POST',`/admin/orders/${done.orderId}/cancel`,{reason:'ETC',counselNote:'Test'},409);
  });
  await test('X-13 / cancellation and one-time point refund',async()=>{
    let id;
    changeDb(db=>{const template=db.orders.find(o=>o.status==='COOKING');const o={...structuredClone(template),orderId:++db.seq.order,customerId:freeUser.memberId,payMethod:'POINT',status:'COOKING'};id=o.orderId;db.orders.push(o);});
    const balance=getDb().users.find(u=>u.memberId===freeUser.memberId).pointBalance;
    const details=await call('GET',`/admin/orders/${id}`);
    await call('POST',`/admin/orders/${id}/cancel`,{reason:'ETC',counselNote:' '},400);
    assert.equal(getDb().orders.find(o=>o.orderId===id).status,'COOKING');
    await call('POST',`/admin/orders/${id}/cancel`,{reason:'CUSTOMER_REQUEST',counselNote:'Customer request confirmed.'});
    assert.equal(getDb().users.find(u=>u.memberId===freeUser.memberId).pointBalance,balance+details.payAmount);
    assert.equal(getDb().pointTransactions.filter(t=>t.orderId===id).length,1);
    await call('POST',`/admin/orders/${id}/cancel`,{reason:'ETC',counselNote:'Repeat'},409);
    assert.equal(getDb().pointTransactions.filter(t=>t.orderId===id).length,1);
  });
  await test('Mock storage / failed transaction rolls back',async()=>{
    const before=JSON.stringify(getDb());
    assert.throws(()=>withAdminMockDatabase(db=>{db.stores[0].storeName='SHOULD_NOT_PERSIST';throw new Error('test rollback');}));
    assert.equal(JSON.stringify(getDb()),before);
  });
  await test('Mock isolation / owner storage is never accessed or overwritten',async()=>{
    assert.equal(window.localStorage.getItem('owner-mock-db-v1'),'OWNER_DATA_MUST_STAY_UNCHANGED');
  });
  await test('A-02 / logout invalidates admin session',async()=>{await call('POST','/auth/logout');await call('GET','/admin/summary',undefined,401);});
  await test('Demo reset / administrator data only',async()=>{
    resetAdminDemo();await call('POST','/auth/login',{email:'admin@test.com',password:'test1234'});
    assert.equal((await call('GET','/admin/summary')).pendingApplications,3);
    assert.equal(window.localStorage.getItem('owner-mock-db-v1'),'OWNER_DATA_MUST_STAY_UNCHANGED');
  });
  process.env.NEXT_PUBLIC_USE_MOCK='false';
  const requests=[];
  globalThis.fetch=async(url,opts)=>{requests.push({url,...opts});return{status:200,json:async()=>({success:true,data:[]})};};
  const api=await import(pathToFileURL(path.join(temp,'lib/admin/api.js')));
  await test('Real-mode client / X-00 through X-14 paths, payloads and credentials',async()=>{
    await api.getSummary();await api.getApplications({status:'PENDING'});await api.getApplication(41);await api.approveApplication(41);await api.rejectApplication(41,'Reason');
    await api.getReports({status:'PENDING'});await api.getReport(80);await api.processReport(80,{decision:'REJECTED',note:'Note',restrictWriter:false});
    await api.getRestrictions({active:true});await api.createRestriction({memberId:7,reason:'Reason'});await api.releaseRestriction(12);
    await api.searchOrders('3021');await api.getOrder(3021);await api.cancelOrder(3021,{reason:'ETC',counselNote:'Note'});await api.searchMembers('kim','CUSTOMER');
    assert.equal(requests.length,15);assert(requests.every(r=>r.credentials==='include'&&r.url.startsWith('/api/admin/')));
    assert.equal(requests[13].method,'POST');assert.deepEqual(JSON.parse(requests[13].body),{reason:'ETC',counselNote:'Note'});
  });
  await test('Real-mode client / HTTP conflicts are not reported as success',async()=>{
    globalThis.fetch=async()=>({status:409,json:async()=>({success:false,error:{code:'ALREADY_PROCESSED',message:'Already processed'}})});
    await assert.rejects(()=>api.approveApplication(41),e=>e.status===409&&e.code==='ALREADY_PROCESSED');
  });
  console.log(`\n${passed} test groups passed. No real backend or Next.js build was executed.`);
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
