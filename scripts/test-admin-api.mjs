// 실제 관리자 API 클라이언트 → Express → SQLite 통합 검사.
// 실행: node scripts/test-admin-api.mjs (먼저 npm run setup:server)
// 운영 중인 API나 server/delivery.db를 사용하지 않는다. OS 임시 폴더에 별도 서버/DB를 만들고 지운다.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const serverSource = path.join(project, 'server');
const modulePath = path.join(serverSource, 'node_modules');
if (!existsSync(modulePath)) {
  console.error('서버 패키지가 없습니다. 프로젝트 루트에서 npm.cmd run setup:server 를 먼저 실행하세요.');
  process.exit(1);
}
const requireServer = createRequire(path.join(serverSource, 'package.json'));
const Database = requireServer('better-sqlite3');
const temporary = mkdtempSync(path.join(tmpdir(), 'delivery-admin-api-'));
const isolatedServer = path.join(temporary, 'server');
const nativeFetch = globalThis.fetch;
const previousEnv = {
  mock: process.env.NEXT_PUBLIC_USE_MOCK,
  base: process.env.NEXT_PUBLIC_API_BASE,
};
const cookies = new Map();
const origin = 'http://localhost:3000';
const coverage = new Set();
let apiBase;
let server;
let database;
let api;
let count = 0;
let current = 'setup';
let lastRequest = '';
let serverLog = '';

async function step(name, callback) {
  current = name;
  await callback();
  count += 1;
  console.log(`PASS ${String(count).padStart(2, '0')} ${name}`);
}

async function send(method, pathname, { as = 'admin', body, headers: inputHeaders } = {}) {
  const headers = new Headers(inputHeaders);
  headers.set('Origin', origin);
  if (cookies.has(as)) headers.set('Cookie', cookies.get(as));
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  lastRequest = `${method} ${pathname}`;
  const response = await nativeFetch(new URL(pathname, apiBase), {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    redirect: 'manual',
  });
  captureCookie(response, as);
  assert.equal(response.headers.get('access-control-allow-origin'), origin, 'credentialed CORS origin');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true', 'credentialed CORS flag');
  return { response, json: response.status === 204 ? null : await response.json() };
}

function captureCookie(response, as) {
  for (const value of response.headers.getSetCookie()) {
    const match = value.match(/^(delivery_session)=([^;]*)/);
    if (!match) continue;
    if (match[2]) cookies.set(as, match[0]);
    else cookies.delete(as);
  }
}

function success(result, status = 200) {
  assert.equal(result.response.status, status, JSON.stringify(result.json));
  assert.equal(result.json.success, true);
  return result.json.data;
}

async function expectFailure(action, status, code, field) {
  await assert.rejects(action, (error) => {
    assert.equal(error.status, status, error.message);
    assert.equal(error.code, code, error.message);
    if (field) assert.ok(error.fields?.[field], `field error: ${field}`);
    return true;
  });
}

// Node fetch에는 브라우저 쿠키 저장소가 없다. 쿠키 저장/전송만 보완하고 실제 fetch와 API 응답은 그대로 사용한다.
async function browserFetch(url, options = {}) {
  assert.equal(options.credentials, 'include', 'the frontend must include session cookies');
  const requestUrl = new URL(url);
  assert.equal(requestUrl.origin, apiBase, 'the frontend uses the configured API server');
  assert.ok(requestUrl.pathname.startsWith('/api/'), 'exactly one /api prefix');
  const headers = new Headers(options.headers);
  headers.set('Origin', origin);
  if (cookies.has('admin')) headers.set('Cookie', cookies.get('admin'));
  const method = options.method ?? 'GET';
  lastRequest = `${method} ${requestUrl.pathname}${requestUrl.search}`;
  coverage.add(`${method} ${requestUrl.pathname.replace(/\/\d+(?=\/|$)/g, '/{id}')}`);
  const response = await nativeFetch(url, { ...options, headers, signal: AbortSignal.timeout(15000) });
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  captureCookie(response, 'admin');
  return response;
}

