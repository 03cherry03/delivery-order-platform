// 표시용 포맷 함수. 서버 일시 형식은 'YYYY-MM-DD HH:mm:ss' (한국 시간)

export function won(n) {
  if (n === null || n === undefined) return '-';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function parseDT(s) {
  if (!s) return null;
  // 'YYYY-MM-DD HH:mm:ss' → Date (브라우저 로컬 = 한국 시간 가정)
  const [d, t = '00:00:00'] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm, ss = 0] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm, ss);
}

const pad = (n) => String(n).padStart(2, '0');

export function toDT(date) {
  return `${toDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function hm(s) {
  const d = parseDT(s);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '-';
}

export function mdhm(s) {
  const d = parseDT(s);
  return d ? `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '-';
}

export function ymd(s) {
  const d = parseDT(s);
  return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : '-';
}

export function km(m) {
  if (m === null || m === undefined) return '-';
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

// 남은 시간 'm:ss'. 음수면 0:00
export function remain(untilStr, now = new Date()) {
  const until = parseDT(untilStr);
  if (!until) return '-';
  const sec = Math.max(0, Math.floor((until - now) / 1000));
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}

export function percent(r) {
  if (r === null || r === undefined) return '-';
  return `${Math.round(r * 1000) / 10}%`;
}

export function stars(rating) {
  const r = Math.round(rating || 0);
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}
