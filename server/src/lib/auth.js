// 세션: HMAC-SHA256 서명 쿠키 delivery_session (docs/api/auth.md "세션 쿠키")
// 비밀키는 SESSION_SECRET 환경변수. 개발 모드에서만 없을 때 개발용 기본값을 쓴다.
import { createHmac, timingSafeEqual } from "node:crypto";
import db from "#lib/db";
import { fail, forbidden, notFound } from "#lib/http";

const COOKIE = "delivery_session";
const MAX_AGE = 86400; // 24시간 고정
const PRODUCTION = process.env.NODE_ENV === "production";
// 운영 모드에서 키가 없으면 이 모듈을 불러오는 순간 실패한다 → 서버가 시작되지 않는다(src/index.js 가 exit 1)
if (PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error("운영 모드(NODE_ENV=production)에는 SESSION_SECRET 환경변수가 필요합니다.");
}
const SECRET = process.env.SESSION_SECRET || "dev-only-session-secret-change-me";
const SECURE = PRODUCTION ? "; Secure" : "";

const sign = (payload) => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function sessionCookie(memberId) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ memberId, issuedAt, expiresAt: issuedAt + MAX_AGE })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${SECURE}`;
}

export const clearSessionCookie = () => `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${SECURE}`;

function readSession(request) {
  const raw = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [payload, signature] = raw?.split(".") ?? [];
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isSafeInteger(data.memberId) && data.expiresAt > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

// 로그인한 활성 회원을 읽고 역할을 확인한다. 역할을 생략하면 모든 역할 허용.
// 반환: TB_MBR 행 (MBR_PWD 제외)
export function requireRole(request, ...roles) {
  const session = readSession(request);
  const member = session && db.prepare(
    `SELECT MBR_ID, MBR_EMAIL, MBR_NM, MBR_TELNO, MBR_ROLE_CD, MBR_STTS, PNT_BAL_AMT, REG_DTTM
       FROM TB_MBR WHERE MBR_ID = ? AND MBR_STTS = 'ACTIVE'`,
  ).get(session.memberId);
  if (!member) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  if (roles.length && !roles.includes(member.MBR_ROLE_CD)) forbidden();
  return member;
}

// 사장 경로의 {storeId}: 없거나 삭제된 가게면 404, 남의 가게면 403.
export function requireOwnStore(owner, storeId) {
  const store = db.prepare("SELECT * FROM TB_STORE WHERE STORE_ID = ? AND DEL_YN = 'N'").get(storeId);
  if (!store) notFound("가게를 찾을 수 없습니다.");
  if (store.OWNR_MBR_ID !== owner.MBR_ID) forbidden("내 가게가 아닙니다.");
  return store;
}
