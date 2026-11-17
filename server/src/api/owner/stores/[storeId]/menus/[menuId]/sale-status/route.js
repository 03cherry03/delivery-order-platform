import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson, oneOf } from "#lib/http";
import { ownStore, menu, fields } from "#lib/owner-menus";



export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const menuId = pathId(params.menuId, "menuId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["saleStatus"]);
  const saleStatus = oneOf(body.saleStatus, "saleStatus", ["ON_SALE", "SOLD_OUT"]);
  return db.transaction(() => {
    ownStore(owner, storeId);
    menu(storeId, menuId);
    db.prepare("UPDATE TB_MENU SET MENU_SALE_STTS = ? WHERE MENU_ID = ?").run(saleStatus, menuId);
    return { menuId, saleStatus };
  })();
});
