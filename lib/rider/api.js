// 라이더 화면 API 함수 모음. 함수 이름 옆 주석은 명세서 ID (라이더 API 명세서 D-01~D-09, 공통 A-01~A-03).
//
// 백엔드가 준비되기 전에는 가짜 서버(lib/rider/mock)로 동작한다.
// 백엔드를 붙일 때는 .env.local 에 NEXT_PUBLIC_USE_MOCK=false 를 넣으면 진짜 /api 로 요청한다.
// (Next.js와 백엔드 주소가 다르면 NEXT_PUBLIC_API_BASE 에 주소를 넣는다. 예: http://localhost:4000)

import { mockRequest } from './mock/server';

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

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
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return s ? `?${s}` : '';
};

/* ── 공통 인증 (사장·관리자 명세서 A 계열) ── */
export const login = (email, password) => request('POST', '/auth/login', { email, password }); // A-01
export const logout = () => request('POST', '/auth/logout'); // A-02
export const getMe = () => request('GET', '/auth/me'); // A-03

/* ── 가입, 내 정보 ── */
export const signupRider = (payload) => request('POST', '/auth/signup', { role: 'RIDER', ...payload }); // D-01
export const getRiderMe = () => request('GET', '/rider/me'); // D-02
export const updateRiderMe = (patch) => request('PATCH', '/rider/me', patch); // D-03

/* ── 배차 ── */
// lat, lng을 보내지 않으면 서버가 숭실대 좌표를 쓴다 (명세서 D-04 메모)
export const getDispatchRequests = (lat, lng) => request('GET', `/rider/dispatch-requests${qs({ lat, lng })}`); // D-04
export const acceptDelivery = (deliveryId) => request('POST', `/rider/deliveries/${deliveryId}/accept`); // D-05

/* ── 배달 진행 ── */
export const getCurrentDelivery = () => request('GET', '/rider/deliveries/current'); // D-06
export const pickupDelivery = (deliveryId) => request('POST', `/rider/deliveries/${deliveryId}/pickup`); // D-07
export const completeDelivery = (deliveryId) => request('POST', `/rider/deliveries/${deliveryId}/complete`); // D-08
export const getDeliveryHistory = (page = 1, size = 20) => request('GET', `/rider/deliveries/history${qs({ page, size })}`); // D-09
