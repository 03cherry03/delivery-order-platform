import db from "#lib/db";
import { hashPassword } from "#lib/password";
import { created, EMAIL, fail, handler, int, invalid, oneOf, readJson, str, TEL } from "#lib/http";
import { passwordInput, saveStoreApplication, storeInput } from "#lib/members";



export const POST = handler(async ({ request }) => {
  const body = await readJson(request);
  const role = oneOf(body.role, "role", ["CUSTOMER", "OWNER", "RIDER"]);
  const email = str(body.email, "email", { max: 100, pattern: EMAIL });
  const password = passwordInput(body.password, "password", 8);
  const name = str(body.name, "name", { max: 50 });
  const tel = str(body.tel, "tel", { pattern: TEL });
  if (role === "CUSTOMER" && Object.hasOwn(body, "store")) invalid("store", "고객 가입에는 가게 정보를 보낼 수 없습니다.");
  const store = role === "OWNER" ? storeInput(body.store, "store.") : null;
  const vehicleType = role === "RIDER" ? oneOf(body.vehicleType, "vehicleType", ["WALK", "BICYCLE", "MOTORCYCLE", "CAR"]) : null;
  if (role === "RIDER" && body.actRadiusM !== undefined && typeof body.actRadiusM !== "number") invalid("actRadiusM", "정수여야 합니다.");
  const radius = role === "RIDER" ? int(body.actRadiusM === undefined ? 3000 : body.actRadiusM, "actRadiusM", { min: 500, max: 5000 }) : null;
  const passwordHash = hashPassword(password);
  const result = db.transaction(() => {
    if (db.prepare("SELECT 1 FROM TB_MBR WHERE MBR_EMAIL = ? AND MBR_STTS = 'ACTIVE'").get(email)) fail(409, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다.");
    let memberId;
    try {
      memberId = Number(db.prepare(`INSERT INTO TB_MBR (MBR_EMAIL, MBR_PWD, MBR_NM, MBR_TELNO, MBR_ROLE_CD, MBR_STTS, PNT_BAL_AMT)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0)`).run(email, passwordHash, name, tel, role).lastInsertRowid);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE" && error.message.includes("TB_MBR.MBR_EMAIL")) fail(409, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다.");
      throw error;
    }
    if (role === "RIDER") db.prepare("INSERT INTO TB_RIDER (MBR_ID, VHCL_TYPE_CD, ACT_RADIUS_M, RIDER_STTS) VALUES (?, ?, ?, 'IDLE')").run(memberId, vehicleType, radius);
    return { memberId, role, ...(store ? saveStoreApplication(memberId, store) : {}) };
  }).immediate();
  return created(result);
});
