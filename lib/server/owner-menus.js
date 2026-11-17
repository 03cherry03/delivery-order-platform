import db from "@/lib/db";
import { requireOwnStore } from "@/lib/server/auth";
import { fail, forbidden, invalid, notFound, str } from "@/lib/server/http";
import { OPER_STATUS_SQL, storeHours } from "@/lib/server/stores";

export function ownStore(owner, storeId, approved = true) {
  const store = requireOwnStore(owner, storeId);
  if (approved && store.STORE_APRV_STTS !== "APPROVED") fail(409, "STORE_NOT_APPROVED", "승인된 가게만 관리할 수 있습니다.");
  return store;
}

export function fields(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("body", "객체여야 합니다.");
  for (const key of Object.keys(body)) if (!allowed.includes(key)) invalid(key, "허용되지 않은 필드입니다.");
}

export function bodyInt(value, field, min) {
  if (!Number.isSafeInteger(value)) invalid(field, "정수여야 합니다.");
  if (min !== undefined && value < min) invalid(field, `${min} 이상이어야 합니다.`);
  return value;
}

export function description(value, max) {
  if (value === null) return null;
  if (typeof value !== "string") invalid("description", "문자열 또는 null이어야 합니다.");
  if (max !== undefined && value.length > max) invalid("description", `최대 ${max}자입니다.`);
  return value;
}

export function menuValues(body, create = false) {
  fields(body, ["categoryId", "menuName", "price", "description", "seq"]);
  const values = {};
  if (create || "categoryId" in body) values.CTGR_ID = bodyInt(body.categoryId, "categoryId", 1);
  if (create || "menuName" in body) values.MENU_NM = str(body.menuName, "menuName", { max: 50 });
  if (create || "price" in body) values.MENU_AMT = bodyInt(body.price, "price", 0);
  if ("description" in body) values.MENU_CN = description(body.description, 300);
  if ("seq" in body) values.MENU_SEQ = bodyInt(body.seq, "seq");
  return values;
}

export function optionValues(body, create = false) {
  fields(body, ["optionName", "price", "seq"]);
  const values = {};
  if (create || "optionName" in body) values.OPT_NM = str(body.optionName, "optionName");
  if (create || "price" in body) values.OPT_AMT = bodyInt(body.price, "price", 0);
  if ("seq" in body) values.OPT_SEQ = bodyInt(body.seq, "seq");
  return values;
}

export function category(storeId, categoryId) {
  const row = db.prepare("SELECT * FROM TB_MENU_CTGR WHERE CTGR_ID = ? AND DEL_YN = 'N'").get(categoryId);
  if (!row) notFound();
  if (row.STORE_ID !== storeId) forbidden();
  return row;
}

export function categoryForMenu(storeId, categoryId) {
  if (!db.prepare("SELECT 1 FROM TB_MENU_CTGR WHERE CTGR_ID = ? AND STORE_ID = ? AND DEL_YN = 'N'").get(categoryId, storeId)) {
    invalid("categoryId", "이 가게의 미삭제 분류여야 합니다.");
  }
}

export function menu(storeId, menuId) {
  const row = db.prepare("SELECT * FROM TB_MENU WHERE MENU_ID = ? AND DEL_YN = 'N'").get(menuId);
  if (!row) notFound();
  if (row.STORE_ID !== storeId) forbidden();
  category(storeId, row.CTGR_ID);
  return row;
}

export function group(storeId, groupId) {
  const row = db.prepare("SELECT * FROM TB_MENU_OPT_GRP WHERE OPT_GRP_ID = ? AND DEL_YN = 'N'").get(groupId);
  if (!row) notFound();
  menu(storeId, row.MENU_ID);
  return row;
}

export function option(storeId, optionId) {
  const row = db.prepare("SELECT * FROM TB_MENU_OPT WHERE OPT_ID = ? AND DEL_YN = 'N'").get(optionId);
  if (!row) notFound();
  group(storeId, row.OPT_GRP_ID);
  return row;
}

export function storeDetail(storeId) {
  const row = db.prepare(`SELECT s.STORE_ID AS storeId, s.STORE_NM AS storeName,
    s.STORE_CTGR_CD AS categoryCode, s.BIZ_NO AS bizNo, s.STORE_TELNO AS telNo,
    s.STORE_ADDR AS address, s.STORE_DADDR AS addressDetail, s.STORE_LAT AS lat, s.STORE_LNG AS lng,
    s.MIN_ORD_AMT AS minOrderAmount, s.DLVR_TIP_AMT AS deliveryTip, s.COOK_EST_MI AS cookMinutes,
    s.STORE_CN AS description, s.STORE_APRV_STTS AS approvalStatus, ${OPER_STATUS_SQL("s")} AS operStatus,
    (SELECT count(*) FROM TB_MENU m WHERE m.STORE_ID = s.STORE_ID AND m.DEL_YN = 'N' AND m.MENU_SALE_STTS = 'ON_SALE') AS onSaleMenuCount,
    r.AVG_RTNG AS avgRating, COALESCE(r.RVW_CNT, 0) AS reviewCount
    FROM TB_STORE s LEFT JOIN V_STORE_RATING r ON r.STORE_ID = s.STORE_ID WHERE s.STORE_ID = ?`).get(storeId);
  return { ...row, ...storeHours(storeId), isOpenNow: row.operStatus === "OPEN" };
}

