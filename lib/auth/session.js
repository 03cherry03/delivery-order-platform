// 통합 로그인(/login)과 각 역할 화면이 같이 쓰는 로그인 도우미.
// 세션은 서버(/api/auth/*) 쿠키 하나로 관리되므로, 여기서는 "어디로 보낼지"만 정한다.

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000').trim().replace(/\/+$/, '');

// 역할별 화면 경로와 이름
export const ROLES = {
  CUSTOMER: { label: '고객', base: '/customer', home: '/customer' },
  OWNER: { label: '사장님', base: '/owner', home: '/owner/stores' },
  RIDER: { label: '라이더', base: '/rider', home: '/rider' },
  ADMIN: { label: '관리자', base: '/admin', home: '/admin/applications' },
};

// 주소가 어느 역할 화면인지 (/rider/history → RIDER). 해당 없으면 null
export function roleOfPath(path) {
  if (typeof path !== 'string') return null;
  const found = Object.entries(ROLES).find(([, r]) => path === r.base || path.startsWith(`${r.base}/`) || path.startsWith(`${r.base}?`));
  return found ? found[0] : null;
}

// 로그인 후 돌아갈 주소(next)가 이 역할에 맞는 안전한 주소인지 확인한다.
// 다른 사이트(//evil.com)나 다른 역할 화면, 로그인·가입 화면이면 null
export function safeNext(next, role) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  if (roleOfPath(next) !== role) return null;
  const base = ROLES[role].base;
  const path = next.split(/[?#]/)[0];
  if (path === `${base}/login` || path === `${base}/signup`) return null;
  return next;
}

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('API 서버에 연결할 수 없어요. npm run dev:server 가 켜져 있는지 확인해 주세요.');
    e.code = 'NETWORK_ERROR';
    throw e;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const e = new Error(json?.error?.message || '요청을 처리하지 못했어요.');
    e.status = res.status;
    e.code = json?.error?.code;
    throw e;
  }
  return json.data;
}

export const login = (email, password) => call('POST', '/auth/login', { email, password }); // A-01
export const logout = () => call('POST', '/auth/logout'); // A-02
export const getMe = () => call('GET', '/auth/me'); // A-03

// 로그인한 계정이 처음 갈 화면. 라이더는 배달 중이면 현재 배달 화면으로 보낸다.
export async function homeFor(user) {
  const role = ROLES[user?.role];
  if (!role) return '/login';
  if (user.role === 'RIDER') {
    const rider = await call('GET', '/rider/me').catch(() => null);
    if (rider?.riderStatus === 'BUSY') return '/rider/current';
  }
  return role.home;
}

// 지금 보고 있는 주소를 next로 붙인 통합 로그인 주소
export function loginUrl(next) {
  const here = next ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');
  return here && roleOfPath(here) ? `/login?next=${encodeURIComponent(here)}` : '/login';
}
