import db from "#lib/db";
import { handler, pathId } from "#lib/http";
import { requireRole } from "#lib/auth";
import { publicStore } from "#lib/customer-stores";



export const GET = handler(({ request, params }) => {
  requireRole(request, "CUSTOMER");
  const id = pathId(params.storeId, "storeId");
  publicStore(id);
  const categories = db.prepare(`SELECT CTGR_ID AS categoryId, CTGR_NM AS categoryName, CTGR_SEQ AS seq
    FROM TB_MENU_CTGR WHERE STORE_ID = ? AND DEL_YN = 'N' ORDER BY CTGR_SEQ, CTGR_ID`).all(id);
  const menus = db.prepare(`SELECT m.CTGR_ID AS categoryId, m.MENU_ID AS menuId, m.MENU_NM AS menuName,
    m.MENU_AMT AS price, m.MENU_CN AS description, m.MENU_SALE_STTS AS saleStatus, m.MENU_SEQ AS seq,
    (SELECT COUNT(*) FROM TB_MENU_OPT_GRP g WHERE g.MENU_ID = m.MENU_ID AND g.DEL_YN = 'N') AS optionGroupCount
    FROM TB_MENU m JOIN TB_MENU_CTGR c ON c.CTGR_ID = m.CTGR_ID AND c.STORE_ID = m.STORE_ID
    WHERE m.STORE_ID = ? AND m.DEL_YN = 'N' AND c.DEL_YN = 'N' ORDER BY m.MENU_SEQ, m.MENU_ID`).all(id);
  const byCategory = new Map(categories.map((category) => [category.categoryId, []]));
  for (const { categoryId, ...menu } of menus) byCategory.get(categoryId).push(menu);
  return categories.map((category) => ({ ...category, menus: byCategory.get(category.categoryId) }));
});
