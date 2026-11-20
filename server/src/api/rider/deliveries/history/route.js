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
      WITH bounds AS (
        SELECT date('now', 'localtime') AS today,
          date('now', 'localtime', 'weekday 0', '-6 days') AS weekFrom,
          date('now', 'localtime', 'weekday 0') AS weekTo,
          date('now', 'localtime', 'start of month') AS monthFrom,
          date('now', 'localtime', 'start of month', '+1 month', '-1 day') AS monthTo
      )
      SELECT weekFrom, weekTo, monthFrom, monthTo, COUNT(d.DLVR_ID) AS totalCount,
        COUNT(*) FILTER (WHERE d.CMPL_DT = today) AS todayCount,
        COALESCE(SUM(d.DLVR_TIP_AMT) FILTER (WHERE d.CMPL_DT = today), 0) AS todayTipSum,
        COUNT(*) FILTER (WHERE d.WEEK_START_DT = weekFrom) AS weekCount,
        COALESCE(SUM(d.DLVR_TIP_AMT) FILTER (WHERE d.WEEK_START_DT = weekFrom), 0) AS weekTipAmount,
        COUNT(*) FILTER (WHERE d.MONTH = substr(monthFrom, 1, 7)) AS monthCount,
        COALESCE(SUM(d.DLVR_TIP_AMT) FILTER (WHERE d.MONTH = substr(monthFrom, 1, 7)), 0) AS monthTipAmount
      FROM bounds LEFT JOIN V_RIDER_DONE_DELIVERY d ON d.RIDER_MBR_ID = ?
    `).get(me.MBR_ID);
    const summary = {
      thisWeek: { from: totals.weekFrom, to: totals.weekTo, count: totals.weekCount, tipAmount: totals.weekTipAmount },
      thisMonth: { from: totals.monthFrom, to: totals.monthTo, count: totals.monthCount, tipAmount: totals.monthTipAmount },
    };
    const items = db.prepare(`
      SELECT d.DLVR_ID AS deliveryId, d.ORD_ID AS orderId, s.STORE_NM AS storeName,
        d.DLVR_ADDR AS deliveryAddress, d.DLVR_TIP_AMT AS deliveryTip,
        d.PKUP_DTTM AS pickedUpAt, d.DLVR_CMPL_DTTM AS completedAt
      FROM V_RIDER_DONE_DELIVERY d JOIN TB_STORE s ON s.STORE_ID = d.STORE_ID
      WHERE d.RIDER_MBR_ID = ?
      ORDER BY d.DLVR_CMPL_DTTM DESC, d.DLVR_ID DESC LIMIT ? OFFSET ?
    `).all(me.MBR_ID, pg.size, pg.offset);
    return { ...paged(pg, items, totals.totalCount), todayCount: totals.todayCount, todayTipSum: totals.todayTipSum, summary };
  })();
});
