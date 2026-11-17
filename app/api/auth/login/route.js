import db from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { sessionCookie } from "@/lib/server/auth";
import { EMAIL, fail, handler, ok, readJson, str } from "@/lib/server/http";
import { memberData, passwordInput } from "@/lib/server/members";

export const runtime = "nodejs";

export const POST = handler(async ({ request }) => {
  const body = await readJson(request);
  const email = str(body.email, "email", { max: 100, pattern: EMAIL });
  const password = passwordInput(body.password, "password");
  const member = db.transaction(() => {
    const member = db.prepare("SELECT * FROM TB_MBR WHERE MBR_EMAIL = ? AND MBR_STTS = 'ACTIVE'").get(email);
    if (!member || !verifyPassword(password, member.MBR_PWD)) fail(401, "LOGIN_FAILED", "이메일 또는 비밀번호가 일치하지 않습니다.");
    db.prepare("UPDATE TB_MBR SET MBR_LOGIN_DTTM = datetime('now', 'localtime') WHERE MBR_ID = ?").run(member.MBR_ID);
    return member;
  }).immediate();
  return ok(memberData(member), { headers: { "Set-Cookie": sessionCookie(member.MBR_ID) } });
});
