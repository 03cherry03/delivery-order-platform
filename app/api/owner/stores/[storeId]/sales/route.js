import db from "@/lib/db";
import { handler, oneOf } from "@/lib/server/http";
import { expireWaitingOrders } from "@/lib/server/orders";
import { ownerStore, salesRange } from "@/lib/server/owner-orders";

export const runtime = "nodejs";

export const GET = handler(async ({ request, params, query }) => {
  const { storeId } = ownerStore(request, params);
  const unit = oneOf(query.get("unit"), "unit", ["day", "month"]);
  const { from, to } = salesRange(query);
  expireWaitingOrders();
  const grouped = db.prepare(`SELECT ${unit === "day" ? "SALES_DT" : "substr(SALES_DT, 1, 7)"} AS period,
      COUNT(*) AS orderCount, SUM(ORD_TOT_AMT) AS salesAmount, SUM(DLVR_TIP_AMT) AS deliveryTipTotal
    FROM V_DONE_ORDER WHERE STORE_ID = ? AND SALES_DT BETWEEN ? AND ? GROUP BY period ORDER BY period`)
    .all(storeId, from, to);
  const byPeriod = new Map(grouped.map((row) => [row.period, row]));
  const cursor = new Date(`${unit === "day" ? from : `${from.slice(0, 7)}-01`}T00:00:00Z`);
  const rows = [];
  while (cursor.toISOString().slice(0, 10) <= to) {
    const period = cursor.toISOString().slice(0, unit === "day" ? 10 : 7);
    const row = byPeriod.get(period) ?? { period, orderCount: 0, salesAmount: 0, deliveryTipTotal: 0 };
    rows.push({ ...row, avgOrderAmount: row.orderCount ? Math.round(row.salesAmount / row.orderCount) : 0 });
    if (unit === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const totals = rows.reduce((sum, row) => ({
    orderCount: sum.orderCount + row.orderCount,
    salesAmount: sum.salesAmount + row.salesAmount,
    deliveryTipTotal: sum.deliveryTipTotal + row.deliveryTipTotal,
  }), { orderCount: 0, salesAmount: 0, deliveryTipTotal: 0 });
  const counts = db.prepare(`SELECT
      COALESCE(SUM(ORD_RCPT_DTTM IS NOT NULL), 0) AS acceptedCount,
      COALESCE(SUM(CNCL_ACTR_CD = 'OWNER' AND ORD_RCPT_DTTM IS NULL), 0) AS rejectedCount,
      COALESCE(SUM(CNCL_ACTR_CD = 'SYSTEM'), 0) AS autoCanceledCount
    FROM TB_ORD WHERE STORE_ID = ? AND date(ORD_DTTM) BETWEEN ? AND ?
      AND COALESCE(CNCL_ACTR_CD, '') NOT IN ('CUSTOMER', 'ADMIN')`).get(storeId, from, to);
  const denominator = counts.acceptedCount + counts.rejectedCount + counts.autoCanceledCount;
  return { summary: { ...totals,
    avgOrderAmount: totals.orderCount ? Math.round(totals.salesAmount / totals.orderCount) : 0,
    acceptRate: denominator ? counts.acceptedCount / denominator : null, ...counts }, rows };
});
