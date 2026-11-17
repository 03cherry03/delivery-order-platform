import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson, str, fail } from "@/lib/server/http";
import { ownStore, category, categories, uniqueCategory, fields, bodyInt } from "@/lib/server/owner-menus";

export const runtime = "nodejs";

export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const categoryId = pathId(params.categoryId, "categoryId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["categoryName", "seq"]);
  const values = {};
  if ("categoryName" in body) values.CTGR_NM = str(body.categoryName, "categoryName", { max: 50 });
  if ("seq" in body) values.CTGR_SEQ = bodyInt(body.seq, "seq");
  return db.transaction(() => {
    ownStore(owner, storeId);
    category(storeId, categoryId);
    if ("CTGR_NM" in values) uniqueCategory(storeId, values.CTGR_NM, categoryId);
    const keys = Object.keys(values);
    if (keys.length) db.prepare(`UPDATE TB_MENU_CTGR SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE CTGR_ID = ?`).run(...Object.values(values), categoryId);
    return categories(storeId);
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const categoryId = pathId(params.categoryId, "categoryId");
  return db.transaction(() => {
    ownStore(owner, storeId);
    category(storeId, categoryId);
    if (db.prepare("SELECT 1 FROM TB_MENU WHERE CTGR_ID = ? AND DEL_YN = 'N'").get(categoryId)) fail(409, "CATEGORY_NOT_EMPTY", "메뉴가 남아 있는 분류는 삭제할 수 없습니다.");
    db.prepare("UPDATE TB_MENU_CTGR SET DEL_YN = 'Y' WHERE CTGR_ID = ?").run(categoryId);
    return null;
  })();
});
