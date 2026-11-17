import db from "@/lib/db";
import { fail, forbidden, invalid, notFound, num, oneOf, str } from "@/lib/server/http";

export const memberData = (member) => ({ memberId: member.MBR_ID, name: member.MBR_NM, role: member.MBR_ROLE_CD });

export function passwordInput(value, field, min = 1) {
  if (typeof value !== "string" || value.length < min) invalid(field, `${min}자 이상의 문자열이어야 합니다.`);
  return value;
}

export function storeInput(body, prefix = "") {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid(prefix || "store", "가게 정보 객체가 필요합니다.");
  const field = (key) => `${prefix}${key}`;
  const number = (key, min, max, integer = false) => {
    if (typeof body[key] !== "number" || (integer && !Number.isSafeInteger(body[key]))) invalid(field(key), integer ? "정수여야 합니다." : "숫자여야 합니다.");
    return num(body[key], field(key), { min, max });
  };
  const optional = (key) => {
    if (body[key] === undefined) return null;
    if (typeof body[key] !== "string") invalid(field(key), "문자열이어야 합니다.");
    return body[key].trim();
  };
  const data = {
    storeName: str(body.storeName, field("storeName")),
    categoryCode: oneOf(body.categoryCode, field("categoryCode"), ["CHICKEN", "PIZZA", "KOREAN", "CHINESE", "JAPANESE", "SNACK", "CAFE", "ETC"]),
    bizNo: str(body.bizNo, field("bizNo"), { pattern: /^\d{3}-\d{2}-\d{5}$/ }),
    telNo: str(body.telNo, field("telNo")),
    address: str(body.address, field("address")),
    addressDetail: optional("addressDetail"),
    lat: number("lat", -90, 90),
    lng: number("lng", -180, 180),
    minOrderAmount: number("minOrderAmount", 0, undefined, true),
    deliveryTip: number("deliveryTip", 0, undefined, true),
    cookMinutes: number("cookMinutes", 1, undefined, true),
    description: optional("description"),
  };
  const badHours = () => fail(400, "INVALID_HOURS", "영업시간을 확인해 주세요.", { [field("hours")]: "요일과 시간 형식이 올바르고 구간이 겹치지 않아야 합니다." });
  if (!Array.isArray(body.hours) || body.hours.length === 0) badHours();
  const hours = body.hours.map((hour) => {
    if (!hour || typeof hour !== "object" || !Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6 ||
      typeof hour.open !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hour.open) ||
      typeof hour.close !== "string" || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(hour.close) || hour.open >= hour.close) badHours();
    return { dayOfWeek: hour.dayOfWeek, open: hour.open, close: hour.close };
  }).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.open.localeCompare(b.open));
  for (let i = 1; i < hours.length; i++) {
    if (hours[i].dayOfWeek === hours[i - 1].dayOfWeek && hours[i].open < hours[i - 1].close) badHours();
  }
  return { ...data, hours };
}

// 호출자가 회원 생성까지 포함한 트랜잭션을 연다.
export function saveStoreApplication(ownerId, data, storeId) {
  if (storeId !== undefined) {
    const store = db.prepare("SELECT * FROM TB_STORE WHERE STORE_ID = ? AND DEL_YN = 'N'").get(storeId);
    if (!store) notFound();
    if (store.OWNR_MBR_ID !== ownerId) forbidden();
    if (store.STORE_APRV_STTS !== "REJECTED") fail(409, "NOT_REJECTED", "반려된 가게만 재신청할 수 있습니다.");
  }
  if (db.prepare("SELECT 1 FROM TB_STORE WHERE BIZ_NO = ? AND STORE_ID <> ?").get(data.bizNo, storeId ?? 0)) {
    fail(409, "DUPLICATE_BIZ_NO", "이미 등록된 사업자번호입니다.");
  }
  const values = [data.storeName, data.categoryCode, data.bizNo, data.telNo, data.address, data.addressDetail,
    data.lat, data.lng, data.minOrderAmount, data.deliveryTip, data.cookMinutes, data.description];
  try {
    if (storeId === undefined) {
      storeId = Number(db.prepare(`INSERT INTO TB_STORE
        (STORE_NM, STORE_CTGR_CD, BIZ_NO, STORE_TELNO, STORE_ADDR, STORE_DADDR, STORE_LAT, STORE_LNG,
         MIN_ORD_AMT, DLVR_TIP_AMT, COOK_EST_MI, STORE_CN, OWNR_MBR_ID, STORE_OPER_STTS, STORE_APRV_STTS)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAUSED', 'PENDING')`).run(...values, ownerId).lastInsertRowid);
    } else {
      db.prepare(`UPDATE TB_STORE SET STORE_NM = ?, STORE_CTGR_CD = ?, BIZ_NO = ?, STORE_TELNO = ?, STORE_ADDR = ?,
        STORE_DADDR = ?, STORE_LAT = ?, STORE_LNG = ?, MIN_ORD_AMT = ?, DLVR_TIP_AMT = ?, COOK_EST_MI = ?,
        STORE_CN = ?, STORE_APRV_STTS = 'PENDING' WHERE STORE_ID = ?`).run(...values, storeId);
      db.prepare("DELETE FROM TB_STORE_HOURS WHERE STORE_ID = ?").run(storeId);
    }
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE" && error.message.includes("TB_STORE.BIZ_NO")) fail(409, "DUPLICATE_BIZ_NO", "이미 등록된 사업자번호입니다.");
    throw error;
  }
  const insertHour = db.prepare("INSERT INTO TB_STORE_HOURS (STORE_ID, DAY_OF_WEEK, OPEN_TM, CLOSE_TM) VALUES (?, ?, ?, ?)");
  for (const hour of data.hours) insertHour.run(storeId, hour.dayOfWeek, hour.open, hour.close);
  db.prepare("INSERT INTO TB_STORE_APRV (STORE_ID, STORE_APRV_STTS) VALUES (?, 'PENDING')").run(storeId);
  return { storeId, approvalStatus: "PENDING" };
}
