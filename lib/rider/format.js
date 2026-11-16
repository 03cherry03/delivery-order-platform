// 표시용 포맷 함수. 서버 일시 형식은 'YYYY-MM-DD HH:mm:ss' (한국 시간)

const pad = (n) => String(n).padStart(2, '0');

export function won(n) {
  if (n === null || n === undefined) return '-';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function parseDT(s) {
  if (!s) return null;
  const [d, t = '00:00:00'] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm, ss = 0] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm, ss);
}

export function toDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDT(date) {
  return `${toDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function hm(s) {
  const d = parseDT(s);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '-';
}

export function mdhm(s) {
  const d = parseDT(s);
  return d ? `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '-';
}

// 미터 → '450m' / '1.8km'
export function dist(m) {
  if (m === null || m === undefined) return '-';
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

// expectedReadyAt까지 남은 분. 지났으면 음수
export function minutesUntil(s, now = new Date()) {
  const d = parseDT(s);
  return d ? Math.round((d - now) / 60000) : null;
}

// 조리 완료 예정 안내 문구
export function readyText(orderStatus, expectedReadyAt, now = new Date()) {
  if (orderStatus === 'READY') return '조리 완료 · 바로 픽업 가능';
  const left = minutesUntil(expectedReadyAt, now);
  if (left === null) return '조리 중';
  if (left <= 0) return `조리 중 · ${hm(expectedReadyAt)} 완료 예정(지연)`;
  return `조리 중 · 약 ${left}분 뒤 완료 (${hm(expectedReadyAt)})`;
}
