export const won = (v) => `${new Intl.NumberFormat('ko-KR').format(Number(v) || 0)}원`;
export const number = (v) => new Intl.NumberFormat('ko-KR').format(Number(v) || 0);
export function dateTime(value) {
 if (!value) return '-';
 if (typeof value === 'string') return value.replace('T', ' ').slice(0,16).replaceAll('-', '.');
 return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
}
export function toKST(value = Date.now()) {
 if (!value) return null;
 const d=new Date(value+9*60*60*1000);
 return d.toISOString().slice(0,19).replace('T',' ');
}
export function asList(value) { return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []; }
export const isCancelable = (status) => ['WAIT','COOKING','READY','DELIVERING'].includes(status);
export function isActiveRestriction(r, now = Date.now()) {
 // Match X-08: an unset or future end time is active. Server dates are KST.
 if(!r.endedAt)return true;
 const value=r.endedAt;
 const timestamp=typeof value==='number'?value:Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)?value:`${value.replace(' ','T')}+09:00`);
 return Number.isFinite(timestamp)&&timestamp>now;
}
