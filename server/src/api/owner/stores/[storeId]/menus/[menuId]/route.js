import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson } from "#lib/http";
import { ownStore, menu, menuDetail, menuValues, categoryForMenu } from "#lib/owner-menus";



export const GET = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const menuId = pathId(params.menuId, "menuId");
  ownStore(owner, storeId);
  menu(storeId, menuId);
  return menuDetail(menuId);
});

export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const menuId = pathId(params.menuId, "menuId");
  ownStore(owner, storeId);
  const values = menuValues(await readJson(request));
  return db.transaction(() => {
    ownStore(owner, storeId);
    menu(storeId, menuId);
    if ("CTGR_ID" in values) categoryForMenu(storeId, values.CTGR_ID);
    const keys = Object.keys(values);
    if (keys.length) db.prepare(`UPDATE TB_MENU SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE MENU_ID = ?`).run(...Object.values(values), menuId);
    return menuDetail(menuId);
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const menuId = pathId(params.menuId, "menuId");
  return db.transaction(() => {
    ownStore(owner, storeId);
    menu(storeId, menuId);
    db.prepare("UPDATE TB_MENU_OPT SET DEL_YN = 'Y' WHERE OPT_GRP_ID IN (SELECT OPT_GRP_ID FROM TB_MENU_OPT_GRP WHERE MENU_ID = ?) AND DEL_YN = 'N'").run(menuId);
    db.prepare("UPDATE TB_MENU_OPT_GRP SET DEL_YN = 'Y' WHERE MENU_ID = ? AND DEL_YN = 'N'").run(menuId);
    db.prepare("UPDATE TB_MENU SET DEL_YN = 'Y' WHERE MENU_ID = ?").run(menuId);
    return null;
  })();
});
