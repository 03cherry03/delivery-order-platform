// 사장 화면 API 함수 모음. 함수 이름 옆 주석은 명세서 ID.
//
// 기본은 실제 API다. NEXT_PUBLIC_USE_MOCK=true일 때만 가짜 서버(lib/owner/mock)를 쓴다.
// 다른 API 주소를 쓸 때는 NEXT_PUBLIC_API_BASE에 넣는다.

import { mockRequest } from './mock/server';

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(status, error = {}) {
    super(error.message || '요청을 처리하지 못했어요.');
    this.status = status;
    this.code = error.code || 'UNKNOWN';
    this.fields = error.fields || null;
  }
}

async function request(method, path, body) {
  let status;
  let json;
  if (USE_MOCK) {
    ({ status, json } = await mockRequest(method, path, body));
  } else {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method,
      credentials: 'include', // 세션 쿠키
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    json = await res.json().catch(() => ({ success: false, error: { code: 'BAD_RESPONSE', message: '서버 응답을 읽지 못했어요.' } }));
  }
  if (!json || json.success === false) throw new ApiError(status, json?.error);
  return json.data;
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
};
const S = (storeId) => `/owner/stores/${storeId}`;

/* ── 인증·가게 선택 ── */
export const login = (email, password) => request('POST', '/auth/login', { email, password }); // A-01
export const logout = () => request('POST', '/auth/logout'); // A-02
export const getMe = () => request('GET', '/auth/me'); // A-03
export const getMyStores = () => request('GET', '/owner/stores'); // A-04
export const addStore = (store) => request('POST', '/owner/stores', store); // A-05 추가
export const reapplyStore = (storeId, store) => request('PUT', `${S(storeId)}/application`, store); // A-05 재신청
export const signupOwner = (payload) => request('POST', '/auth/signup', { role: 'OWNER', ...payload }); // A-06
export const withdraw = (password) => request('DELETE', '/auth/me', { password }); // A-07

/* ── 가게 정보·영업 상태 ── */
export const getStore = (storeId) => request('GET', S(storeId)); // S-01
export const updateStore = (storeId, patch) => request('PATCH', S(storeId), patch); // S-02
export const setOperStatus = (storeId, operStatus) => request('PATCH', `${S(storeId)}/oper-status`, { operStatus }); // S-03
export const saveHours = (storeId, hours) => request('PUT', `${S(storeId)}/hours`, { hours }); // S-04

/* ── 메뉴·옵션 ── */
export const getMenus = (storeId) => request('GET', `${S(storeId)}/menus`); // M-01
export const getMenu = (storeId, menuId) => request('GET', `${S(storeId)}/menus/${menuId}`); // M-02
export const createMenu = (storeId, menu) => request('POST', `${S(storeId)}/menus`, menu); // M-03
export const updateMenu = (storeId, menuId, patch) => request('PATCH', `${S(storeId)}/menus/${menuId}`, patch); // M-04
export const deleteMenu = (storeId, menuId) => request('DELETE', `${S(storeId)}/menus/${menuId}`); // M-05
export const setSaleStatus = (storeId, menuId, saleStatus) => request('PATCH', `${S(storeId)}/menus/${menuId}/sale-status`, { saleStatus }); // M-06
export const createOptionGroup = (storeId, menuId, group) => request('POST', `${S(storeId)}/menus/${menuId}/option-groups`, group); // M-07
export const updateOptionGroup = (storeId, groupId, patch) => request('PATCH', `${S(storeId)}/option-groups/${groupId}`, patch); // M-08
export const deleteOptionGroup = (storeId, groupId) => request('DELETE', `${S(storeId)}/option-groups/${groupId}`); // M-09
export const createOption = (storeId, groupId, option) => request('POST', `${S(storeId)}/option-groups/${groupId}/options`, option); // M-10
export const updateOption = (storeId, optionId, patch) => request('PATCH', `${S(storeId)}/options/${optionId}`, patch); // M-11
export const deleteOption = (storeId, optionId) => request('DELETE', `${S(storeId)}/options/${optionId}`); // M-12
export const saveMenuOrder = (storeId, payload) => request('PATCH', `${S(storeId)}/menus/order`, payload); // M-13
export const getCategories = (storeId) => request('GET', `${S(storeId)}/menu-categories`); // M-14
export const createCategory = (storeId, category) => request('POST', `${S(storeId)}/menu-categories`, category); // M-15
export const updateCategory = (storeId, categoryId, patch) => request('PATCH', `${S(storeId)}/menu-categories/${categoryId}`, patch); // M-16
export const deleteCategory = (storeId, categoryId) => request('DELETE', `${S(storeId)}/menu-categories/${categoryId}`); // M-17

/* ── 주문 ── */
export const getOrders = (storeId, params) => request('GET', `${S(storeId)}/orders${qs(params)}`); // O-01
export const getOrder = (storeId, orderId) => request('GET', `${S(storeId)}/orders/${orderId}`); // O-02
export const acceptOrder = (storeId, orderId, cookMinutes) => request('POST', `${S(storeId)}/orders/${orderId}/accept`, { cookMinutes }); // O-03
export const rejectOrder = (storeId, orderId, body) => request('POST', `${S(storeId)}/orders/${orderId}/reject`, body); // O-04
export const cookedOrder = (storeId, orderId) => request('POST', `${S(storeId)}/orders/${orderId}/cooked`); // O-05
export const cancelCookingOrder = (storeId, orderId, body) => request('POST', `${S(storeId)}/orders/${orderId}/cancel`, body); // O-06

/* ── 리뷰 ── */
export const getReviews = (storeId, params) => request('GET', `${S(storeId)}/reviews${qs(params)}`); // R-01
export const createReply = (storeId, reviewId, content) => request('POST', `${S(storeId)}/reviews/${reviewId}/reply`, { content }); // R-02
export const updateReply = (storeId, reviewId, content) => request('PATCH', `${S(storeId)}/reviews/${reviewId}/reply`, { content }); // R-03
export const deleteReply = (storeId, reviewId) => request('DELETE', `${S(storeId)}/reviews/${reviewId}/reply`); // R-04
export const reportReview = (storeId, reviewId, body) => request('POST', `${S(storeId)}/reviews/${reviewId}/report`, body); // R-05
export const getMyReports = (storeId, params) => request('GET', `${S(storeId)}/reports${qs(params)}`); // R-06

/* ── 매출 통계 ── */
export const getSales = (storeId, params) => request('GET', `${S(storeId)}/sales${qs(params)}`); // T-01
export const getMenuSales = (storeId, params) => request('GET', `${S(storeId)}/sales/menus${qs(params)}`); // T-02
