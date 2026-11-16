// 가짜 서버 — 라이더 명세서(D-01~D-09)와 공통 인증(A-01~A-03)의 요청·응답·오류 규칙을 브라우저 안에서 흉내 낸다.
// 백엔드가 붙으면 쓰지 않는다 (lib/rider/api.js 의 USE_MOCK).
//
// 데모를 위해 시간이 지나면 저절로 바뀌는 것:
//  - 조리중(COOKING) 주문은 조리 완료 예정 시각(expectedReadyAt)이 되면 사장이 조리 완료를 누른 것처럼 READY가 된다
//  - 대기 중인 배달 요청이 3건보다 적으면 45초마다 새 요청이 들어온다
//  - 새로 들어온 요청 중 일부는 90초 안에 "다른 라이더"가 가져간다 (목록에서 사라짐)
// 테스트 계정: rider1@test.com / rider2@test.com / rider3@test.com, 비밀번호 test1234

import { createSeed, STORES, ADDRESS_POOL, MENU_POOL, RIDER_REQ_POOL } from './seed';
import { toDT, toDate } from '../format';
import { DEFAULT_RIDER_LAT, DEFAULT_RIDER_LNG, DEFAULT_ACT_RADIUS_M, ACT_RADIUS_MIN, ACT_RADIUS_MAX, VEHICLE_OPTIONS } from '../codes';

const KEY = 'rider-mock-db-v1';
const MIN = 60 * 1000;
const OTHER_RIDER = 0; // 화면에 없는 다른 라이더
let db = null;

function load() {
  if (db) return db;
  try {
    const saved = typeof window !== 'undefined' && window.localStorage.getItem(KEY);
    if (saved) db = JSON.parse(saved);
  } catch { /* 저장소를 못 쓰면 새로 만든다 */ }
  if (!db) db = createSeed();
  return db;
}
function save() {
  try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 무시 */ }
}
// 데모 데이터를 처음 상태로 (로그인은 유지)
export function resetMock() {
  const session = db?.session ?? null;
  db = createSeed();
  db.session = session;
  save();
}

/* ── 응답 도우미 ── */
const ok = (data, status = 200) => ({ status, json: { success: true, data } });
class Fail extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields; }
}
const fail = (status, code, message, fields) => { throw new Fail(status, code, message, fields); };
const dt = (ms) => (ms ? toDT(new Date(ms)) : null);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/* ── 계산 ── */
// 하버사인 거리(m). 백엔드도 Node에서 같은 식으로 계산한다 (명세서 상수 표)
export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
const storeOf = (d) => STORES.find((s) => s.storeId === d.storeId);
const userOf = (id) => db.users.find((u) => u.memberId === id);
const readyAt = (d) => d.acceptedAt + d.cookMinutes * MIN; // ORD_RCPT_DTTM + COOK_EST_MI
const isOpenRequest = (d) => d.riderId === null && (d.orderStatus === 'COOKING' || d.orderStatus === 'READY');

/* ── 시간이 지나며 바뀌는 것 ── */
function tick(now = Date.now()) {
  for (const d of db.deliveries) {
    if (d.orderStatus === 'COOKING' && now >= readyAt(d)) d.orderStatus = 'READY'; // 사장 O-04 조리 완료
    if (isOpenRequest(d) && d.takeByOtherAt && now >= d.takeByOtherAt) {
      d.riderId = OTHER_RIDER;
      d.dispatchedAt = d.takeByOtherAt;
    }
  }
  const open = db.deliveries.filter(isOpenRequest).length;
  if (open < 3 && now - db.lastSpawn > 45 * 1000) {
    db.lastSpawn = now;
    const store = pick(STORES);
    const [address, addressDetail, lat, lng, customerId] = pick(ADDRESS_POOL);
    const menus = MENU_POOL[store.storeId];
    const n = 1 + Math.floor(Math.random() * 2);
    const cookMinutes = pick([15, 20, 25]);
    db.deliveries.push({
      deliveryId: ++db.seq.delivery, orderId: ++db.seq.order, storeId: store.storeId, customerId,
      orderStatus: 'COOKING', items: menus.slice(0, n), tip: [3000, 2000, 2500][store.storeId - 1],
      address, addressDetail, lat, lng, riderRequest: pick(RIDER_REQ_POOL),
      // 사장이 조금 전에 접수했다고 치고, 1~4분 뒤 조리가 끝나게 한다
      acceptedAt: now - (cookMinutes - 1 - Math.floor(Math.random() * 4)) * MIN, cookMinutes, createdAt: now,
      riderId: null, dispatchedAt: null, pickedUpAt: null, completedAt: null,
      takeByOtherAt: Math.random() < 0.5 ? now + (40 + Math.floor(Math.random() * 50)) * 1000 : null,
    });
  }
}

