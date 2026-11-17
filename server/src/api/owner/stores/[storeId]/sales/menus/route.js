import db from "#lib/db";
import { handler } from "#lib/http";
import { expireWaitingOrders } from "#lib/orders";
import { ownerStore, salesRange } from "#lib/owner-orders";



export const GET = handler(async ({ request, params, query }) => {
  const { storeId } = ownerStore(request, params);
  const { from, to } = salesRange(query);
  expireWaitingOrders();
  const { total } = db.prepare(`SELECT COALESCE(SUM(ORD_TOT_AMT), 0) AS total FROM V_DONE_ORDER
    WHERE STORE_ID = ? AND SALES_DT BETWEEN ? AND ?`).get(storeId, from, to);
  const rows = db.prepare(`SELECT dt.ORD_MENU_NM AS menuName, SUM(dt.ORD_QTY) AS quantity,
      SUM((dt.ORD_UPRC + COALESCE(opt.amount, 0)) * dt.ORD_QTY) AS salesAmount
    FROM V_DONE_ORDER o JOIN TB_ORD_DTL dt ON dt.ORD_ID = o.ORD_ID
    LEFT JOIN (SELECT ORD_DTL_ID, SUM(ORD_OPT_AMT) AS amount FROM TB_ORD_DTL_OPT GROUP BY ORD_DTL_ID) opt
      ON opt.ORD_DTL_ID = dt.ORD_DTL_ID
    WHERE o.STORE_ID = ? AND o.SALES_DT BETWEEN ? AND ?
    GROUP BY dt.ORD_MENU_NM ORDER BY salesAmount DESC, menuName ASC`).all(storeId, from, to);
  return rows.map((row, index) => ({ rank: index + 1, ...row, ratio: total ? row.salesAmount / total : 0 }));
});
