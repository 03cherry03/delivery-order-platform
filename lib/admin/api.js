// Administrator API client. Same /api contract and env names as the shared project.
import { adminMockRequest } from './mock/server';
import { L } from './labels';
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
export class ApiError extends Error {
 constructor(status, error={}) { super(error.message || L.unexpected); this.name='ApiError'; this.status=status; this.code=error.code || 'UNKNOWN'; this.fields=error.fields || null; }
}
async function request(method, path, body) {
 let status,json;
 if (USE_MOCK) ({status,json}=await adminMockRequest(method,path,body));
 else {
  let response;
  try { response=await fetch(`${API_BASE}/api${path}`,{ method, credentials:'include', cache:'no-store', headers:body!==undefined?{'Content-Type':'application/json'}:undefined, body:body!==undefined?JSON.stringify(body):undefined }); }
  catch { throw new ApiError(0,{code:'NETWORK_ERROR',message:L.networkError}); }
  status=response.status;
  json=status===204?{success:true,data:null}:await response.json().catch(()=>({success:false,error:{code:'BAD_RESPONSE',message:L.badResponse}}));
 }
 if (status>=400 || !json || json.success!==true) {
  const e=new ApiError(status,json?.error);
  if (status===401 && typeof window!=='undefined') window.dispatchEvent(new CustomEvent('admin-session-expired'));
  throw e;
 }
 return json.data ?? null;
}
const qs=(obj={})=>{const q=new URLSearchParams();for(const [k,v] of Object.entries(obj))if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v));return q.size?`?${q}`:'';};
const id=(v)=>{if(!Number.isSafeInteger(Number(v))||Number(v)<=0)throw new ApiError(400,{code:'VALIDATION_ERROR',message:'Invalid ID'});return Number(v);};
export const login=(email,password)=>request('POST','/auth/login',{email,password}); // A-01
export const logout=()=>request('POST','/auth/logout'); // A-02
export const getMe=()=>request('GET','/auth/me'); // A-03
export const getSummary=()=>request('GET','/admin/summary'); // X-00
export const getApplications=(params={})=>request('GET',`/admin/store-applications${qs(params)}`); // X-01
export const getApplication=(applicationId)=>request('GET',`/admin/store-applications/${id(applicationId)}`); // X-02
export const approveApplication=(applicationId)=>request('POST',`/admin/store-applications/${id(applicationId)}/approve`); // X-03
export const rejectApplication=(applicationId,rejectReason)=>request('POST',`/admin/store-applications/${id(applicationId)}/reject`,{rejectReason}); // X-04
export const getReports=(params={})=>request('GET',`/admin/review-reports${qs(params)}`); // X-05
export const getReport=(reportId)=>request('GET',`/admin/review-reports/${id(reportId)}`); // X-06
export const processReport=(reportId,body)=>request('POST',`/admin/review-reports/${id(reportId)}/process`,body); // X-07
export const getRestrictions=(params={active:true})=>request('GET',`/admin/restrictions${qs(params)}`); // X-08
export const createRestriction=(body)=>request('POST','/admin/restrictions',body); // X-09
export const releaseRestriction=(restrictionId)=>request('POST',`/admin/restrictions/${id(restrictionId)}/release`); // X-10
export const searchOrders=(keyword)=>request('GET',`/admin/orders${qs({keyword})}`); // X-11
export const getOrder=(orderId)=>request('GET',`/admin/orders/${id(orderId)}`); // X-12
export const cancelOrder=(orderId,body)=>request('POST',`/admin/orders/${id(orderId)}/cancel`,body); // X-13
export const searchMembers=(keyword,role)=>request('GET',`/admin/members${qs({keyword,role})}`); // X-14
export function notifyChanged(){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('admin-data-changed'));}
