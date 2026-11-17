import db from "#lib/db";
import { hashPassword, verifyPassword } from "#lib/password";
import { clearSessionCookie, requireRole } from "#lib/auth";
import { fail, handler, invalid, ok, readJson, str, TEL } from "#lib/http";
import { memberData, passwordInput } from "#lib/members";
import { expireWaitingOrders } from "#lib/orders";



export const GET = handler(({ request }) => memberData(requireRole(request)));

export const PATCH = handler(async ({ request }) => {
  requireRole(request);
  const body = await readJson(request);
  for (const key of ["email", "role"]) if (Object.hasOwn(body, key)) invalid(key, "변경할 수 없는 항목입니다.");
  if (!["name", "tel", "newPassword"].some((key) => Object.hasOwn(body, key))) invalid("body", "변경할 항목을 하나 이상 보내 주세요.");
  const updates = [];
  const values = [];
  if (Object.hasOwn(body, "name")) {
    updates.push("MBR_NM = ?");
    values.push(str(body.name, "name", { max: 50 }));
  }
  if (Object.hasOwn(body, "tel")) {
    updates.push("MBR_TELNO = ?");
    values.push(str(body.tel, "tel", { pattern: TEL }));
  }
  const changePassword = Object.hasOwn(body, "newPassword");
  let currentPassword;
  if (changePassword) {
    passwordInput(body.newPassword, "newPassword", 8);
    currentPassword = passwordInput(body.currentPassword, "currentPassword");
  }
  return db.transaction(() => {
    const member = requireRole(request);
    if (changePassword) {
      const stored = db.prepare("SELECT MBR_PWD FROM TB_MBR WHERE MBR_ID = ?").get(member.MBR_ID);
      if (!verifyPassword(currentPassword, stored.MBR_PWD)) fail(401, "PASSWORD_MISMATCH", "현재 비밀번호가 일치하지 않습니다.");
      updates.push("MBR_PWD = ?");
      values.push(hashPassword(body.newPassword));
    }
    db.prepare(`UPDATE TB_MBR SET ${updates.join(", ")} WHERE MBR_ID = ?`).run(...values, member.MBR_ID);
    return memberData(requireRole(request));
  }).immediate();
});

export const DELETE = handler(async ({ request }) => {
  requireRole(request, "CUSTOMER", "OWNER", "RIDER");
  const body = await readJson(request);
  const password = passwordInput(body.password, "password");
  expireWaitingOrders();
  const result = db.transaction(() => {
    const member = requireRole(request, "CUSTOMER", "OWNER", "RIDER");
    const stored = db.prepare("SELECT MBR_PWD FROM TB_MBR WHERE MBR_ID = ?").get(member.MBR_ID);
    if (!verifyPassword(password, stored.MBR_PWD)) fail(401, "PASSWORD_MISMATCH", "현재 비밀번호가 일치하지 않습니다.");
    let active;
    if (member.MBR_ROLE_CD === "CUSTOMER") {
      active = db.prepare("SELECT 1 FROM TB_ORD WHERE MBR_ID = ? AND ORD_STTS IN ('WAIT', 'COOKING', 'READY', 'DELIVERING') LIMIT 1").get(member.MBR_ID);
    } else if (member.MBR_ROLE_CD === "OWNER") {
      active = db.prepare(`SELECT 1 FROM TB_ORD o JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID
        WHERE s.OWNR_MBR_ID = ? AND o.ORD_STTS IN ('WAIT', 'COOKING', 'READY', 'DELIVERING') LIMIT 1`).get(member.MBR_ID);
    } else {
      active = db.prepare(`SELECT 1 FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
        WHERE d.RIDER_MBR_ID = ? AND d.DLVR_CMPL_DTTM IS NULL AND o.ORD_STTS <> 'CANCEL' LIMIT 1`).get(member.MBR_ID);
    }
    if (active) fail(409, "HAS_ACTIVE_ORDERS", "진행 중인 주문 또는 배달이 있어 탈퇴할 수 없습니다.");
    if (member.MBR_ROLE_CD === "OWNER" && db.prepare("SELECT 1 FROM TB_STORE WHERE OWNR_MBR_ID = ? AND DEL_YN = 'N' AND STORE_OPER_STTS = 'OPEN' LIMIT 1").get(member.MBR_ID)) {
      fail(409, "STORE_STILL_OPEN", "영업 중인 가게를 일시정지한 후 탈퇴해 주세요.");
    }
    if (member.PNT_BAL_AMT > 0) {
      db.prepare(`INSERT INTO TB_PNT_TXN (MBR_ID, PNT_TXN_TYPE_CD, PNT_TXN_AMT, PNT_BAL_AMT, PNT_TXN_STTS)
        VALUES (?, 'EXPIRE', ?, 0, 'COMPLETED')`).run(member.MBR_ID, member.PNT_BAL_AMT);
    }
    db.prepare(`UPDATE TB_MBR SET MBR_STTS = 'WITHDRAWN', MBR_WTHDR_DTTM = datetime('now', 'localtime'),
      MBR_NM = '탈퇴회원', MBR_PWD = NULL, MBR_TELNO = NULL, PNT_BAL_AMT = 0 WHERE MBR_ID = ?`).run(member.MBR_ID);
    db.prepare("UPDATE TB_MBR_ADDR SET DEL_YN = 'Y' WHERE MBR_ID = ? AND DEL_YN = 'N'").run(member.MBR_ID);
    db.prepare("DELETE FROM TB_CART WHERE MBR_ID = ?").run(member.MBR_ID);
    if (member.MBR_ROLE_CD === "OWNER") db.prepare("UPDATE TB_STORE SET DEL_YN = 'Y', STORE_OPER_STTS = 'PAUSED' WHERE OWNR_MBR_ID = ? AND DEL_YN = 'N'").run(member.MBR_ID);
    const withdrawn = db.prepare("SELECT MBR_WTHDR_DTTM FROM TB_MBR WHERE MBR_ID = ?").get(member.MBR_ID);
    return { withdrawnAt: withdrawn.MBR_WTHDR_DTTM, expiredPoint: member.PNT_BAL_AMT };
  }).immediate();
  return ok(result, { headers: { "Set-Cookie": clearSessionCookie() } });
});
