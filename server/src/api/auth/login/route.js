import db from "#lib/db";
import { verifyPassword } from "#lib/password";
import { sessionCookie } from "#lib/auth";
import { EMAIL, fail, handler, ok, readJson, str } from "#lib/http";
import { memberData, passwordInput } from "#lib/members";

const limitWindow = 10 * 60 * 1000;
const attempts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of attempts) {
    if (attempt.expiresAt <= now) attempts.delete(key);
  }
}, limitWindow).unref();

export const POST = handler(async ({ request }) => {
  const body = await readJson(request);
  const email = str(body.email, "email", { max: 100, pattern: EMAIL });
  const key = email.toLowerCase();
  const attempt = attempts.get(key);
  const remaining = (attempt?.lockedUntil ?? 0) - Date.now();
  if (remaining > 0) {
    return Response.json({
      success: false,
      error: { code: "LOGIN_LOCKED", message: `로그인 시도가 너무 많습니다. ${Math.ceil(remaining / 60_000)}분 후에 다시 시도해 주세요.` },
    }, { status: 429, headers: { "Retry-After": String(Math.ceil(remaining / 1000)) } });
  }
  const password = passwordInput(body.password, "password");
  const member = db.transaction(() => {
    const member = db.prepare("SELECT * FROM TB_MBR WHERE MBR_EMAIL = ? AND MBR_STTS = 'ACTIVE'").get(email);
    if (!member || !verifyPassword(password, member.MBR_PWD)) {
      const now = Date.now();
      const failures = attempt?.failures.filter((time) => now - time < limitWindow) ?? [];
      failures.push(now);
      const expiresAt = now + limitWindow;
      if (failures.length === 5) attempts.set(key, { failures: [], lockedUntil: expiresAt, expiresAt });
      else attempts.set(key, { failures, expiresAt });
      fail(401, "LOGIN_FAILED", "이메일 또는 비밀번호가 일치하지 않습니다.");
    }
    db.prepare("UPDATE TB_MBR SET MBR_LOGIN_DTTM = datetime('now', 'localtime') WHERE MBR_ID = ?").run(member.MBR_ID);
    return member;
  }).immediate();
  attempts.delete(key);
  return ok(memberData(member), { headers: { "Set-Cookie": sessionCookie(member.MBR_ID) } });
});
