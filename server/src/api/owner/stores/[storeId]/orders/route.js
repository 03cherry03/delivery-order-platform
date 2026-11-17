import db from "#lib/db";
import { handler, oneOf } from "#lib/http";
import { expireWaitingOrders } from "#lib/orders";
import { dateValue, ownerStore } from "#lib/owner-orders";
import { distanceM } from "#lib/geo";



export const GET = handler(async ({ request, params, query }) => {
  const { storeId, store } = ownerStore(request, params);
  const statuses = (query.get("status") ?? "").split(",").map((status) =>
    oneOf(status, "status", ["WAIT", "COOKING", "READY", "DELIVERING", "DONE", "CANCEL"]));
  const date = query.has("date") ? dateValue(query.get("date"), "date")
    : db.prepare("SELECT date('now', 'localtime') AS today").get().today;
  expireWaitingOrders();
  const rows = db.prepare(`SELECT o.*, p.PAY_AMT, m.MBR_NM AS riderName,
      max(0, CAST((julianday('now', 'localtime') - julianday(o.ORD_DTTM)) * 1440 AS INTEGER)) AS elapsedMinutes,
      CASE WHEN o.ORD_STTS = 'WAIT' THEN datetime(o.ORD_DTTM, '+10 minutes') END AS autoCancelAt,
      (SELECT COUNT(*) FROM TB_ORD_DTL dt WHERE dt.ORD_ID = o.ORD_ID) AS itemCount,
      (SELECT dt.ORD_MENU_NM FROM TB_ORD_DTL dt WHERE dt.ORD_ID = o.ORD_ID ORDER BY dt.ORD_DTL_SEQ LIMIT 1) AS firstMenu
    FROM TB_ORD o JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
    LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID LEFT JOIN TB_MBR m ON m.MBR_ID = d.RIDER_MBR_ID
    WHERE o.STORE_ID = ? AND o.ORD_STTS IN (${statuses.map(() => "?").join(",")})
      AND (o.ORD_STTS NOT IN ('DONE', 'CANCEL') OR date(o.ORD_DTTM) = ?)
    ORDER BY CASE WHEN o.ORD_STTS = 'WAIT' THEN 0 ELSE 1 END,
      CASE WHEN o.ORD_STTS = 'WAIT' THEN o.ORD_DTTM END ASC,
      CASE WHEN o.ORD_STTS <> 'WAIT' THEN o.ORD_DTTM END DESC, o.ORD_ID DESC`).all(storeId, ...statuses, date);
  return rows.map((o) => ({
    orderId: o.ORD_ID, orderedAt: o.ORD_DTTM, status: o.ORD_STTS,
    elapsedMinutes: o.elapsedMinutes, autoCancelAt: o.autoCancelAt,
    summary: o.itemCount > 1 ? `${o.firstMenu} 외 ${o.itemCount - 1}건` : (o.firstMenu ?? ""),
    itemCount: o.itemCount, orderTotal: o.ORD_TOT_AMT, deliveryTip: o.DLVR_TIP_AMT,
    payAmount: o.PAY_AMT, deliveryAddress: o.DLVR_ADDR,
    distance: Math.round(distanceM(store.STORE_LAT, store.STORE_LNG, o.DLVR_LAT, o.DLVR_LNG)), riderName: o.riderName,
  }));
});