export function categories(storeId) {
  return db.prepare(`SELECT c.CTGR_ID AS categoryId, c.CTGR_NM AS categoryName, c.CTGR_SEQ AS seq,
    (SELECT count(*) FROM TB_MENU m WHERE m.CTGR_ID = c.CTGR_ID AND m.STORE_ID = c.STORE_ID AND m.DEL_YN = 'N') AS menuCount
    FROM TB_MENU_CTGR c WHERE c.STORE_ID = ? AND c.DEL_YN = 'N' ORDER BY c.CTGR_SEQ, c.CTGR_ID`).all(storeId);
}

export function menus(storeId) {
  const rows = db.prepare(`SELECT m.CTGR_ID AS categoryId, m.MENU_ID AS menuId, m.MENU_NM AS menuName,
    m.MENU_AMT AS price, m.MENU_CN AS description, m.MENU_SALE_STTS AS saleStatus, m.MENU_SEQ AS seq,
    (SELECT count(*) FROM TB_MENU_OPT_GRP g WHERE g.MENU_ID = m.MENU_ID AND g.DEL_YN = 'N') AS optionGroupCount
    FROM TB_MENU m WHERE m.STORE_ID = ? AND m.DEL_YN = 'N' ORDER BY m.MENU_SEQ, m.MENU_ID`).all(storeId);
  return categories(storeId).map(({ categoryId, categoryName, seq }) => ({
    categoryId, categoryName, seq,
    menus: rows.filter((m) => m.categoryId === categoryId).map(({ categoryId: _categoryId, ...item }) => item),
  }));
}

export function optionDetail(optionId) {
  return db.prepare("SELECT OPT_ID AS optionId, OPT_NM AS optionName, OPT_AMT AS price, OPT_SEQ AS seq FROM TB_MENU_OPT WHERE OPT_ID = ?").get(optionId);
}

export function groupDetail(groupId) {
  const row = db.prepare(`SELECT OPT_GRP_ID AS optionGroupId, OPT_GRP_NM AS groupName,
    RQRD_YN AS required, MAX_SLCT_CNT AS maxSelect, OPT_GRP_SEQ AS seq FROM TB_MENU_OPT_GRP WHERE OPT_GRP_ID = ?`).get(groupId);
  const options = db.prepare(`SELECT OPT_ID AS optionId, OPT_NM AS optionName, OPT_AMT AS price, OPT_SEQ AS seq
    FROM TB_MENU_OPT WHERE OPT_GRP_ID = ? AND DEL_YN = 'N' ORDER BY OPT_SEQ, OPT_ID`).all(groupId);
  return { ...row, required: row.required === "Y", options };
}

export function menuDetail(menuId) {
  const row = db.prepare(`SELECT m.MENU_ID AS menuId, m.CTGR_ID AS categoryId, c.CTGR_NM AS categoryName,
    m.MENU_NM AS menuName, m.MENU_AMT AS price, m.MENU_CN AS description, m.MENU_SALE_STTS AS saleStatus, m.MENU_SEQ AS seq
    FROM TB_MENU m JOIN TB_MENU_CTGR c ON c.CTGR_ID = m.CTGR_ID WHERE m.MENU_ID = ?`).get(menuId);
  const groups = db.prepare("SELECT OPT_GRP_ID FROM TB_MENU_OPT_GRP WHERE MENU_ID = ? AND DEL_YN = 'N' ORDER BY OPT_GRP_SEQ, OPT_GRP_ID").all(menuId);
  return { ...row, optionGroups: groups.map((g) => groupDetail(g.OPT_GRP_ID)) };
}

export function uniqueCategory(storeId, name, exceptId = 0) {
  if (db.prepare("SELECT 1 FROM TB_MENU_CTGR WHERE STORE_ID = ? AND CTGR_NM = ? AND CTGR_ID <> ? AND DEL_YN = 'N'").get(storeId, name, exceptId)) {
    fail(409, "DUPLICATE_CATEGORY", "같은 이름의 분류가 이미 있습니다.");
  }
}