/* ── 직렬화 (명세서 응답 모양) ── */
function riderMeOut(u) {
  const r = db.riders[u.memberId];
  const cur = r.status === 'BUSY' ? currentOf(u.memberId) : null;
  return {
    memberId: u.memberId, name: u.name, tel: u.tel,
    vehicleType: r.vehicleType, actRadiusM: r.actRadiusM, riderStatus: r.status,
    currentDeliveryId: cur ? cur.deliveryId : null,
  };
}
function currentOf(memberId) {
  return db.deliveries.find((d) => d.riderId === memberId && !d.completedAt && !['CANCEL', 'DONE'].includes(d.orderStatus)) || null;
}
function currentOut(d) {
  const s = storeOf(d);
  return {
    deliveryId: d.deliveryId, orderId: d.orderId, orderStatus: d.orderStatus,
    store: { name: s.name, address: s.address, tel: s.tel, lat: s.lat, lng: s.lng },
    delivery: {
      address: d.address, addressDetail: d.addressDetail, lat: d.lat, lng: d.lng,
      customerTel: userOf(d.customerId)?.tel ?? null, riderRequest: d.riderRequest,
    },
    itemSummary: d.items.length > 1 ? `${d.items[0]} 외 ${d.items.length - 1}건` : d.items[0],
    itemCount: d.items.length,
    deliveryTip: d.tip,
    expectedReadyAt: dt(readyAt(d)),
    dispatchedAt: dt(d.dispatchedAt),
    pickedUpAt: dt(d.pickedUpAt),
  };
}