async function startIsolatedServer() {
  mkdirSync(isolatedServer);
  for (const name of ['src', 'db', 'package.json']) cpSync(path.join(serverSource, name), path.join(isolatedServer, name), { recursive: true });
  mkdirSync(path.join(isolatedServer, 'scripts'));
  cpSync(path.join(serverSource, 'scripts', 'init-db.mjs'), path.join(isolatedServer, 'scripts', 'init-db.mjs'));
  symlinkSync(modulePath, path.join(isolatedServer, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const environment = { ...process.env, TZ: 'Asia/Seoul', NODE_ENV: 'development', CORS_ORIGINS: origin, SESSION_SECRET: randomBytes(32).toString('hex') };
  const init = spawnSync(process.execPath, ['scripts/init-db.mjs'], { cwd: isolatedServer, env: environment, encoding: 'utf8' });
  assert.equal(init.status, 0, `temporary DB initialization failed\n${init.stdout}\n${init.stderr}`);
  database = new Database(path.join(isolatedServer, 'delivery.db'));
  database.pragma('foreign_keys = ON');
  // 임시 서버만 무작위 빈 포트에 바인딩한다. 원본 시작 코드/설정은 바꾸지 않는다.
  const runner = path.join(isolatedServer, 'admin-test-server.mjs');
  writeFileSync(runner, `import { app } from './src/app.js';\nconst server = app.listen(0, '127.0.0.1', () => console.log('ADMIN_TEST_PORT=' + server.address().port));\nprocess.on('SIGTERM', () => server.close(() => process.exit(0)));\n`);
  server = spawn(process.execPath, [runner], { cwd: isolatedServer, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  apiBase = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`API startup timed out\n${serverLog}`)), 15000);
    const collect = (chunk) => {
      serverLog = (serverLog + chunk.toString()).slice(-12000);
      const found = serverLog.match(/ADMIN_TEST_PORT=(\d+)/);
      if (found) { clearTimeout(timer); resolve(`http://127.0.0.1:${found[1]}`); }
    };
    server.stdout.on('data', collect);
    server.stderr.on('data', collect);
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`API exited (${code})\n${serverLog}`)); });
  });
  process.env.NEXT_PUBLIC_USE_MOCK = 'false';
  process.env.NEXT_PUBLIC_API_BASE = apiBase;
  globalThis.fetch = browserFetch;
  // 실제 화면에서 쓰는 클라이언트를 그대로 import한다. 가짜 API로 교체하지 않는다.
  api = await import(pathToFileURL(path.join(project, 'lib', 'admin', 'api.js')).href);
  assert.equal(api.USE_MOCK, false);
}

