import db from "#lib/db";
import { handler, pathId, notFound } from "#lib/http";
import { requireRole } from "#lib/auth";
import { publicStore } from "#lib/customer-stores";



export const GET = handler(({ request, params }) => {
  requireRole(request, "CUSTOMER");
  const storeId = pathId(params.storeId, "storeId");
  const menuId = pathId(params.menuId, "menuId");
  publicStore(storeId);
  const menu = db.prepare(`SELECT m.MENU_ID AS menuId, c.CTGR_ID AS categoryId,
    c.CTGR_NM AS categoryName, m.MENU_NM AS menuName, m.MENU_AMT AS price,
    m.MENU_CN AS description, m.MENU_SALE_STTS AS saleStatus, m.MENU_SEQ AS seq
    FROM TB_MENU m JOIN TB_MENU_CTGR c ON c.CTGR_ID = m.CTGR_ID AND c.STORE_ID = m.STORE_ID
    WHERE m.MENU_ID = ? AND m.STORE_ID = ? AND m.DEL_YN = 'N' AND c.DEL_YN = 'N'`).get(menuId, storeId);
  if (!menu) notFound();
  const groups = db.prepare(`SELECT OPT_GRP_ID AS optionGroupId, OPT_GRP_NM AS groupName,
    RQRD_YN AS required, MAX_SLCT_CNT AS maxSelect, OPT_GRP_SEQ AS seq
    FROM TB_MENU_OPT_GRP WHERE MENU_ID = ? AND DEL_YN = 'N' ORDER BY OPT_GRP_SEQ, OPT_GRP_ID`).all(menuId);
  const options = db.prepare(`SELECT o.OPT_GRP_ID AS optionGroupId, o.OPT_ID AS optionId,
    o.OPT_NM AS optionName, o.OPT_AMT AS price, o.OPT_SEQ AS seq
    FROM TB_MENU_OPT o JOIN TB_MENU_OPT_GRP g ON g.OPT_GRP_ID = o.OPT_GRP_ID
    WHERE g.MENU_ID = ? AND g.DEL_YN = 'N' AND o.DEL_YN = 'N' ORDER BY o.OPT_SEQ, o.OPT_ID`).all(menuId);
  const byGroup = new Map(groups.map((group) => [group.optionGroupId, []]));
  for (const { optionGroupId, ...option } of options) byGroup.get(optionGroupId).push(option);
  return { ...menu, optionGroups: groups.map((group) => ({ ...group, required: group.required === "Y", options: byGroup.get(group.optionGroupId) })) };
});
