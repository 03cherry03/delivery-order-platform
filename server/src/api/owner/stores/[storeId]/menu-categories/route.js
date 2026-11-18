import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson, created, str } from "#lib/http";
import { ownStore, categories, uniqueCategory, fields, bodyInt } from "#lib/owner-menus";



export const GET = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  return categories(storeId);
});

export const POST = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["categoryName", "seq"]);
  const categoryName = str(body.categoryName, "categoryName", { max: 50 });
  const seq = "seq" in body ? bodyInt(body.seq, "seq") : undefined;
  const result = db.transaction(() => {
    ownStore(owner, storeId);
    uniqueCategory(storeId, categoryName);
    const categorySeq = seq ?? bodyInt(db.prepare("SELECT COALESCE(MAX(CTGR_SEQ), 0) + 1 AS seq FROM TB_MENU_CTGR WHERE STORE_ID = ? AND DEL_YN = 'N'").get(storeId).seq, "seq");
    db.prepare("INSERT INTO TB_MENU_CTGR (STORE_ID, CTGR_NM, CTGR_SEQ) VALUES (?, ?, ?)").run(storeId, categoryName, categorySeq);
    return categories(storeId);
  })();
  return created(result);
});
