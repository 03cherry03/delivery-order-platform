import db from "@/lib/db";
import { handler, pathId, pageOf, paged } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { publicStore } from "@/lib/server/customer-stores";
import { expireWaitingOrders } from "@/lib/server/orders";

export const runtime = "nodejs";

export const GET = handler(({ request, params, query }) => {
  requireRole(request, "CUSTOMER");
  const id = pathId(params.storeId, "storeId");
  const pg = pageOf(query);
  publicStore(id);
  expireWaitingOrders();
  const rating = db.prepare("SELECT AVG_RTNG AS avgRating, RVW_CNT AS reviewCount FROM V_STORE_RATING WHERE STORE_ID = ?").get(id);
  const rows = db.prepare(`SELECT r.RVW_ID AS reviewId, m.MBR_NM AS writerName,
    r.RVW_RTNG AS rating, r.RVW_CN AS content, r.REG_DTTM AS createdAt,
    (SELECT group_concat(ORD_MENU_NM, ', ') FROM
      (SELECT ORD_MENU_NM FROM TB_ORD_DTL WHERE ORD_ID = o.ORD_ID ORDER BY ORD_DTL_SEQ)) AS orderedMenus,
    p.RVW_REPLY_ID AS replyId, p.RVW_REPLY_CN AS replyContent, p.REG_DTTM AS replyCreatedAt
    FROM TB_RVW r JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
    LEFT JOIN TB_RVW_REPLY p ON p.RVW_ID = r.RVW_ID AND p.DEL_YN = 'N'
    WHERE o.STORE_ID = ? AND r.RVW_HDN_YN = 'N' AND r.DEL_YN = 'N'
    ORDER BY r.REG_DTTM DESC, r.RVW_ID DESC LIMIT ? OFFSET ?`).all(id, pg.size, pg.offset);
  const items = rows.map(({ replyId, replyContent, replyCreatedAt, ...review }) => ({
    ...review,
    writerName: `${Array.from(review.writerName)[0] ?? ""}**`,
    orderedMenus: review.orderedMenus ?? "",
    reply: replyId === null ? null : { content: replyContent, createdAt: replyCreatedAt },
  }));
  return { ...rating, ...paged(pg, items, rating.reviewCount) };
});