async function main() {
  await startIsolatedServer();
  await step('A-03 / X-00: unauthenticated requests return 401', async () => {
    await expectFailure(() => api.getMe(), 401, 'UNAUTHORIZED');
    await expectFailure(() => api.getSummary(), 401, 'UNAUTHORIZED');
  });
  await step('A-01: incorrect password returns LOGIN_FAILED', async () => {
    await expectFailure(() => api.login('admin@test.com', 'not-the-password'), 401, 'LOGIN_FAILED');
  });
  await step('A-01 / A-03: real administrator session is preserved', async () => {
    const me = await api.login('admin@test.com', 'test1234');
    assert.equal(me.role, 'ADMIN');
    assert.equal(me.memberId, 1);
    assert.ok(cookies.get('admin'));
    assert.deepEqual(await api.getMe(), me);
  });
  await step('CORS: JSON request preflight allows the frontend origin', async () => {
    const { response } = await send('OPTIONS', '/api/admin/restrictions', {
      headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/i);
  });
  await step('ADMIN permission: owner session returns 403 through the same client', async () => {
    const saved = cookies.get('admin');
    const owner = await api.login('owner1@test.com', 'test1234');
    assert.equal(owner.role, 'OWNER');
    cookies.set('owner1', cookies.get('admin'));
    await expectFailure(() => api.getSummary(), 403, 'FORBIDDEN');
    cookies.set('admin', saved);
    success(await send('POST', '/api/auth/login', { as: 'owner2', body: { email: 'owner2@test.com', password: 'test1234' } }));
  });
  await step('X-00: dashboard counts reflect database records', async () => {
    const summary = await api.getSummary();
    assert.equal(summary.pendingApplications, database.prepare("SELECT count(*) AS n FROM TB_STORE_APRV WHERE STORE_APRV_STTS='PENDING'").get().n);
    assert.equal(summary.pendingReports, database.prepare("SELECT count(*) AS n FROM TB_RVW_RPT WHERE RVW_RPT_STTS='PENDING'").get().n);
    assert.equal(summary.activeRestrictions, 1);
  });
  let application;
  await step('X-01 / X-02: list and detailed application contract', async () => {
    const rows = await api.getApplications({ status: 'PENDING' });
    assert.ok(Array.isArray(rows) && rows.length > 0);
    application = rows.find((row) => row.storeId === 4);
    assert.ok(application);
    const detail = await api.getApplication(application.applicationId);
    assert.equal(detail.approvalStatus, 'PENDING');
    assert.equal(detail.ownerEmail, 'owner1@test.com');
    assert.ok(Array.isArray(detail.hours) && Array.isArray(detail.history));
  });
  await step('X-03: approval changes both tables and the owner view', async () => {
    assert.equal((await api.approveApplication(application.applicationId)).status, 'APPROVED');
    const ownerStore = success(await send('GET', '/api/owner/stores/4', { as: 'owner1' }));
    assert.equal(ownerStore.approvalStatus, 'APPROVED');
    assert.equal(ownerStore.operStatus, 'PAUSED');
    assert.equal(database.prepare('SELECT STORE_APRV_STTS AS status FROM TB_STORE_APRV WHERE STORE_APRV_ID=?').get(application.applicationId).status, 'APPROVED');
    assert.equal(database.prepare('SELECT STORE_APRV_STTS AS status FROM TB_STORE WHERE STORE_ID=4').get().status, 'APPROVED');
    assert.ok(!(await api.getApplications({ status: 'PENDING' })).some((row) => row.applicationId === application.applicationId));
    assert.ok((await api.getApplications({ status: 'APPROVED' })).some((row) => row.applicationId === application.applicationId));
    await expectFailure(() => api.approveApplication(application.applicationId), 409, 'ALREADY_PROCESSED');
  });
  await step('X-04: reject an owner reapplication and retain earlier history', async () => {
    const store = success(await send('GET', '/api/owner/stores/5', { as: 'owner2' }));
    const payload = { ...store, description: store.description ?? '', addressDetail: store.addressDetail ?? '', hours: [{ dayOfWeek: 1, open: '09:00', close: '21:00' }] };
    success(await send('PUT', '/api/owner/stores/5/application', { as: 'owner2', body: payload }));
    const entry = (await api.getApplications({ status: 'PENDING' })).find((row) => row.storeId === 5);
    assert.equal(entry.isReapply, true);
    assert.ok((await api.getApplication(entry.applicationId)).history.some((row) => row.status === 'REJECTED'));
    await expectFailure(() => api.rejectApplication(entry.applicationId, ''), 400, 'VALIDATION_ERROR', 'rejectReason');
    assert.equal((await api.rejectApplication(entry.applicationId, '주소 확인 후 다시 신청해 주세요.')).status, 'REJECTED');
    assert.equal(success(await send('GET', '/api/owner/stores/5', { as: 'owner2' })).approvalStatus, 'REJECTED');
    const persisted = database.prepare('SELECT STORE_APRV_STTS AS status, RJCT_RSN_CN AS reason FROM TB_STORE_APRV WHERE STORE_APRV_ID=?').get(entry.applicationId);
    assert.equal(persisted.status, 'REJECTED');
    assert.equal(persisted.reason, '주소 확인 후 다시 신청해 주세요.');
  });
  let report;
  await step('X-05 / X-06: report list, review, order and writer', async () => {
    const reports = await api.getReports({ status: 'PENDING' });
    assert.ok(Array.isArray(reports));
    report = await api.getReport(reports[0].reportId);
    assert.equal(report.status, 'PENDING');
    assert.equal(report.order.status, 'DONE');
    assert.equal(typeof report.order.menus, 'string');
    assert.equal(report.review.hidden, false);
    assert.equal(report.writer.restricted, false);
  });
  await step('X-07: accepted report hides the review and restricts its writer', async () => {
    const result = await api.processReport(report.reportId, { decision: 'ACCEPTED', note: '신고 내용 확인 후 작성 제한.', restrictWriter: true });
    assert.equal(result.status, 'ACCEPTED');
    assert.equal(result.reviewHidden, true);
    assert.equal(result.writerRestricted, true);
    assert.equal(database.prepare('SELECT RVW_HDN_YN AS hidden FROM TB_RVW WHERE RVW_ID=?').get(report.review.reviewId).hidden, 'Y');
    assert.equal((await api.getReport(report.reportId)).writer.restricted, true);
    await expectFailure(() => api.processReport(report.reportId, { decision: 'ACCEPTED', note: '중복 처리', restrictWriter: true }), 409, 'ALREADY_PROCESSED');
    assert.equal(database.prepare('SELECT count(*) AS n FROM TB_MBR_RSTR WHERE RVW_RPT_ID=?').get(report.reportId).n, 1);
  });
  await step('X-07: rejected report preserves a nullable review without restrictions', async () => {
    const created = success(await send('POST', '/api/owner/stores/2/reviews/2/report', { as: 'owner2', body: { reason: 'ETC', content: '작성 내용 확인을 요청합니다.' } }), 201);
    assert.equal((await api.getReport(created.reportId)).review.content, null);
    await expectFailure(() => api.processReport(created.reportId, { decision: 'REJECTED', note: '확인 완료', restrictWriter: true }), 400, 'VALIDATION_ERROR', 'restrictWriter');
    const result = await api.processReport(created.reportId, { decision: 'REJECTED', note: '문제가 없는 리뷰로 확인했습니다.', restrictWriter: false });
    assert.equal(result.reviewHidden, false);
    assert.equal(result.writerRestricted, false);
    assert.ok((await api.getReports({ status: 'REJECTED' })).some((row) => row.reportId === created.reportId));
  });
  await step('X-08 / X-09 / X-10: create, duplicate prevention, release and full history', async () => {
    const created = await api.createRestriction({ memberId: 12, reason: '관리자 통합 테스트 제한' });
    assert.equal(created.memberId, 12);
    assert.ok((await api.getRestrictions({ active: true })).some((row) => row.restrictionId === created.restrictionId));
    await expectFailure(() => api.createRestriction({ memberId: 12, reason: '중복 제한' }), 409, 'ALREADY_RESTRICTED');
    const released = await api.releaseRestriction(created.restrictionId);
    assert.ok(released.endedAt);
    assert.ok(!(await api.getRestrictions({ active: true })).some((row) => row.restrictionId === created.restrictionId));
    const history = await api.getRestrictions({ active: false });
    assert.ok(history.some((row) => row.restrictionId === created.restrictionId && row.endedAt));
    assert.ok(history.some((row) => row.restrictionId === 2));
    await expectFailure(() => api.releaseRestriction(created.restrictionId), 409, 'ALREADY_RELEASED');
    await expectFailure(() => api.createRestriction({ memberId: 2, reason: '사장 제한 불가' }), 400, 'NOT_CUSTOMER');
  });
  await step('X-14: member lookup, role filter and administrator exclusion', async () => {
    const members = await api.searchMembers('@test.com');
    assert.ok(members.length > 0 && members.every((member) => member.role !== 'ADMIN'));
    const customers = await api.searchMembers('customer', 'CUSTOMER');
    assert.ok(customers.every((member) => member.role === 'CUSTOMER'));
    assert.ok(customers.some((member) => member.memberId === report.writer.memberId && member.restricted));
    assert.equal((await api.searchMembers('owner1@test.com', 'OWNER'))[0].memberId, 2);
  });
  let order;
  await step('X-11 / X-12: real order snapshots and cancellation eligibility', async () => {
    const orders = await api.searchOrders('6');
    assert.ok(orders.some((item) => item.orderId === 6));
    order = await api.getOrder(6);
    assert.equal(order.status, 'DELIVERING');
    assert.equal(order.canCancel, true);
    assert.equal(order.payMethod, 'POINT');
    assert.ok(order.store.storeName && order.store.telNo && order.customer.email);
    assert.ok(order.items[0].options.every((option) => typeof option.price === 'number'));
    assert.ok(order.timeline.pickedUpAt);
    assert.equal(order.timeline.deliveredAt, null);
    const emailMatches = await api.searchOrders(order.customer.email);
    assert.ok(emailMatches.some((item) => item.orderId === order.orderId));
    const telephoneMatches = await api.searchOrders(order.customer.tel);
    assert.ok(telephoneMatches.some((item) => item.orderId === order.orderId));
  });
  await step('X-13: ETC detail validation leaves the order unchanged', async () => {
    await expectFailure(() => api.cancelOrder(order.orderId, { reason: 'ETC', counselNote: '상담 메모만 입력' }), 400, 'VALIDATION_ERROR', 'reasonDetail');
    assert.equal((await api.getOrder(order.orderId)).status, 'DELIVERING');
  });
  await step('X-13: POINT cancellation persists detail, refunds once and releases the rider', async () => {
    const memberId = order.customer.memberId;
    const balanceBefore = database.prepare('SELECT PNT_BAL_AMT AS balance FROM TB_MBR WHERE MBR_ID=?').get(memberId).balance;
    const deliveryBefore = database.prepare('SELECT RIDER_MBR_ID AS riderId, DLVR_CMPL_DTTM AS completedAt FROM TB_DLVR WHERE ORD_ID=?').get(order.orderId);
    const reasonDetail = '고객과 확인한 기타 취소 사유';
    const counselNote = '연락 후 취소 및 포인트 환불 동의 확인';
    const result = await api.cancelOrder(order.orderId, { reason: 'ETC', reasonDetail, counselNote });
    assert.equal(result.status, 'CANCEL');
    assert.equal(result.refunded, true);
    const detail = await api.getOrder(order.orderId);
    assert.equal(detail.cancelReasonDetail, reasonDetail);
    assert.equal(detail.counselNote, counselNote);
    assert.equal(detail.cancelProcessor.memberId, 1);
    assert.equal(detail.cancelActor, 'ADMIN');
    assert.equal(detail.canCancel, false);
    assert.equal(detail.timeline.deliveredAt, null);
    assert.equal(database.prepare('SELECT PAY_STTS AS status FROM TB_PAY WHERE ORD_ID=?').get(order.orderId).status, 'CANCELED');
    assert.equal(database.prepare('SELECT PNT_BAL_AMT AS balance FROM TB_MBR WHERE MBR_ID=?').get(memberId).balance, balanceBefore + order.payAmount);
    assert.equal(database.prepare("SELECT count(*) AS n FROM TB_PNT_TXN WHERE ORD_ID=? AND PNT_TXN_TYPE_CD='REFUND'").get(order.orderId).n, 1);
    assert.equal(database.prepare('SELECT RIDER_STTS AS status FROM TB_RIDER WHERE MBR_ID=?').get(deliveryBefore.riderId).status, 'IDLE');
    assert.equal(success(await send('GET', '/api/owner/stores/1/orders/6', { as: 'owner1' })).status, 'CANCEL');
    await expectFailure(() => api.cancelOrder(order.orderId, { reason: 'ETC', reasonDetail, counselNote }), 409, 'ORDER_ALREADY_PROCESSED');
    assert.equal(database.prepare('SELECT PNT_BAL_AMT AS balance FROM TB_MBR WHERE MBR_ID=?').get(memberId).balance, balanceBefore + order.payAmount);
    assert.equal(database.prepare("SELECT count(*) AS n FROM TB_PNT_TXN WHERE ORD_ID=? AND PNT_TXN_TYPE_CD='REFUND'").get(order.orderId).n, 1);
  });
  await step('X-13: WAIT, COOKING and READY may cancel; DONE may not', async () => {
    for (const [orderId, state] of [[1, 'WAIT'], [4, 'COOKING'], [5, 'READY']]) {
      assert.equal((await api.getOrder(orderId)).status, state);
      assert.equal((await api.cancelOrder(orderId, { reason: 'CUSTOMER_REQUEST', counselNote: `${state} 상태 취소 확인` })).status, 'CANCEL');
    }
    await expectFailure(() => api.cancelOrder(7, { reason: 'CUSTOMER_REQUEST', counselNote: '완료 주문 취소 불가' }), 409, 'ORDER_ALREADY_PROCESSED');
    assert.equal((await api.getOrder(7)).status, 'DONE');
  });
  await step('A-02 / A-03: logout removes the session and requires login again', async () => {
    await api.logout();
    assert.ok(!cookies.has('admin'));
    await expectFailure(() => api.getMe(), 401, 'UNAUTHORIZED');
  });
  await step('A-01..A-03 / X-00..X-14: every frontend endpoint used real HTTP', async () => {
    const expected = [
      'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me',
      'GET /api/admin/summary', 'GET /api/admin/store-applications',
      'GET /api/admin/store-applications/{id}', 'POST /api/admin/store-applications/{id}/approve',
      'POST /api/admin/store-applications/{id}/reject', 'GET /api/admin/review-reports',
      'GET /api/admin/review-reports/{id}', 'POST /api/admin/review-reports/{id}/process',
      'GET /api/admin/restrictions', 'POST /api/admin/restrictions',
      'POST /api/admin/restrictions/{id}/release', 'GET /api/admin/orders',
      'GET /api/admin/orders/{id}', 'POST /api/admin/orders/{id}/cancel', 'GET /api/admin/members',
    ];
    for (const endpoint of expected) assert.ok(coverage.has(endpoint), `missing endpoint: ${endpoint}`);
    assert.equal(database.pragma('foreign_key_check').length, 0);
  });
  console.log(`\n${count} groups passed; all 18 administrator/auth client endpoints reached real Express + SQLite.`);
  console.log('Only the disposable temporary database was initialized and changed.');
}

try {
  await main();
} catch (error) {
  console.error(`\nFAIL: ${current}\nLast request: ${lastRequest}\n${error.stack ?? error}`);
  if (serverLog) console.error(`Server log:\n${serverLog}`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = nativeFetch;
  if (previousEnv.mock === undefined) delete process.env.NEXT_PUBLIC_USE_MOCK;
  else process.env.NEXT_PUBLIC_USE_MOCK = previousEnv.mock;
  if (previousEnv.base === undefined) delete process.env.NEXT_PUBLIC_API_BASE;
  else process.env.NEXT_PUBLIC_API_BASE = previousEnv.base;
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    const force = setTimeout(() => server.kill('SIGKILL'), 5000);
    await stopped;
    clearTimeout(force);
  }
  database?.close();
  rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