/* ── 라우터 ── */
const routes = [];
const on = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; })}$`);
  routes.push({ method, re, keys, handler, opts });
};

function sessionUser() {
  const u = db.session ? userOf(db.session) : null;
  if (!u || u.status !== 'ACTIVE') fail(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  return u;
}
function rider() {
  const u = sessionUser();
  if (u.role !== 'RIDER') fail(403, 'FORBIDDEN', '라이더만 쓸 수 있는 기능입니다.');
  return u;
}
function myDelivery(u, deliveryId) {
  const d = db.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) fail(404, 'NOT_FOUND', '배달을 찾을 수 없습니다.');
  if (d.riderId !== u.memberId) fail(403, 'FORBIDDEN', '내 배달이 아닙니다.');
  return d;
}
function validateRiderFields(b, { partial }) {
  const fields = {};
  if (!partial || b.vehicleType !== undefined) {
    if (!VEHICLE_OPTIONS.includes(b.vehicleType)) fields.vehicleType = '운송수단을 선택하세요.';
  }
  if (b.actRadiusM !== undefined && b.actRadiusM !== null) {
    const v = Number(b.actRadiusM);
    if (!Number.isInteger(v) || v < ACT_RADIUS_MIN || v > ACT_RADIUS_MAX) fields.actRadiusM = `활동 반경은 ${ACT_RADIUS_MIN}~${ACT_RADIUS_MAX}m 사이 정수입니다.`;
  }
  return fields;
}

/* A-01~A-03 공통 인증 */
on('POST', '/auth/login', (p, b) => {
  const u = db.users.find((x) => x.email === String(b.email || '').trim().toLowerCase());
  if (!u || u.password !== b.password || u.status !== 'ACTIVE') fail(401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 일치하지 않습니다.');
  db.session = u.memberId;
  return ok({ memberId: u.memberId, name: u.name, role: u.role });
});
on('POST', '/auth/logout', () => {
  db.session = null;
  return { status: 200, json: { success: true } };
});
on('GET', '/auth/me', () => {
  const u = sessionUser();
  return ok({ memberId: u.memberId, name: u.name, role: u.role });
});

/* D-01 라이더 회원가입 */
on('POST', '/auth/signup', (p, b) => {
  if (b.role !== 'RIDER') fail(400, 'VALIDATION_ERROR', '라이더 화면 가짜 서버는 RIDER 가입만 받습니다.', { role: 'RIDER만 가능' });
  const fields = validateRiderFields(b, { partial: false });
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = '이메일 형식이 아닙니다.';
  if (isBlank(b.password) || String(b.password).length < 8) fields.password = '비밀번호는 8자 이상입니다.';
  if (isBlank(b.name)) fields.name = '이름을 입력하세요.';
  if (isBlank(b.tel)) fields.tel = '연락처를 입력하세요.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인하세요.', fields);
  if (db.users.some((u) => u.email === email)) fail(409, 'DUPLICATE_EMAIL', '이미 가입된 이메일입니다.');
  const memberId = ++db.seq.member;
  db.users.push({ memberId, email, password: b.password, name: b.name.trim(), tel: b.tel.trim(), role: 'RIDER', status: 'ACTIVE' });
  db.riders[memberId] = { vehicleType: b.vehicleType, actRadiusM: b.actRadiusM ? Number(b.actRadiusM) : DEFAULT_ACT_RADIUS_M, status: 'IDLE' };
  return ok({ memberId, role: 'RIDER' }, 201);
});

/* D-02, D-03 내 정보 */
on('GET', '/rider/me', () => ok(riderMeOut(rider())));
on('PATCH', '/rider/me', (p, b) => {
  const u = rider();
  const r = db.riders[u.memberId];
  if (r.status === 'BUSY') fail(409, 'RIDER_BUSY', '배달 중에는 활동 정보를 바꿀 수 없습니다.');
  const fields = validateRiderFields(b, { partial: true });
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인하세요.', fields);
  if (b.vehicleType !== undefined) r.vehicleType = b.vehicleType;
  if (b.actRadiusM !== undefined && b.actRadiusM !== null) r.actRadiusM = Number(b.actRadiusM);
  return ok(riderMeOut(u));
});

/* D-04 배차 대기 목록 */
on('GET', '/rider/dispatch-requests', (p, b, q) => {
  const u = rider();
  const radius = db.riders[u.memberId].actRadiusM;
  const lat = q.has('lat') ? Number(q.get('lat')) : DEFAULT_RIDER_LAT;
  const lng = q.has('lng') ? Number(q.get('lng')) : DEFAULT_RIDER_LNG;
  const rows = db.deliveries.filter(isOpenRequest).map((d) => {
    const s = storeOf(d);
    return {
      deliveryId: d.deliveryId, orderId: d.orderId,
      storeName: s.name, storeAddress: s.address, storeLat: s.lat, storeLng: s.lng,
      distanceToStoreM: haversineM(lat, lng, s.lat, s.lng),
      deliveryAddress: d.address,
      deliveryDistanceM: haversineM(s.lat, s.lng, d.lat, d.lng),
      deliveryTip: d.tip, orderStatus: d.orderStatus,
      expectedReadyAt: dt(readyAt(d)),
      _readyMs: readyAt(d),
    };
  });
  return ok(rows
    .filter((r) => r.distanceToStoreM <= radius)
    .sort((a, b2) => a._readyMs - b2._readyMs)
    .map(({ _readyMs, ...r }) => r));
});

/* D-05 배차 수락 */
on('POST', '/rider/deliveries/:deliveryId/accept', ({ deliveryId }) => {
  const u = rider();
  const d = db.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) fail(404, 'NOT_FOUND', '배달을 찾을 수 없습니다.');
  const r = db.riders[u.memberId];
  if (r.status !== 'IDLE') fail(409, 'RIDER_BUSY', '이미 다른 배달을 맡고 있습니다.');
  if (!['COOKING', 'READY'].includes(d.orderStatus)) fail(409, 'ORDER_ALREADY_PROCESSED', '취소되었거나 이미 처리된 주문입니다.');
  if (d.riderId !== null) fail(409, 'ALREADY_DISPATCHED', '다른 라이더가 먼저 수락했습니다.');
  // 실제 서버는 한 트랜잭션(BEGIN IMMEDIATE) 안에서 조건부 UPDATE 두 번
  r.status = 'BUSY';
  d.riderId = u.memberId;
  d.dispatchedAt = Date.now();
  return ok(currentOut(d));
});

/* D-06 현재 배달 */
on('GET', '/rider/deliveries/current', () => {
  const u = rider();
  const d = currentOf(u.memberId);
  return ok(d ? currentOut(d) : null);
});

/* D-07 픽업 완료 */
on('POST', '/rider/deliveries/:deliveryId/pickup', ({ deliveryId }) => {
  const u = rider();
  const d = myDelivery(u, deliveryId);
  if (d.orderStatus !== 'READY') {
    if (d.orderStatus === 'COOKING') fail(409, 'NOT_READY', '아직 조리 중입니다. 조리가 끝나면 픽업할 수 있어요.');
    fail(409, 'ORDER_ALREADY_PROCESSED', '취소되었거나 이미 픽업한 주문입니다.');
  }
  d.orderStatus = 'DELIVERING';
  d.pickedUpAt = Date.now();
  return ok(currentOut(d));
});

/* D-08 배달 완료 */
on('POST', '/rider/deliveries/:deliveryId/complete', ({ deliveryId }) => {
  const u = rider();
  const d = myDelivery(u, deliveryId);
  if (d.orderStatus !== 'DELIVERING') {
    if (d.orderStatus === 'COOKING' || d.orderStatus === 'READY') fail(409, 'NOT_PICKED_UP', '픽업한 뒤에 배달 완료할 수 있습니다.');
    fail(409, 'ORDER_ALREADY_PROCESSED', '취소되었거나 이미 처리된 주문입니다.');
  }
  d.orderStatus = 'DONE';
  d.completedAt = Date.now();
  db.riders[u.memberId].status = 'IDLE';
  return ok({ deliveryId: d.deliveryId, completedAt: dt(d.completedAt) });
});

/* D-09 배달 내역 */
on('GET', '/rider/deliveries/history', (p, b, q) => {
  const u = rider();
  const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(q.get('size') || '20', 10) || 20));
  const done = db.deliveries
    .filter((d) => d.riderId === u.memberId && d.orderStatus === 'DONE')
    .sort((a, b2) => b2.completedAt - a.completedAt);
  const today = toDate(new Date());
  const todays = done.filter((d) => toDate(new Date(d.completedAt)) === today);
  return ok({
    items: done.slice((page - 1) * size, page * size).map((d) => ({
      deliveryId: d.deliveryId, orderId: d.orderId, storeName: storeOf(d).name,
      deliveryAddress: d.address, deliveryTip: d.tip,
      pickedUpAt: dt(d.pickedUpAt), completedAt: dt(d.completedAt),
    })),
    page, size, totalCount: done.length,
    todayCount: todays.length,
    todayTipSum: todays.reduce((s, d) => s + d.tip, 0),
  });
});

/* ── 진입점 ── */
export async function mockRequest(method, fullPath, body) {
  await new Promise((r) => setTimeout(r, 120)); // 네트워크 지연 흉내
  load();
  const [path, query = ''] = fullPath.split('?');
  const q = new URLSearchParams(query);
  try {
    tick();
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, Number(m[i + 1])]));
      const res = r.handler(params, body ? JSON.parse(JSON.stringify(body)) : {}, q);
      save();
      return res;
    }
    return { status: 404, json: { success: false, error: { code: 'NOT_FOUND', message: `없는 API입니다: ${method} ${path}` } } };
  } catch (e) {
    save();
    if (e instanceof Fail) return { status: e.status, json: { success: false, error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } } };
    console.error(e);
    return { status: 500, json: { success: false, error: { code: 'SERVER_ERROR', message: '가짜 서버 오류' } } };
  }
}
