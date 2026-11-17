import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson, created } from "#lib/http";
import { ownStore, menus, menuValues, categoryForMenu, menuDetail, bodyInt } from "#lib/owner-menus";



export const GET = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  return menus(storeId);
});

export const POST = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  const values = menuValues(await readJson(request), true);
  const result = db.transaction(() => {
    ownStore(owner, storeId);
    categoryForMenu(storeId, values.CTGR_ID);
    const seq = values.MENU_SEQ ?? bodyInt(db.prepare("SELECT COALESCE(MAX(MENU_SEQ), 0) + 1 AS seq FROM TB_MENU WHERE CTGR_ID = ? AND DEL_YN = 'N'").get(values.CTGR_ID).seq, "seq");
    const { lastInsertRowid } = db.prepare(`INSERT INTO TB_MENU (STORE_ID, CTGR_ID, MENU_NM, MENU_AMT, MENU_CN, MENU_SEQ)
      VALUES (?, ?, ?, ?, ?, ?)`).run(storeId, values.CTGR_ID, values.MENU_NM, values.MENU_AMT, values.MENU_CN ?? null, seq);
    return menuDetail(Number(lastInsertRowid));
  })();
  return created(result);
});
