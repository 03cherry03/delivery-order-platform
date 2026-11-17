import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pageOf, paged } from "#lib/http";
import { expireWaitingOrders } from "#lib/orders";



export const GET = handler(({ request, query }) => {
  const me = requireRole(request, "RIDER");
  const pg = pageOf(query);
  expireWaitingOrders();
  return db.transaction(() => {
    const totals = db.prepare(`
      SELECT COUNT(*) AS totalCount,
        COALESCE(SUM(CASE WHEN date(d.DLVR_CMPL_DTTM) = date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS todayCount,
        COALESCE(SUM(CASE WHEN date(d.DLVR_CMPL_DTTM) = date('now', 'localtime') THEN o.DLVR_TIP_AMT ELSE 0 END), 0) AS todayTipSum
      FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
      WHERE d.RIDER_MBR_ID = ? AND o.ORD_STTS = 'DONE'
    `).get(me.MBR_ID);
    const items = db.prepare(`
      SELECT d.DLVR_ID AS deliveryId, o.ORD_ID AS orderId, s.STORE_NM AS storeName,
        o.DLVR_ADDR AS deliveryAddress, o.DLVR_TIP_AMT AS deliveryTip,
        d.PKUP_DTTM AS pickedUpAt, d.DLVR_CMPL_DTTM AS completedAt
      FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
      JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID
      WHERE d.RIDER_MBR_ID = ? AND o.ORD_STTS = 'DONE'
      ORDER BY d.DLVR_CMPL_DTTM DESC, d.DLVR_ID DESC LIMIT ? OFFSET ?
    `).all(me.MBR_ID, pg.size, pg.offset);
    return { ...paged(pg, items, totals.totalCount), todayCount: totals.todayCount, todayTipSum: totals.todayTipSum };
  })();
});
