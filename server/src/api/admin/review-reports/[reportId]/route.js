import db from "#lib/db";
import { handler, pathId, notFound } from "#lib/http";
import { requireRole } from "#lib/auth";
import { expireWaitingOrders } from "#lib/orders";
import { ACTIVE_RESTRICTION_SQL } from "#lib/admin";



export const GET = handler(({ request, params }) => {
  requireRole(request, "ADMIN");
  const reportId = pathId(params.reportId, "reportId");
  expireWaitingOrders();
  const row = db.prepare(`SELECT p.*, r.RVW_RTNG, r.RVW_CN, r.REG_DTTM AS REVIEW_DTTM,
    r.RVW_HDN_YN, o.ORD_ID, o.ORD_STTS, m.MBR_ID, m.MBR_NM, d.DLVR_CMPL_DTTM,
    (SELECT COUNT(*) FROM TB_RVW hidden JOIN TB_ORD own ON own.ORD_ID = hidden.ORD_ID
      WHERE own.MBR_ID = m.MBR_ID AND hidden.RVW_HDN_YN = 'Y') AS hiddenReviewCount,
    EXISTS (SELECT 1 FROM TB_MBR_RSTR restriction WHERE restriction.MBR_ID = m.MBR_ID
      AND ${ACTIVE_RESTRICTION_SQL("restriction")}) AS restricted
    FROM TB_RVW_RPT p JOIN TB_RVW r ON r.RVW_ID = p.RVW_ID
    JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
    LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID WHERE p.RVW_RPT_ID = ?`).get(reportId);
  if (!row) notFound();
  const menus = db.prepare("SELECT ORD_MENU_NM FROM TB_ORD_DTL WHERE ORD_ID = ? ORDER BY ORD_DTL_SEQ")
    .all(row.ORD_ID).map((item) => item.ORD_MENU_NM).join(", ");
  return {
    reportId, reason: row.RVW_RPT_RSN_CD, content: row.RVW_RPT_CN,
    reportedAt: row.REG_DTTM, status: row.RVW_RPT_STTS,
    review: { reviewId: row.RVW_ID, rating: row.RVW_RTNG, content: row.RVW_CN,
      createdAt: row.REVIEW_DTTM, hidden: row.RVW_HDN_YN === "Y" },
    order: { orderId: row.ORD_ID, status: row.ORD_STTS, deliveredAt: row.DLVR_CMPL_DTTM, menus },
    writer: { memberId: row.MBR_ID, name: row.MBR_NM, hiddenReviewCount: row.hiddenReviewCount,
      restricted: Boolean(row.restricted) },
  };
});
