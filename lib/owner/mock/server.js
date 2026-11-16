// 가짜 서버 — 명세서의 요청·응답·오류 규칙을 브라우저 안에서 흉내 낸다.
// 백엔드가 붙으면 쓰지 않는다 (lib/api.js 의 USE_MOCK).
//
// 데모를 위해 시간이 지나면 저절로 바뀌는 것:
//  - 10분 동안 접수하지 않은 신규 주문은 자동 취소 (SYSTEM)
//  - 조리중 주문에 15초 뒤 라이더 배차, 조리완료 20초 뒤 픽업, 픽업 40초 뒤 배달완료
//  - 가게가 영업중이면 40초마다 새 주문이 들어옴 (신규가 2건 미만일 때)
// 테스트 계정: owner@test.com / test1234

import { createSeed, RIDER_POOL, ADDRESS_POOL, STORE_REQ_POOL, RIDER_REQ_POOL } from './seed';
import { toDT, toDate, parseDT } from '../format';

const KEY = 'owner-mock-db-v1';
const MIN = 60 * 1000;
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
export function resetMock() {
  db = createSeed();
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
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function operStatus(store, now = Date.now()) {
  if (store.operStored === 'PAUSED') return 'PAUSED';
  const d = new Date(now);
  const cur = d.getHours() * 60 + d.getMinutes();
  const today = (db.hours[store.storeId] || []).filter((h) => h.dayOfWeek === d.getDay());
  return today.some((h) => cur >= toMin(h.open) && cur < toMin(h.close)) ? 'OPEN' : 'CLOSED';
}
const lineTotal = (it) => (it.unitPrice + it.options.reduce((s, o) => s + o.price, 0)) * it.quantity;
const orderTotal = (o) => o.items.reduce((s, it) => s + lineTotal(it), 0);
const liveReviews = (storeId) => db.reviews.filter((r) => r.storeId === storeId && !r.del && !r.hidden);
const avgRating = (storeId) => {
  const rs = liveReviews(storeId);
  return rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null;
};

/* ── 시간이 지나며 바뀌는 것 ── */
function tick(now = Date.now()) {
  for (const o of db.orders) {
    if (o.status === 'WAIT' && now >= o.orderedAt + 10 * MIN) {
      Object.assign(o, { status: 'CANCEL', canceledAt: o.orderedAt + 10 * MIN, cancelActor: 'SYSTEM', cancelReason: 'NO_RESPONSE' });
    }
    if ((o.status === 'COOKING' || o.status === 'READY') && !o.rider && now >= o.acceptedAt + 15 * 1000) {
      const [name, vehicle] = pick(RIDER_POOL);
      o.rider = { name, vehicle, dispatchedAt: now, pickedUpAt: null };
    }
    if (o.status === 'READY' && o.rider && now >= o.readyAt + 20 * 1000) {
      o.status = 'DELIVERING';
      o.rider.pickedUpAt = now;
    }
    if (o.status === 'DELIVERING' && now >= (o.rider?.pickedUpAt || now) + 40 * 1000) {
      o.status = 'DONE';
      o.completedAt = now;
    }
  }
  // 새 주문 도착 (데모용)
  for (const store of db.stores.filter((s) => !s.del && s.approvalStatus === 'APPROVED')) {
    const waiting = db.orders.filter((o) => o.storeId === store.storeId && o.status === 'WAIT').length;
    const onSale = db.menus.filter((m) => m.storeId === store.storeId && !m.del && m.saleStatus === 'ON_SALE');
    if (operStatus(store, now) === 'OPEN' && waiting < 2 && onSale.length && now - db.lastArrival > 40 * 1000) {
      db.lastArrival = now;
      const menu = pick(onSale);
      const [address, detail, distance] = pick(ADDRESS_POOL);
      db.orders.push({
        orderId: ++db.seq.order, storeId: store.storeId, orderedAt: now, status: 'WAIT',
        items: [{ menuName: menu.menuName, quantity: 1, unitPrice: menu.price, options: [] }],
        storeRequest: pick(STORE_REQ_POOL) || null, riderRequest: pick(RIDER_REQ_POOL) || null, cutlery: Math.random() < 0.3,
        deliveryAddress: address, deliveryAddressDetail: detail || null, distance,
        deliveryTip: store.deliveryTip, payMethod: pick(['CARD', 'KAKAO', 'NAVER', 'POINT']),
        acceptedAt: null, cookMinutes: null, readyAt: null, completedAt: null,
        canceledAt: null, cancelActor: null, cancelReason: null, cancelReasonDetail: null, rider: null,
      });
    }
  }
}

/* ── 직렬화 (명세서 응답 모양) ── */
function storeOut(s) {
  const hours = [...(db.hours[s.storeId] || [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMin(a.open) - toMin(b.open));
  const days = new Set(hours.map((h) => h.dayOfWeek));
  const oper = operStatus(s);
  return {
    storeId: s.storeId, storeName: s.storeName, categoryCode: s.categoryCode, bizNo: s.bizNo,
    telNo: s.telNo, address: s.address, addressDetail: s.addressDetail, lat: s.lat, lng: s.lng,
    hours, closedDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.has(d)),
    minOrderAmount: s.minOrderAmount, deliveryTip: s.deliveryTip, cookMinutes: s.cookMinutes, description: s.description,
    approvalStatus: s.approvalStatus, operStatus: oper, isOpenNow: oper === 'OPEN',
    onSaleMenuCount: db.menus.filter((m) => m.storeId === s.storeId && !m.del && m.saleStatus === 'ON_SALE').length,
    avgRating: avgRating(s.storeId), reviewCount: liveReviews(s.storeId).length,
  };
}
function optionOut(o) { return { optionId: o.optionId, optionName: o.optionName, price: o.price, seq: o.seq }; }
function groupOut(g) {
  return {
    optionGroupId: g.optionGroupId, groupName: g.groupName, required: g.required, maxSelect: g.maxSelect, seq: g.seq,
    options: db.options.filter((o) => o.optionGroupId === g.optionGroupId && !o.del).sort((a, b) => a.seq - b.seq).map(optionOut),
  };
}
function menuDetail(m) {
  const c = db.categories.find((x) => x.categoryId === m.categoryId);
  return {
    menuId: m.menuId, categoryId: m.categoryId, categoryName: c?.categoryName ?? null, menuName: m.menuName, price: m.price,
    description: m.description, saleStatus: m.saleStatus, seq: m.seq,
    optionGroups: db.groups.filter((g) => g.menuId === m.menuId && !g.del).sort((a, b) => a.seq - b.seq).map(groupOut),
  };
}
function menusOut(storeId) {
  return db.categories.filter((c) => c.storeId === storeId && !c.del).sort((a, b) => a.seq - b.seq).map((c) => ({
    categoryId: c.categoryId, categoryName: c.categoryName, seq: c.seq,
    menus: db.menus.filter((m) => m.categoryId === c.categoryId && !m.del).sort((a, b) => a.seq - b.seq).map((m) => ({
      menuId: m.menuId, menuName: m.menuName, price: m.price, description: m.description, saleStatus: m.saleStatus, seq: m.seq,
      optionGroupCount: db.groups.filter((g) => g.menuId === m.menuId && !g.del).length,
    })),
  }));
}
function categoriesOut(storeId) {
  return db.categories.filter((c) => c.storeId === storeId && !c.del).sort((a, b) => a.seq - b.seq).map((c) => ({
    categoryId: c.categoryId, categoryName: c.categoryName, seq: c.seq,
    menuCount: db.menus.filter((m) => m.categoryId === c.categoryId && !m.del).length,
  }));
}
function orderSummary(o, now = Date.now()) {
  const total = orderTotal(o);
  return {
    orderId: o.orderId, orderedAt: dt(o.orderedAt), status: o.status,
    elapsedMinutes: Math.floor((now - o.orderedAt) / MIN),
    autoCancelAt: o.status === 'WAIT' ? dt(o.orderedAt + 10 * MIN) : null,
    summary: o.items.length > 1 ? `${o.items[0].menuName} 외 ${o.items.length - 1}건` : o.items[0].menuName,
    itemCount: o.items.length, orderTotal: total, deliveryTip: o.deliveryTip, payAmount: total + o.deliveryTip,
    deliveryAddress: o.deliveryAddress, distance: o.distance, riderName: o.rider?.name ?? null,
  };
}
function orderDetail(o) {
  const total = orderTotal(o);
  return {
    orderId: o.orderId, orderedAt: dt(o.orderedAt), status: o.status,
    items: o.items.map((it) => ({ ...it, lineTotal: lineTotal(it) })),
    storeRequest: o.storeRequest, riderRequest: o.riderRequest, cutlery: o.cutlery,
    deliveryAddress: o.deliveryAddress, deliveryAddressDetail: o.deliveryAddressDetail, distance: o.distance,
    orderTotal: total, deliveryTip: o.deliveryTip, payAmount: total + o.deliveryTip, payMethod: o.payMethod,
    acceptedAt: dt(o.acceptedAt), cookMinutes: o.cookMinutes,
    canceledAt: dt(o.canceledAt), cancelActor: o.cancelActor, cancelReason: o.cancelReason, cancelReasonDetail: o.cancelReasonDetail,
    rider: o.rider ? { name: o.rider.name, vehicle: o.rider.vehicle, dispatchedAt: dt(o.rider.dispatchedAt), pickedUpAt: dt(o.rider.pickedUpAt) } : null,
  };
}
function reviewOut(r) {
  const myReport = db.reports.find((p) => p.reviewId === r.reviewId);
  return {
    reviewId: r.reviewId, orderId: r.orderId, writerName: r.writerName, rating: r.rating, content: r.content,
    createdAt: dt(r.createdAt), orderedMenus: r.orderedMenus, hidden: r.hidden,
    reply: r.reply && !r.reply.del ? { replyId: r.reply.replyId, content: r.reply.content, createdAt: dt(r.reply.createdAt) } : null,
    report: myReport ? { status: myReport.status } : null,
  };
}
const paginate = (list, page = 1, size = 20) => {
  const p = Math.max(1, Number(page) || 1);
  const sz = Math.min(100, Math.max(1, Number(size) || 20));
  return { items: list.slice((p - 1) * sz, p * sz), page: p, size: sz, totalCount: list.length };
};

/* ── 검증 ── */
function validateStoreBody(b) {
  const fields = {};
  if (isBlank(b.storeName)) fields.storeName = '가게명을 입력해 주세요.';
  if (isBlank(b.categoryCode)) fields.categoryCode = '카테고리를 골라 주세요.';
  if (!/^\d{3}-\d{2}-\d{5}$/.test(b.bizNo || '')) fields.bizNo = '000-00-00000 형식으로 입력해 주세요.';
  if (isBlank(b.telNo)) fields.telNo = '가게 전화번호를 입력해 주세요.';
  if (isBlank(b.address)) fields.address = '주소를 입력해 주세요.';
  if (typeof b.lat !== 'number' || Number.isNaN(b.lat)) fields.lat = '위도를 숫자로 입력해 주세요.';
  if (typeof b.lng !== 'number' || Number.isNaN(b.lng)) fields.lng = '경도를 숫자로 입력해 주세요.';
  if (!(b.minOrderAmount >= 0)) fields.minOrderAmount = '0 이상이어야 합니다.';
  if (!(b.deliveryTip >= 0)) fields.deliveryTip = '0 이상이어야 합니다.';
  if (!(b.cookMinutes >= 1)) fields.cookMinutes = '1 이상이어야 합니다.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  validateHours(b.hours);
}
function validateHours(hours) {
  if (!Array.isArray(hours) || hours.length === 0) fail(400, 'INVALID_HOURS', '영업일이 하루는 있어야 합니다.');
  for (let d = 0; d < 7; d++) {
    const rs = hours.filter((h) => h.dayOfWeek === d).map((h) => [toMin(h.open), h.close === '24:00' ? 1440 : toMin(h.close)]).sort((a, b) => a[0] - b[0]);
    for (const [o, c] of rs) if (c <= o) fail(400, 'INVALID_HOURS', '종료 시각이 시작 시각보다 늦어야 합니다.');
    for (let i = 1; i < rs.length; i++) if (rs[i][0] < rs[i - 1][1]) fail(400, 'INVALID_HOURS', '같은 요일의 영업시간이 겹칩니다.');
  }
}
function applyStoreBody(store, b) {
  Object.assign(store, {
    storeName: b.storeName.trim(), categoryCode: b.categoryCode, bizNo: b.bizNo, telNo: b.telNo, address: b.address,
    addressDetail: b.addressDetail || null, lat: b.lat, lng: b.lng, minOrderAmount: b.minOrderAmount, deliveryTip: b.deliveryTip,
    cookMinutes: b.cookMinutes, description: b.description || null,
  });
  db.hours[store.storeId] = b.hours.map((h) => ({ dayOfWeek: h.dayOfWeek, open: h.open, close: h.close }));
}

/* ── 라우팅 ── */
const routes = [];
const on = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; })}$`);
  routes.push({ method, re, keys, handler, opts });
};

function me() {
  const u = db.users.find((x) => x.memberId === db.session && x.status === 'ACTIVE');
  if (!u) fail(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  return u;
}
function owner() {
  const u = me();
  if (u.role !== 'OWNER') fail(403, 'FORBIDDEN', '사장님만 이용할 수 있어요.');
  return u;
}
function myStore(storeId, { approved = true } = {}) {
  const u = owner();
  const s = db.stores.find((x) => x.storeId === storeId && !x.del);
  if (!s) fail(404, 'NOT_FOUND', '가게를 찾을 수 없습니다.');
  if (s.ownerId !== u.memberId) fail(403, 'FORBIDDEN', '내 가게가 아닙니다.');
  if (approved && s.approvalStatus !== 'APPROVED') fail(409, 'STORE_NOT_APPROVED', '승인된 가게만 이용할 수 있어요.');
  return s;
}
const findOrder = (s, orderId) => {
  const o = db.orders.find((x) => x.orderId === orderId && x.storeId === s.storeId);
  if (!o) fail(404, 'NOT_FOUND', '주문을 찾을 수 없습니다.');
  return o;
};
const findMenu = (s, menuId) => {
  const m = db.menus.find((x) => x.menuId === menuId && x.storeId === s.storeId && !x.del);
  if (!m) fail(404, 'NOT_FOUND', '메뉴를 찾을 수 없습니다.');
  return m;
};
const findGroup = (s, id) => {
  const g = db.groups.find((x) => x.optionGroupId === id && x.storeId === s.storeId && !x.del);
  if (!g) fail(404, 'NOT_FOUND', '옵션 그룹을 찾을 수 없습니다.');
  return g;
};
const findReview = (s, id) => {
  const r = db.reviews.find((x) => x.reviewId === id && x.storeId === s.storeId && !x.del);
  if (!r) fail(404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
  return r;
};
const alreadyProcessed = () => fail(409, 'ORDER_ALREADY_PROCESSED', '이미 처리된 주문입니다.');

/* 인증·가게 선택 */
on('POST', '/auth/login', (p, b) => {
  const u = db.users.find((x) => x.email === (b?.email || '').trim() && x.status === 'ACTIVE');
  if (!u || u.password !== b?.password) fail(401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 일치하지 않습니다.');
  db.session = u.memberId;
  return ok({ memberId: u.memberId, name: u.name, role: u.role });
});
on('POST', '/auth/logout', () => { db.session = null; return { status: 200, json: { success: true } }; });
on('GET', '/auth/me', () => { const u = me(); return ok({ memberId: u.memberId, name: u.name, role: u.role }); });
on('POST', '/auth/signup', (p, b) => {
  if (b.role !== 'OWNER') fail(400, 'VALIDATION_ERROR', '사장 가입만 지원합니다.');
  const fields = {};
  if (!/^\S+@\S+\.\S+$/.test(b.email || '')) fields.email = '이메일 형식이 아닙니다.';
  if (!b.password || b.password.length < 8) fields.password = '8자 이상 입력해 주세요.';
  if (isBlank(b.name)) fields.name = '이름을 입력해 주세요.';
  if (!/^010-\d{4}-\d{4}$/.test(b.tel || '')) fields.tel = '010-0000-0000 형식으로 입력해 주세요.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  validateStoreBody(b.store || {});
  if (db.users.some((u) => u.email === b.email.trim())) fail(409, 'DUPLICATE_EMAIL', '이미 가입된 이메일입니다.');
  if (db.stores.some((s) => s.bizNo === b.store.bizNo && !s.del)) fail(409, 'DUPLICATE_BIZ_NO', '이미 등록된 사업자번호입니다.');
  const user = { memberId: ++db.seq.member, email: b.email.trim(), password: b.password, name: b.name.trim(), tel: b.tel, role: 'OWNER', status: 'ACTIVE' };
  db.users.push(user);
  const store = { storeId: ++db.seq.store, ownerId: user.memberId, approvalStatus: 'PENDING', operStored: 'PAUSED', rejectReason: null, del: false };
  applyStoreBody(store, b.store);
  db.stores.push(store);
  return ok({ memberId: user.memberId, role: 'OWNER', storeId: store.storeId, approvalStatus: 'PENDING' }, 201);
});
on('DELETE', '/auth/me', (p, b) => {
  const u = me();
  if (u.role === 'ADMIN') fail(403, 'FORBIDDEN', '관리자는 탈퇴할 수 없습니다.');
  if (u.password !== b?.password) fail(401, 'PASSWORD_MISMATCH', '비밀번호가 일치하지 않습니다.');
  const stores = db.stores.filter((s) => s.ownerId === u.memberId && !s.del);
  const ids = stores.map((s) => s.storeId);
  if (db.orders.some((o) => ids.includes(o.storeId) && ['WAIT', 'COOKING', 'READY', 'DELIVERING'].includes(o.status))) {
    fail(409, 'HAS_ACTIVE_ORDERS', '진행 중인 주문이 있어 탈퇴할 수 없습니다.');
  }
  if (stores.some((s) => s.operStored === 'OPEN')) fail(409, 'STORE_STILL_OPEN', '영업중인 가게가 있습니다. 먼저 일시중지해 주세요.');
  Object.assign(u, { status: 'WITHDRAWN', name: '탈퇴회원', tel: null, password: null, email: `withdrawn_${u.memberId}@deleted.local` });
  stores.forEach((s) => { s.del = true; });
  db.session = null;
  return ok({ withdrawnAt: dt(Date.now()), expiredPoint: 0 });
});
on('GET', '/owner/stores', () => {
  const u = owner();
  return ok(db.stores.filter((s) => s.ownerId === u.memberId && !s.del).map((s) => ({
    storeId: s.storeId, storeName: s.storeName, approvalStatus: s.approvalStatus, operStatus: operStatus(s),
    rejectReason: s.approvalStatus === 'REJECTED' ? s.rejectReason : null,
    waitingOrderCount: db.orders.filter((o) => o.storeId === s.storeId && o.status === 'WAIT').length,
  })));
});
on('POST', '/owner/stores', (p, b) => {
  const u = owner();
  validateStoreBody(b);
  if (db.stores.some((s) => s.bizNo === b.bizNo && !s.del)) fail(409, 'DUPLICATE_BIZ_NO', '이미 등록된 사업자번호입니다.');
  const store = { storeId: ++db.seq.store, ownerId: u.memberId, approvalStatus: 'PENDING', operStored: 'PAUSED', rejectReason: null, del: false };
  applyStoreBody(store, b);
  db.stores.push(store);
  return ok({ storeId: store.storeId, approvalStatus: 'PENDING' }, 201);
});
on('PUT', '/owner/stores/:storeId/application', ({ storeId }, b) => {
  const s = myStore(storeId, { approved: false });
  if (s.approvalStatus !== 'REJECTED') fail(409, 'NOT_REJECTED', '반려된 가게만 재신청할 수 있습니다.');
  validateStoreBody(b);
  if (db.stores.some((x) => x.bizNo === b.bizNo && x.storeId !== s.storeId && !x.del)) fail(409, 'DUPLICATE_BIZ_NO', '이미 등록된 사업자번호입니다.');
  applyStoreBody(s, b);
  s.approvalStatus = 'PENDING';
  s.rejectReason = null;
  return ok({ storeId: s.storeId, approvalStatus: 'PENDING' });
});

/* 가게 정보·영업 상태 */
on('GET', '/owner/stores/:storeId', ({ storeId }) => ok(storeOut(myStore(storeId, { approved: false }))));
on('PATCH', '/owner/stores/:storeId', ({ storeId }, b) => {
  const s = myStore(storeId);
  const locked = ['storeName', 'bizNo', 'address', 'addressDetail', 'lat', 'lng', 'categoryCode'].filter((k) => k in b);
  if (locked.length) fail(400, 'VALIDATION_ERROR', '승인 정보는 바꿀 수 없습니다.');
  const fields = {};
  if ('minOrderAmount' in b && !(b.minOrderAmount >= 0)) fields.minOrderAmount = '0 이상이어야 합니다.';
  if ('deliveryTip' in b && !(b.deliveryTip >= 0)) fields.deliveryTip = '0 이상이어야 합니다.';
  if ('cookMinutes' in b && !(b.cookMinutes >= 1)) fields.cookMinutes = '1 이상이어야 합니다.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  ['minOrderAmount', 'deliveryTip', 'cookMinutes', 'telNo', 'description'].forEach((k) => { if (k in b) s[k] = b[k]; });
  return ok(storeOut(s));
});
on('PATCH', '/owner/stores/:storeId/oper-status', ({ storeId }, b) => {
  const s = myStore(storeId);
  if (!['OPEN', 'PAUSED'].includes(b?.operStatus)) fail(400, 'VALIDATION_ERROR', 'OPEN 또는 PAUSED만 보낼 수 있습니다.');
  if (b.operStatus === 'OPEN' && !db.menus.some((m) => m.storeId === s.storeId && !m.del && m.saleStatus === 'ON_SALE')) {
    fail(409, 'NO_MENU_ON_SALE', '판매중인 메뉴가 없어 영업을 시작할 수 없습니다.');
  }
  s.operStored = b.operStatus;
  return ok({ operStatus: b.operStatus });
});
on('PUT', '/owner/stores/:storeId/hours', ({ storeId }, b) => {
  const s = myStore(storeId);
  validateHours(b?.hours);
  db.hours[s.storeId] = b.hours.map((h) => ({ dayOfWeek: h.dayOfWeek, open: h.open, close: h.close }));
  return ok(storeOut(s));
});

/* 메뉴·옵션 */
on('GET', '/owner/stores/:storeId/menus', ({ storeId }) => ok(menusOut(myStore(storeId).storeId)));
on('PATCH', '/owner/stores/:storeId/menus/order', ({ storeId }, b) => {
  const s = myStore(storeId);
  for (const c of b.categories || []) if (!db.categories.some((x) => x.categoryId === c.categoryId && x.storeId === s.storeId && !x.del)) fail(403, 'FORBIDDEN', '내 가게 분류가 아닙니다.');
  for (const it of b.items || []) if (!db.menus.some((x) => x.menuId === it.menuId && x.storeId === s.storeId && !x.del)) fail(403, 'FORBIDDEN', '내 가게 메뉴가 아닙니다.');
  (b.categories || []).forEach((c) => { db.categories.find((x) => x.categoryId === c.categoryId).seq = c.seq; });
  (b.items || []).forEach((it) => Object.assign(db.menus.find((x) => x.menuId === it.menuId), { categoryId: it.categoryId, seq: it.seq }));
  return ok(menusOut(s.storeId));
});
on('GET', '/owner/stores/:storeId/menus/:menuId', ({ storeId, menuId }) => ok(menuDetail(findMenu(myStore(storeId), menuId))));
on('POST', '/owner/stores/:storeId/menus', ({ storeId }, b) => {
  const s = myStore(storeId);
  const fields = {};
  const cat = db.categories.find((c) => c.categoryId === Number(b.categoryId) && c.storeId === s.storeId && !c.del);
  if (!cat) fields.categoryId = '분류를 골라 주세요.';
  if (isBlank(b.menuName)) fields.menuName = '메뉴명을 입력해 주세요.';
  else if (b.menuName.length > 50) fields.menuName = '50자 이내로 입력해 주세요.';
  if (!(Number(b.price) >= 0) || isBlank(b.price)) fields.price = '0 이상이어야 합니다.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  const last = db.menus.filter((m) => m.categoryId === cat.categoryId && !m.del).reduce((mx, m) => Math.max(mx, m.seq), 0);
  const m = { menuId: ++db.seq.menu, storeId: s.storeId, categoryId: cat.categoryId, menuName: b.menuName.trim(), price: Number(b.price), description: b.description || '', saleStatus: 'ON_SALE', seq: b.seq ?? last + 1, del: false };
  db.menus.push(m);
  return ok(menuDetail(m), 201);
});
on('PATCH', '/owner/stores/:storeId/menus/:menuId', ({ storeId, menuId }, b) => {
  const s = myStore(storeId);
  const m = findMenu(s, menuId);
  const fields = {};
  if ('categoryId' in b && !db.categories.some((c) => c.categoryId === Number(b.categoryId) && c.storeId === s.storeId && !c.del)) fields.categoryId = '이 가게의 분류가 아닙니다.';
  if ('menuName' in b && isBlank(b.menuName)) fields.menuName = '메뉴명을 입력해 주세요.';
  if ('price' in b && !(Number(b.price) >= 0)) fields.price = '0 이상이어야 합니다.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  if ('categoryId' in b) m.categoryId = Number(b.categoryId);
  if ('menuName' in b) m.menuName = b.menuName.trim();
  if ('price' in b) m.price = Number(b.price);
  if ('description' in b) m.description = b.description;
  if ('seq' in b) m.seq = b.seq;
  return ok(menuDetail(m));
});
on('DELETE', '/owner/stores/:storeId/menus/:menuId', ({ storeId, menuId }) => {
  const m = findMenu(myStore(storeId), menuId);
  m.del = true;
  db.groups.filter((g) => g.menuId === m.menuId).forEach((g) => {
    g.del = true;
    db.options.filter((o) => o.optionGroupId === g.optionGroupId).forEach((o) => { o.del = true; });
  });
  return ok(null);
});
on('PATCH', '/owner/stores/:storeId/menus/:menuId/sale-status', ({ storeId, menuId }, b) => {
  const m = findMenu(myStore(storeId), menuId);
  if (!['ON_SALE', 'SOLD_OUT'].includes(b?.saleStatus)) fail(400, 'VALIDATION_ERROR', 'ON_SALE 또는 SOLD_OUT만 보낼 수 있습니다.');
  m.saleStatus = b.saleStatus;
  return ok({ menuId: m.menuId, saleStatus: m.saleStatus });
});
on('POST', '/owner/stores/:storeId/menus/:menuId/option-groups', ({ storeId, menuId }, b) => {
  const s = myStore(storeId);
  const m = findMenu(s, menuId);
  const fields = {};
  if (isBlank(b.groupName)) fields.groupName = '그룹 이름을 입력해 주세요.';
  if (typeof b.required !== 'boolean') fields.required = '필수 여부를 골라 주세요.';
  if (!(Number(b.maxSelect) >= 1)) fields.maxSelect = '1 이상이어야 합니다.';
  (b.options || []).forEach((o, i) => { if (isBlank(o.optionName) || !(Number(o.price) >= 0)) fields[`options.${i}`] = '옵션 이름과 0 이상의 금액을 입력해 주세요.'; });
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  const last = db.groups.filter((g) => g.menuId === m.menuId && !g.del).reduce((mx, g) => Math.max(mx, g.seq), 0);
  const g = { optionGroupId: ++db.seq.group, menuId: m.menuId, storeId: s.storeId, groupName: b.groupName.trim(), required: b.required, maxSelect: Number(b.maxSelect), seq: b.seq ?? last + 1, del: false };
  db.groups.push(g);
  (b.options || []).forEach((o, i) => db.options.push({ optionId: ++db.seq.option, optionGroupId: g.optionGroupId, storeId: s.storeId, optionName: o.optionName.trim(), price: Number(o.price), seq: i + 1, del: false }));
  return ok(groupOut(g), 201);
});
on('PATCH', '/owner/stores/:storeId/option-groups/:groupId', ({ storeId, groupId }, b) => {
  const g = findGroup(myStore(storeId), groupId);
  if ('groupName' in b && isBlank(b.groupName)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { groupName: '그룹 이름을 입력해 주세요.' });
  if ('maxSelect' in b && !(Number(b.maxSelect) >= 1)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { maxSelect: '1 이상이어야 합니다.' });
  ['groupName', 'required', 'seq'].forEach((k) => { if (k in b) g[k] = b[k]; });
  if ('maxSelect' in b) g.maxSelect = Number(b.maxSelect);
  return ok(groupOut(g));
});
on('DELETE', '/owner/stores/:storeId/option-groups/:groupId', ({ storeId, groupId }) => {
  const g = findGroup(myStore(storeId), groupId);
  g.del = true;
  db.options.filter((o) => o.optionGroupId === g.optionGroupId).forEach((o) => { o.del = true; });
  return ok(null);
});
on('POST', '/owner/stores/:storeId/option-groups/:groupId/options', ({ storeId, groupId }, b) => {
  const s = myStore(storeId);
  const g = findGroup(s, groupId);
  const fields = {};
  if (isBlank(b.optionName)) fields.optionName = '옵션 이름을 입력해 주세요.';
  if (isBlank(b.price) || !(Number(b.price) >= 0)) fields.price = '0 이상이어야 합니다.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  const last = db.options.filter((o) => o.optionGroupId === g.optionGroupId && !o.del).reduce((mx, o) => Math.max(mx, o.seq), 0);
  const o = { optionId: ++db.seq.option, optionGroupId: g.optionGroupId, storeId: s.storeId, optionName: b.optionName.trim(), price: Number(b.price), seq: b.seq ?? last + 1, del: false };
  db.options.push(o);
  return ok(optionOut(o), 201);
});
const findOption = (s, id) => {
  const o = db.options.find((x) => x.optionId === id && x.storeId === s.storeId && !x.del);
  if (!o) fail(404, 'NOT_FOUND', '옵션을 찾을 수 없습니다.');
  return o;
};
on('PATCH', '/owner/stores/:storeId/options/:optionId', ({ storeId, optionId }, b) => {
  const o = findOption(myStore(storeId), optionId);
  if ('optionName' in b && isBlank(b.optionName)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { optionName: '옵션 이름을 입력해 주세요.' });
  if ('price' in b && !(Number(b.price) >= 0)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { price: '0 이상이어야 합니다.' });
  if ('optionName' in b) o.optionName = b.optionName.trim();
  if ('price' in b) o.price = Number(b.price);
  if ('seq' in b) o.seq = b.seq;
  return ok(optionOut(o));
});
on('DELETE', '/owner/stores/:storeId/options/:optionId', ({ storeId, optionId }) => {
  const s = myStore(storeId);
  const o = findOption(s, optionId);
  const g = db.groups.find((x) => x.optionGroupId === o.optionGroupId);
  const left = db.options.filter((x) => x.optionGroupId === o.optionGroupId && !x.del).length;
  if (g.required && left <= 1) fail(409, 'REQUIRED_GROUP_EMPTY', '필수 옵션 그룹에는 옵션이 하나 이상 있어야 합니다.');
  o.del = true;
  return ok(null);
});
on('GET', '/owner/stores/:storeId/menu-categories', ({ storeId }) => ok(categoriesOut(myStore(storeId).storeId)));
on('POST', '/owner/stores/:storeId/menu-categories', ({ storeId }, b) => {
  const s = myStore(storeId);
  if (isBlank(b.categoryName)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { categoryName: '분류 이름을 입력해 주세요.' });
  if (db.categories.some((c) => c.storeId === s.storeId && !c.del && c.categoryName === b.categoryName.trim())) fail(409, 'DUPLICATE_CATEGORY', '같은 이름의 분류가 있습니다.');
  const last = db.categories.filter((c) => c.storeId === s.storeId && !c.del).reduce((mx, c) => Math.max(mx, c.seq), 0);
  db.categories.push({ categoryId: ++db.seq.category, storeId: s.storeId, categoryName: b.categoryName.trim(), seq: b.seq ?? last + 1, del: false });
  return ok(categoriesOut(s.storeId), 201);
});
on('PATCH', '/owner/stores/:storeId/menu-categories/:categoryId', ({ storeId, categoryId }, b) => {
  const s = myStore(storeId);
  const c = db.categories.find((x) => x.categoryId === categoryId && x.storeId === s.storeId && !x.del);
  if (!c) fail(404, 'NOT_FOUND', '분류를 찾을 수 없습니다.');
  if ('categoryName' in b) {
    if (isBlank(b.categoryName)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { categoryName: '분류 이름을 입력해 주세요.' });
    if (db.categories.some((x) => x.storeId === s.storeId && !x.del && x.categoryId !== c.categoryId && x.categoryName === b.categoryName.trim())) fail(409, 'DUPLICATE_CATEGORY', '같은 이름의 분류가 있습니다.');
    c.categoryName = b.categoryName.trim();
  }
  if ('seq' in b) c.seq = b.seq;
  return ok(categoriesOut(s.storeId));
});
on('DELETE', '/owner/stores/:storeId/menu-categories/:categoryId', ({ storeId, categoryId }) => {
  const s = myStore(storeId);
  const c = db.categories.find((x) => x.categoryId === categoryId && x.storeId === s.storeId && !x.del);
  if (!c) fail(404, 'NOT_FOUND', '분류를 찾을 수 없습니다.');
  if (db.menus.some((m) => m.categoryId === c.categoryId && !m.del)) fail(409, 'CATEGORY_NOT_EMPTY', '메뉴가 남아 있는 분류는 지울 수 없습니다. 메뉴를 옮기거나 지운 뒤 다시 시도해 주세요.');
  c.del = true;
  return ok(null);
});

/* 주문 */
on('GET', '/owner/stores/:storeId/orders', ({ storeId }, b, q) => {
  const s = myStore(storeId);
  const statuses = (q.get('status') || '').split(',').filter(Boolean);
  if (!statuses.length) fail(400, 'VALIDATION_ERROR', 'status가 필요합니다.');
  let list = db.orders.filter((o) => o.storeId === s.storeId && statuses.includes(o.status));
  const paged = statuses.some((x) => x === 'DONE' || x === 'CANCEL');
  if (paged) {
    const date = q.get('date') || toDate(new Date());
    list = list.filter((o) => toDate(new Date(o.orderedAt)) === date);
  }
  list.sort((a, b2) => (statuses.includes('WAIT') ? a.orderedAt - b2.orderedAt : b2.orderedAt - a.orderedAt));
  const out = list.map((o) => orderSummary(o));
  return ok(paged ? paginate(out, q.get('page'), q.get('size')) : out);
});
on('GET', '/owner/stores/:storeId/orders/:orderId', ({ storeId, orderId }) => ok(orderDetail(findOrder(myStore(storeId), orderId))));
on('POST', '/owner/stores/:storeId/orders/:orderId/accept', ({ storeId, orderId }, b) => {
  const s = myStore(storeId);
  const o = findOrder(s, orderId);
  if (!(Number(b?.cookMinutes) >= 1)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { cookMinutes: '1 이상이어야 합니다.' });
  if (o.status !== 'WAIT') alreadyProcessed();
  const now = Date.now();
  Object.assign(o, { status: 'COOKING', acceptedAt: now, cookMinutes: Number(b.cookMinutes) });
  return ok({ orderId: o.orderId, status: 'COOKING', acceptedAt: dt(now), cookMinutes: o.cookMinutes });
});
function cancelBody(b, allowed) {
  if (!allowed.includes(b?.reason)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { reason: '사유를 골라 주세요.' });
  if (b.reason === 'ETC' && isBlank(b.reasonDetail)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { reasonDetail: '사유를 직접 입력해 주세요.' });
}
on('POST', '/owner/stores/:storeId/orders/:orderId/reject', ({ storeId, orderId }, b) => {
  const s = myStore(storeId);
  const o = findOrder(s, orderId);
  cancelBody(b, ['OUT_OF_STOCK', 'BUSY', 'CLOSING', 'ETC']);
  if (o.status !== 'WAIT') alreadyProcessed();
  const now = Date.now();
  Object.assign(o, { status: 'CANCEL', canceledAt: now, cancelActor: 'OWNER', cancelReason: b.reason, cancelReasonDetail: b.reasonDetail || null });
  (b.soldOutMenuIds || []).forEach((id) => { const m = db.menus.find((x) => x.menuId === id && x.storeId === s.storeId); if (m) m.saleStatus = 'SOLD_OUT'; });
  return ok({ orderId: o.orderId, status: 'CANCEL', canceledAt: dt(now) });
});
on('POST', '/owner/stores/:storeId/orders/:orderId/cooked', ({ storeId, orderId }) => {
  const o = findOrder(myStore(storeId), orderId);
  if (o.status !== 'COOKING') alreadyProcessed();
  o.status = 'READY';
  o.readyAt = Date.now();
  return ok({ orderId: o.orderId, status: 'READY' });
});
on('POST', '/owner/stores/:storeId/orders/:orderId/cancel', ({ storeId, orderId }, b) => {
  const o = findOrder(myStore(storeId), orderId);
  cancelBody(b, ['OUT_OF_STOCK', 'CANNOT_COOK', 'ETC']);
  if (o.status !== 'COOKING') alreadyProcessed();
  const now = Date.now();
  Object.assign(o, { status: 'CANCEL', canceledAt: now, cancelActor: 'OWNER', cancelReason: b.reason, cancelReasonDetail: b.reasonDetail || null });
  return ok({ orderId: o.orderId, status: 'CANCEL', canceledAt: dt(now) });
});

/* 리뷰 */
on('GET', '/owner/stores/:storeId/reviews', ({ storeId }, b, q) => {
  const s = myStore(storeId);
  let list = db.reviews.filter((r) => r.storeId === s.storeId && !r.del).sort((a, b2) => b2.createdAt - a.createdAt);
  if (q.get('noReply') === 'true') list = list.filter((r) => !r.reply || r.reply.del);
  return ok({ avgRating: avgRating(s.storeId), reviewCount: liveReviews(s.storeId).length, ...paginate(list.map(reviewOut), q.get('page'), q.get('size')) });
});
const replyOut = (r) => ({ replyId: r.reply.replyId, content: r.reply.content, createdAt: dt(r.reply.createdAt) });
const checkReplyContent = (b) => {
  if (isBlank(b?.content)) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { content: '답글을 입력해 주세요.' });
  if (b.content.length > 1000) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { content: '1000자 이내로 입력해 주세요.' });
};
on('POST', '/owner/stores/:storeId/reviews/:reviewId/reply', ({ storeId, reviewId }, b) => {
  const r = findReview(myStore(storeId), reviewId);
  if (r.hidden) fail(409, 'REVIEW_UNAVAILABLE', '숨김 처리된 리뷰입니다.');
  checkReplyContent(b);
  if (r.reply && !r.reply.del) fail(409, 'REPLY_EXISTS', '이미 답글이 있어요. 수정해 주세요.');
  const now = Date.now();
  if (r.reply) Object.assign(r.reply, { content: b.content.trim(), createdAt: now, del: false }); // 삭제된 답글 되살리기
  else r.reply = { replyId: ++db.seq.reply, content: b.content.trim(), createdAt: now, del: false };
  return ok(replyOut(r), 201);
});
on('PATCH', '/owner/stores/:storeId/reviews/:reviewId/reply', ({ storeId, reviewId }, b) => {
  const r = findReview(myStore(storeId), reviewId);
  if (r.hidden) fail(409, 'REVIEW_UNAVAILABLE', '숨김 처리된 리뷰입니다.');
  if (!r.reply || r.reply.del) fail(404, 'NOT_FOUND', '답글이 없습니다.');
  checkReplyContent(b);
  r.reply.content = b.content.trim();
  return ok(replyOut(r));
});
on('DELETE', '/owner/stores/:storeId/reviews/:reviewId/reply', ({ storeId, reviewId }) => {
  const r = findReview(myStore(storeId), reviewId);
  if (!r.reply || r.reply.del) fail(404, 'NOT_FOUND', '답글이 없습니다.');
  r.reply.del = true;
  return ok(null);
});
on('POST', '/owner/stores/:storeId/reviews/:reviewId/report', ({ storeId, reviewId }, b) => {
  const s = myStore(storeId);
  const r = findReview(s, reviewId);
  if (r.hidden) fail(409, 'REVIEW_UNAVAILABLE', '숨김 처리된 리뷰입니다.');
  if (db.reports.some((p) => p.reviewId === r.reviewId)) fail(409, 'ALREADY_REPORTED', '이미 신고한 리뷰입니다.');
  const fields = {};
  if (!['ABUSE', 'FALSE', 'UNRELATED', 'ETC'].includes(b?.reason)) fields.reason = '신고 사유를 골라 주세요.';
  if (isBlank(b?.content)) fields.content = '신고 내용을 입력해 주세요.';
  else if (b.content.length > 300) fields.content = '300자 이내로 입력해 주세요.';
  if (Object.keys(fields).length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields);
  const p = { reportId: ++db.seq.report, storeId: s.storeId, reviewId: r.reviewId, reason: b.reason, content: b.content.trim(), reportedAt: Date.now(), status: 'PENDING', processedAt: null, processNote: null };
  db.reports.push(p);
  return ok({ reportId: p.reportId, status: 'PENDING' }, 201);
});
on('GET', '/owner/stores/:storeId/reports', ({ storeId }, b, q) => {
  const s = myStore(storeId);
  const list = db.reports.filter((p) => p.storeId === s.storeId).sort((a, b2) => b2.reportedAt - a.reportedAt).map((p) => ({
    reportId: p.reportId, reviewId: p.reviewId, reviewContent: db.reviews.find((r) => r.reviewId === p.reviewId)?.content ?? null,
    reason: p.reason, reportedAt: dt(p.reportedAt), status: p.status, processedAt: dt(p.processedAt), processNote: p.processNote,
  }));
  return ok(paginate(list, q.get('page'), q.get('size')));
});

/* 매출 통계 */
function rangeOf(q) {
  const from = q.get('from');
  const to = q.get('to');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || from > to) fail(400, 'VALIDATION_ERROR', '기간을 확인해 주세요.');
  const f = parseDT(from);
  const t = parseDT(to);
  if ((t - f) / (24 * 60 * MIN) > 366) fail(400, 'VALIDATION_ERROR', '기간은 최대 1년입니다.');
  return { from, to, f, t };
}
on('GET', '/owner/stores/:storeId/sales', ({ storeId }, b, q) => {
  const s = myStore(storeId);
  const unit = q.get('unit');
  if (!['day', 'month'].includes(unit)) fail(400, 'VALIDATION_ERROR', 'unit은 day 또는 month입니다.');
  const { from, to, f, t } = rangeOf(q);
  const inRange = (ms) => { const d = toDate(new Date(ms)); return d >= from && d <= to; };
  const done = db.orders.filter((o) => o.storeId === s.storeId && o.status === 'DONE' && inRange(o.completedAt));
  const keyOf = (ms) => (unit === 'day' ? toDate(new Date(ms)) : toDate(new Date(ms)).slice(0, 7));
  const buckets = new Map();
  for (let d = new Date(f); d <= t; d.setDate(d.getDate() + 1)) {
    const k = unit === 'day' ? toDate(d) : toDate(d).slice(0, 7);
    if (!buckets.has(k)) buckets.set(k, { period: k, orderCount: 0, salesAmount: 0, deliveryTipTotal: 0, avgOrderAmount: 0 });
  }
  for (const o of done) {
    const row = buckets.get(keyOf(o.completedAt));
    if (!row) continue;
    row.orderCount += 1;
    row.salesAmount += orderTotal(o);
    row.deliveryTipTotal += o.deliveryTip;
  }
  const rows = [...buckets.values()].map((r) => ({ ...r, avgOrderAmount: r.orderCount ? Math.round(r.salesAmount / r.orderCount) : 0 }));
  const sum = rows.reduce((a, r) => ({ orderCount: a.orderCount + r.orderCount, salesAmount: a.salesAmount + r.salesAmount, deliveryTipTotal: a.deliveryTipTotal + r.deliveryTipTotal }), { orderCount: 0, salesAmount: 0, deliveryTipTotal: 0 });
  const byOrderedAt = db.orders.filter((o) => o.storeId === s.storeId && inRange(o.orderedAt));
  const acceptedCount = byOrderedAt.filter((o) => o.acceptedAt).length;
  const rejectedCount = byOrderedAt.filter((o) => o.cancelActor === 'OWNER' && !o.acceptedAt).length;
  const autoCanceledCount = byOrderedAt.filter((o) => o.cancelActor === 'SYSTEM').length;
  const denom = acceptedCount + rejectedCount + autoCanceledCount;
  return ok({
    summary: { ...sum, avgOrderAmount: sum.orderCount ? Math.round(sum.salesAmount / sum.orderCount) : 0, acceptRate: denom ? acceptedCount / denom : null, acceptedCount, rejectedCount, autoCanceledCount },
    rows,
  });
});
on('GET', '/owner/stores/:storeId/sales/menus', ({ storeId }, b, q) => {
  const s = myStore(storeId);
  const { from, to } = rangeOf(q);
  const done = db.orders.filter((o) => o.storeId === s.storeId && o.status === 'DONE' && toDate(new Date(o.completedAt)) >= from && toDate(new Date(o.completedAt)) <= to);
  const map = new Map();
  for (const o of done) for (const it of o.items) {
    const row = map.get(it.menuName) || { menuName: it.menuName, quantity: 0, salesAmount: 0 };
    row.quantity += it.quantity;
    row.salesAmount += lineTotal(it);
    map.set(it.menuName, row);
  }
  const total = [...map.values()].reduce((a, r) => a + r.salesAmount, 0);
  return ok([...map.values()].sort((a, b2) => b2.salesAmount - a.salesAmount).map((r, i) => ({ rank: i + 1, ...r, ratio: total ? Math.round((r.salesAmount / total) * 100) / 100 : 0 })));
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
