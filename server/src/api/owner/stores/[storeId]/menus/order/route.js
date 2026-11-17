import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson, invalid } from "#lib/http";
import { ownStore, menu, category, menus, fields, bodyInt } from "#lib/owner-menus";



export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["categories", "items"]);
  if (!Array.isArray(body.items)) invalid("items", "배열이어야 합니다.");
  if ("categories" in body && !Array.isArray(body.categories)) invalid("categories", "배열이어야 합니다.");
  const categories = (body.categories ?? []).map((item, i) => {
    fields(item, ["categoryId", "seq"]);
    return { categoryId: bodyInt(item.categoryId, `categories[${i}].categoryId`, 1), seq: bodyInt(item.seq, `categories[${i}].seq`) };
  });
  const items = body.items.map((item, i) => {
    fields(item, ["menuId", "categoryId", "seq"]);
    return { menuId: bodyInt(item.menuId, `items[${i}].menuId`, 1), categoryId: bodyInt(item.categoryId, `items[${i}].categoryId`, 1), seq: bodyInt(item.seq, `items[${i}].seq`) };
  });
  return db.transaction(() => {
    ownStore(owner, storeId);
    for (const item of categories) category(storeId, item.categoryId);
    for (const item of items) {
      menu(storeId, item.menuId);
      category(storeId, item.categoryId);
    }
    const updateCategory = db.prepare("UPDATE TB_MENU_CTGR SET CTGR_SEQ = ? WHERE CTGR_ID = ?");
    for (const item of categories) updateCategory.run(item.seq, item.categoryId);
    const updateMenu = db.prepare("UPDATE TB_MENU SET CTGR_ID = ?, MENU_SEQ = ? WHERE MENU_ID = ?");
    for (const item of items) updateMenu.run(item.categoryId, item.seq, item.menuId);
    return menus(storeId);
  })();
});
