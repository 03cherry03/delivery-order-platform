// Administrator-only browser mock. Independent from every other feature branch.
// No real API, credentials, payment, or SQLite transaction is implemented here.
import { withAdminMockDatabase, resetMockDatabase } from './storage';
import { L } from '../labels';
import { toKST, isCancelable, isActiveRestriction } from '../format';
const SESSION='delivery-admin-main-session-v1';
let memorySession=null;
const ok=(data,status=200)=>({status,json:{success:true,data}});
class MockError extends Error {constructor(status,code,message,fields){super(message);Object.assign(this,{status,code,fields});}}
const fail=(status,code,message,fields)=>{throw new MockError(status,code,message,fields);};
const blank=(v)=>typeof v!=='string'||!v.trim();
function text(value,field,max=300){if(blank(value)||value.trim().length>max)fail(400,'VALIDATION_ERROR',L.inputRequired,{[field]:blank(value)?L.inputRequired:L.tooLong});return value.trim();}
const nextId=(db,key)=>{db.seq[key]=(db.seq[key]||0)+1;return db.seq[key];};
function session(value){
 if(arguments.length){memorySession=value;try{if(value===null)window.sessionStorage.removeItem(SESSION);else window.sessionStorage.setItem(SESSION,String(value));}catch{}return value;}
 try{const value=window.sessionStorage.getItem(SESSION);return value?Number(value):memorySession;}catch{return memorySession;}
}
const publicMember=(u)=>({memberId:u.memberId,name:u.name,role:u.role});
const total=(o)=>o.items.reduce((sum,it)=>sum+(it.unitPrice+(it.options||[]).reduce((n,x)=>n+x.price,0))*it.quantity,0);
const active=(db,memberId)=>db.adminRestrictions.some((r)=>r.memberId===memberId&&isActiveRestriction(r));
const hiddenCount=(db,memberId)=>db.reviews.filter((r)=>r.writerMemberId===memberId&&r.hidden&&!r.del).length;
function currentUser(db){const u=db.users.find((u)=>u.memberId===session()&&u.status==='ACTIVE');if(!u)fail(401,'UNAUTHORIZED',L.loginHint);return u;}
function find(list,key,id){const item=list.find((r)=>r[key]===id);if(!item)fail(404,'NOT_FOUND',L.notFound);return item;}
function numeric(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)fail(400,'VALIDATION_ERROR','Invalid ID');return n;}
function page(list,q){if(!q.has('page')&&!q.has('size'))return list;const p=Math.max(1,Number(q.get('page'))||1),size=Math.min(100,Math.max(1,Number(q.get('size'))||20));return{items:list.slice((p-1)*size,p*size),page:p,size,totalCount:list.length};}
function syncApplications(db,now){
 db.adminApplications ||= [];
 for(const s of db.stores.filter((s)=>!s.del)){
  const latest=db.adminApplications.filter((a)=>a.storeId===s.storeId).sort((a,b)=>b.applicationId-a.applicationId)[0];
  if(!latest||(s.approvalStatus==='PENDING'&&latest.status!=='PENDING')){
   db.adminApplications.push({applicationId:nextId(db,'application'),storeId:s.storeId,status:s.approvalStatus,appliedAt:latest?now:now-(60+s.storeId)*60000,processedAt:s.approvalStatus==='PENDING'?null:now-30*60000,rejectReason:s.rejectReason||null,processorId:null});
  }
 }
}
function ensureDemo(db){
 const now=Date.now();
 db.adminRestrictions ||= [];
 db.pointTransactions ||= [];
 if(!db.adminDemoVersion){
  const addUser=(data)=>{const u={memberId:nextId(db,'member'),status:'ACTIVE',joinedAt:now-15*86400000,pointBalance:30000,...data};db.users.push(u);return u;};
  addUser({email:'admin@test.com',password:'test1234',name:'운영관리자',tel:'010-9000-0000',role:'ADMIN'});
  const names=['김하늘','이서준','박지우','정다은','최민준'];
  const customers=names.map((name,i)=>addUser({name,email:`customer${i+1}@example.test`,password:'test1234',tel:`010-7000-000${i+1}`,role:'CUSTOMER'}));
  addUser({name:'김라이더',email:'rider@example.test',password:'test1234',tel:'010-8000-0001',role:'RIDER'});
  db.orders.forEach((o,i)=>{o.customerId ||= customers[i%customers.length].memberId;});
  db.reviews.forEach((r)=>{const o=db.orders.find((o)=>o.orderId===r.orderId);r.writerMemberId ||= o?.customerId||customers[0].memberId;});
  const stores=[['소담한끼 신촌점','KOREAN','345-67-89012'],['도담분식','SNACK','456-78-90123'],['오후커피','CAFE','567-89-01234']];
  stores.forEach(([name,categoryCode,bizNo],i)=>{
   const storeId=nextId(db,'store');
   db.stores.push({storeId,ownerId:3,storeName:name,categoryCode,bizNo,telNo:`02-3000-000${i+1}`,address:'서울 서대문구 연세로 20',addressDetail:`${i+1}층`,lat:37.5589,lng:126.9368,minOrderAmount:12000,deliveryTip:2500,cookMinutes:20,description:'정성을 담아 준비하는 한 끼입니다.',approvalStatus:'PENDING',operStored:'PAUSED',rejectReason:null,del:false});
   db.hours[storeId]=[1,2,3,4,5,6].map((dayOfWeek)=>({dayOfWeek,open:'11:00',close:'21:00'}));
  });
  db.reviews.filter((r)=>!r.hidden&&!db.reports.some((p)=>p.reviewId===r.reviewId)).slice(0,2).forEach((r,i)=>{
   db.reports.push({reportId:nextId(db,'report'),reviewId:r.reviewId,storeId:r.storeId,reason:i?'UNRELATED':'ABUSE',content:i?'주문 내용과 관계없는 내용이 포함되어 있어요.':'비방 표현을 확인해 주세요.',reportedAt:now-(40-i*10)*60000,status:'PENDING',processedAt:null,processNote:null});
  });
  customers.slice(3).forEach((u,i)=>db.adminRestrictions.push({restrictionId:nextId(db,'restriction'),memberId:u.memberId,reason:'반복된 리뷰 운영정책 위반',startedAt:now-(i+1)*86400000,endedAt:null,reportId:null}));
  db.adminDemoVersion=1;
 }
 const customers=db.users.filter((u)=>u.role==='CUSTOMER');
 db.orders.forEach((o,i)=>{o.customerId ||= customers[i%customers.length]?.memberId;});
 db.reviews.forEach((r)=>{r.writerMemberId ||= db.orders.find((o)=>o.orderId===r.orderId)?.customerId;});
 syncApplications(db,now);
}
function applicationSummary(db,a){const s=find(db.stores,'storeId',a.storeId),u=find(db.users,'memberId',s.ownerId);return{applicationId:a.applicationId,storeId:s.storeId,storeName:s.storeName,ownerName:u.name,bizNo:s.bizNo,categoryCode:s.categoryCode,appliedAt:toKST(a.appliedAt),status:a.status,processedAt:toKST(a.processedAt),isReapply:db.adminApplications.some((p)=>p.storeId===s.storeId&&p.applicationId<a.applicationId&&p.status==='REJECTED')};}
function applicationDetail(db,a){const s=find(db.stores,'storeId',a.storeId),u=find(db.users,'memberId',s.ownerId);const hours=db.hours[s.storeId]||[];return{...applicationSummary(db,a),address:s.address,addressDetail:s.addressDetail,telNo:s.telNo,lat:s.lat,lng:s.lng,minOrderAmount:s.minOrderAmount,deliveryTip:s.deliveryTip,cookMinutes:s.cookMinutes,description:s.description,approvalStatus:s.approvalStatus,operStatus:s.operStored,hours,closedDays:[0,1,2,3,4,5,6].filter((d)=>!hours.some((h)=>h.dayOfWeek===d)),ownerEmail:u.email,ownerTel:u.tel,rejectReason:a.rejectReason,history:db.adminApplications.filter((p)=>p.storeId===s.storeId).sort((a,b)=>b.applicationId-a.applicationId).map((p)=>({appliedAt:toKST(p.appliedAt),status:p.status,processedAt:toKST(p.processedAt),rejectReason:p.rejectReason}))};}
function reportSummary(db,p){const r=find(db.reviews,'reviewId',p.reviewId),s=find(db.stores,'storeId',p.storeId);return{reportId:p.reportId,reviewId:r.reviewId,storeName:s.storeName,reason:p.reason,reportedAt:toKST(p.reportedAt),status:p.status,rating:r.rating,reviewPreview:r.content?.slice(0,80)||null,reviewDeleted:Boolean(r.del)};}
function reportDetail(db,p){const r=find(db.reviews,'reviewId',p.reviewId),o=find(db.orders,'orderId',r.orderId),u=find(db.users,'memberId',r.writerMemberId);return{...reportSummary(db,p),content:p.content,processedAt:toKST(p.processedAt),processNote:p.processNote||null,review:{reviewId:r.reviewId,rating:r.rating,content:r.content,createdAt:toKST(r.createdAt),hidden:r.hidden},order:{orderId:o.orderId,status:o.status,deliveredAt:toKST(o.completedAt),menus:o.items.map((x)=>x.menuName).join(', ')},writer:{memberId:u.memberId,name:u.name,hiddenReviewCount:hiddenCount(db,u.memberId),restricted:active(db,u.memberId)}};}
function restrictionOut(db,r){const u=find(db.users,'memberId',r.memberId);return{...r,memberName:u.name,email:u.email,startedAt:toKST(r.startedAt),endedAt:toKST(r.endedAt)};}
function orderSummary(db,o){const c=find(db.users,'memberId',o.customerId),s=find(db.stores,'storeId',o.storeId);return{orderId:o.orderId,orderedAt:toKST(o.orderedAt),status:o.status,customerName:c.name,customerTel:c.tel,storeName:s.storeName,payAmount:total(o)+o.deliveryTip,canCancel:isCancelable(o.status)};}
function orderDetail(db,o){const c=find(db.users,'memberId',o.customerId),s=find(db.stores,'storeId',o.storeId);return{...orderSummary(db,o),items:o.items.map((it)=>({...it,lineTotal:(it.unitPrice+it.options.reduce((n,p)=>n+p.price,0))*it.quantity})),storeRequest:o.storeRequest,riderRequest:o.riderRequest,cutlery:o.cutlery,deliveryAddress:o.deliveryAddress,deliveryAddressDetail:o.deliveryAddressDetail,distance:o.distance,orderTotal:total(o),deliveryTip:o.deliveryTip,payMethod:o.payMethod,acceptedAt:toKST(o.acceptedAt),cookMinutes:o.cookMinutes,canceledAt:toKST(o.canceledAt),cancelActor:o.cancelActor,cancelReason:o.cancelReason,cancelReasonDetail:o.cancelReasonDetail,counselNote:o.counselNote||null,cancelProcessor:o.cancelProcessor||null,customer:{memberId:c.memberId,name:c.name,email:c.email,tel:c.tel},store:{storeId:s.storeId,storeName:s.storeName,telNo:s.telNo},rider:o.rider?{...o.rider,dispatchedAt:toKST(o.rider.dispatchedAt),pickedUpAt:toKST(o.rider.pickedUpAt)}:null,timeline:{orderedAt:toKST(o.orderedAt),acceptedAt:toKST(o.acceptedAt),dispatchedAt:toKST(o.rider?.dispatchedAt),pickedUpAt:toKST(o.rider?.pickedUpAt),deliveredAt:toKST(o.completedAt),canceledAt:toKST(o.canceledAt)}};}
function handle(db,method,path,body,q){
 ensureDemo(db);
 if(path==='/auth/login'&&method==='POST'){
  const u=db.users.find((u)=>u.status==='ACTIVE'&&u.email===String(body.email||'').trim()&&u.password===body.password);
  if(!u)fail(401,'LOGIN_FAILED','이메일 또는 비밀번호가 일치하지 않습니다.');
  session(u.memberId);return ok(publicMember(u));
 }
 if(path==='/auth/logout'&&method==='POST'){session(null);return ok(null);}
 if(path==='/auth/me'&&method==='GET')return ok(publicMember(currentUser(db)));
 const me=currentUser(db);if(me.role!=='ADMIN')fail(403,'FORBIDDEN',L.noAccess);
 let m;
 if(path==='/admin/summary'&&method==='GET')return ok({pendingApplications:db.adminApplications.filter((a)=>a.status==='PENDING'&&!db.stores.find((s)=>s.storeId===a.storeId)?.del).length,pendingReports:db.reports.filter((p)=>p.status==='PENDING').length,activeRestrictions:db.adminRestrictions.filter((r)=>isActiveRestriction(r)).length});
 if(path==='/admin/store-applications'&&method==='GET'){
  const status=q.get('status')||'PENDING';if(!['PENDING','APPROVED','REJECTED'].includes(status))fail(400,'VALIDATION_ERROR',L.select);
  const list=db.adminApplications.filter((a)=>a.status===status&&!find(db.stores,'storeId',a.storeId).del).sort((a,b)=>status==='PENDING'?a.appliedAt-b.appliedAt:b.processedAt-a.processedAt);
  return ok(page(list.map((a)=>applicationSummary(db,a)),q));
 }
 if((m=path.match(/^\/admin\/store-applications\/([^/]+)(?:\/(approve|reject))?$/))){
  const a=find(db.adminApplications,'applicationId',numeric(m[1]));
  if(!m[2]&&method==='GET')return ok(applicationDetail(db,a));
  if(m[2]&&method==='POST'){
   if(a.status!=='PENDING')fail(409,'ALREADY_PROCESSED',L.conflict);
   const s=find(db.stores,'storeId',a.storeId);if(s.del)fail(404,'NOT_FOUND',L.notFound);
   const reason=m[2]==='reject'?text(body.rejectReason,'rejectReason'):null;
   Object.assign(a,{status:m[2]==='approve'?'APPROVED':'REJECTED',processedAt:Date.now(),rejectReason:reason,processorId:me.memberId});
   Object.assign(s,{approvalStatus:a.status,operStored:'PAUSED',rejectReason:reason});
   return ok({applicationId:a.applicationId,status:a.status,processedAt:toKST(a.processedAt)});
  }
 }
 if(path==='/admin/review-reports'&&method==='GET'){
  const status=q.get('status')||'PENDING';if(!['PENDING','ACCEPTED','REJECTED'].includes(status))fail(400,'VALIDATION_ERROR',L.select);
  return ok(page(db.reports.filter((r)=>r.status===status).sort((a,b)=>status==='PENDING'?a.reportedAt-b.reportedAt:(b.processedAt||b.reportedAt)-(a.processedAt||a.reportedAt)).map((p)=>reportSummary(db,p)),q));
 }
 if((m=path.match(/^\/admin\/review-reports\/([^/]+)(?:\/(process))?$/))){
  const p=find(db.reports,'reportId',numeric(m[1]));
  if(!m[2]&&method==='GET')return ok(reportDetail(db,p));
  if(m[2]&&method==='POST'){
   if(p.status!=='PENDING')fail(409,'ALREADY_PROCESSED',L.conflict);
   if(!['ACCEPTED','REJECTED'].includes(body.decision)|| (body.restrictWriter!==undefined&&typeof body.restrictWriter!=='boolean')||(body.decision==='REJECTED'&&body.restrictWriter))fail(400,'VALIDATION_ERROR',L.select);
   const note=text(body.note,'note'),r=find(db.reviews,'reviewId',p.reviewId);
   Object.assign(p,{status:body.decision,processNote:note,processedAt:Date.now(),processorId:me.memberId});
   if(body.decision==='ACCEPTED')r.hidden=true;
   if(body.restrictWriter&&!active(db,r.writerMemberId))db.adminRestrictions.push({restrictionId:nextId(db,'restriction'),memberId:r.writerMemberId,reason:note,reportId:p.reportId,startedAt:Date.now(),endedAt:null,processorId:me.memberId});
   return ok({reportId:p.reportId,status:p.status,processedAt:toKST(p.processedAt),reviewHidden:r.hidden,writerRestricted:active(db,r.writerMemberId)});
  }
 }
 if(path==='/admin/restrictions'&&method==='GET'){
  let list=db.adminRestrictions.slice();const filter=q.get('active');if(filter==='true')list=list.filter((r)=>isActiveRestriction(r));else if(filter==='false')list=list.filter((r)=>!isActiveRestriction(r));
  return ok(page(list.sort((a,b)=>b.startedAt-a.startedAt).map((r)=>restrictionOut(db,r)),q));
 }
 if(path==='/admin/restrictions'&&method==='POST'){
  const u=find(db.users,'memberId',numeric(body.memberId));if(u.role!=='CUSTOMER')fail(400,'NOT_CUSTOMER',L.selectCustomer);
  if(active(db,u.memberId))fail(409,'ALREADY_RESTRICTED',L.alreadyRestricted);
  const reason=text(body.reason,'reason');
  if(body.reportId!==undefined){const p=find(db.reports,'reportId',numeric(body.reportId));if(find(db.reviews,'reviewId',p.reviewId).writerMemberId!==u.memberId)fail(400,'VALIDATION_ERROR',L.select);}
  const r={restrictionId:nextId(db,'restriction'),memberId:u.memberId,reason,reportId:body.reportId??null,startedAt:Date.now(),endedAt:null,processorId:me.memberId};db.adminRestrictions.push(r);return ok(restrictionOut(db,r),201);
 }
 if((m=path.match(/^\/admin\/restrictions\/([^/]+)\/release$/))&&method==='POST'){
  const r=find(db.adminRestrictions,'restrictionId',numeric(m[1]));if(!isActiveRestriction(r))fail(409,'ALREADY_RELEASED',L.conflict);r.endedAt=Date.now();return ok(restrictionOut(db,r));
 }
 if(path==='/admin/orders'&&method==='GET'){
  const keyword=text(q.get('keyword'),'keyword',100);let list=db.orders;
  if(keyword.includes('@')){const ids=db.users.filter((u)=>u.email.toLowerCase()===keyword.toLowerCase()).map((u)=>u.memberId);list=list.filter((o)=>ids.includes(o.customerId));}
  else if(keyword.includes('-')||keyword.startsWith('010')){const digits=keyword.replace(/\D/g,'');const ids=db.users.filter((u)=>String(u.tel||'').replace(/\D/g,'')===digits).map((u)=>u.memberId);list=list.filter((o)=>ids.includes(o.customerId));}
  else if(/^\d+$/.test(keyword))list=list.filter((o)=>o.orderId===Number(keyword));else fail(400,'VALIDATION_ERROR',L.orderDesc);
  return ok(list.sort((a,b)=>b.orderedAt-a.orderedAt).slice(0,50).map((o)=>orderSummary(db,o)));
 }
 if((m=path.match(/^\/admin\/orders\/([^/]+)(?:\/(cancel))?$/))){
  const o=find(db.orders,'orderId',numeric(m[1]));
  if(!m[2]&&method==='GET')return ok(orderDetail(db,o));
  if(m[2]&&method==='POST'){
   if(!isCancelable(o.status))fail(409,'ORDER_ALREADY_PROCESSED',L.conflict);
   if(!['CUSTOMER_REQUEST','STORE_ISSUE','DELIVERY_FAIL','ETC'].includes(body.reason))fail(400,'VALIDATION_ERROR',L.select);
   const note=text(body.counselNote,'counselNote'),now=Date.now();
   Object.assign(o,{status:'CANCEL',canceledAt:now,cancelActor:'ADMIN',cancelReason:body.reason,cancelReasonDetail:body.reason==='ETC'?note:null,counselNote:note,cancelProcessor:{memberId:me.memberId,name:me.name},payStatus:'CANCELED',riderReleased:!!o.rider});
   if(o.payMethod==='POINT'){
    const u=find(db.users,'memberId',o.customerId),amount=total(o)+o.deliveryTip;
    u.pointBalance=(u.pointBalance||0)+amount;db.pointTransactions.push({id:nextId(db,'pointTransaction'),memberId:u.memberId,orderId:o.orderId,type:'REFUND',amount,balance:u.pointBalance,createdAt:now,status:'COMPLETED'});
   }
   return ok({orderId:o.orderId,status:'CANCEL',canceledAt:toKST(now),refunded:true});
  }
 }
 if(path==='/admin/members'&&method==='GET'){
  const keyword=text(q.get('keyword'),'keyword',100).toLowerCase(),role=q.get('role');
  if(role&&!['CUSTOMER','OWNER','RIDER'].includes(role))fail(400,'VALIDATION_ERROR',L.select);
  return ok(db.users.filter((u)=>u.role!=='ADMIN'&&(!role||u.role===role)&&[u.name,u.email,u.tel].some((x)=>String(x||'').toLowerCase().includes(keyword))).slice(0,50).map((u)=>({memberId:u.memberId,name:u.name,email:u.email,tel:u.tel,role:u.role,joinedAt:toKST(u.joinedAt||Date.now()-86400000),orderCount:db.orders.filter((o)=>o.customerId===u.memberId).length,hiddenReviewCount:hiddenCount(db,u.memberId),restricted:active(db,u.memberId)})));
 }
 fail(404,'NOT_FOUND',L.notFound);
}
export async function adminMockRequest(method,fullPath,body){
 await new Promise((resolve)=>setTimeout(resolve,100));
 const [path,query='']=fullPath.split('?');
 try{return withAdminMockDatabase((db)=>handle(db,method,path,body?structuredClone(body):{},new URLSearchParams(query)));}
 catch(e){if(e instanceof MockError)return{status:e.status,json:{success:false,error:{code:e.code,message:e.message,...(e.fields?{fields:e.fields}:{})}}};console.error(e);return{status:500,json:{success:false,error:{code:'SERVER_ERROR',message:L.unexpected}}};}
}
export function resetAdminDemo(){resetMockDatabase();session(null);}
