import db from "#lib/db";
import { handler, pageOf, paged } from "#lib/http";
import { requireRole } from "#lib/auth";
import { expireWaitingOrders } from "#lib/orders";



export const GET = handler(async ({ request, query }) => {
  const me = requireRole(request, "CUSTOMER");
  const pg = pageOf(query);
  expireWaitingOrders();
  const totalCount = db.prepare(`SELECT COUNT(*) AS count FROM TB_RVW r JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID WHERE o.MBR_ID = ? AND r.DEL_YN = 'N'`).get(me.MBR_ID).count;
  const rows = db.prepare(`SELECT r.*, o.STORE_ID, s.STORE_NM, reply.RVW_REPLY_ID, reply.RVW_REPLY_CN, reply.REG_DTTM AS REPLY_CREATED,
      (o.ORD_STTS = 'DONE' AND d.DLVR_CMPL_DTTM IS NOT NULL AND d.DLVR_CMPL_DTTM >= datetime('now', 'localtime', '-72 hours') AND r.RVW_HDN_YN = 'N') AS CAN_EDIT
    FROM TB_RVW r JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID
    LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID LEFT JOIN TB_RVW_REPLY reply ON reply.RVW_ID = r.RVW_ID AND reply.DEL_YN = 'N'
    WHERE o.MBR_ID = ? AND r.DEL_YN = 'N' ORDER BY r.REG_DTTM DESC, r.RVW_ID DESC LIMIT ? OFFSET ?`).all(me.MBR_ID, pg.size, pg.offset);
  return paged(pg, rows.map((row) => ({
    reviewId: row.RVW_ID, orderId: row.ORD_ID, storeId: row.STORE_ID, storeName: row.STORE_NM,
    rating: row.RVW_RTNG, content: row.RVW_CN, createdAt: row.REG_DTTM, canEdit: !!row.CAN_EDIT,
    reply: row.RVW_REPLY_ID === null ? null : { content: row.RVW_REPLY_CN, createdAt: row.REPLY_CREATED },
    isHidden: row.RVW_HDN_YN === "Y",
  })), totalCount);
});
