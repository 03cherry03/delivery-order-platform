import db from "@/lib/db";
import { handler, invalid, pageOf, paged } from "@/lib/server/http";
import { ownerStore } from "@/lib/server/owner-orders";

export const runtime = "nodejs";

export const GET = handler(async ({ request, params, query }) => {
  const { owner, storeId } = ownerStore(request, params);
  const pg = pageOf(query);
  const noReply = query.get("noReply");
  if (noReply !== null && noReply !== "true" && noReply !== "false") invalid("noReply", "true 또는 false여야 합니다.");
  const filter = `o.STORE_ID = ? AND r.DEL_YN = 'N' ${noReply === "true" ? "AND rp.RVW_REPLY_ID IS NULL" : ""}`;
  const joins = `FROM TB_RVW r JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID
    LEFT JOIN TB_RVW_REPLY rp ON rp.RVW_ID = r.RVW_ID AND rp.DEL_YN = 'N'`;
  const { totalCount } = db.prepare(`SELECT COUNT(*) AS totalCount ${joins} WHERE ${filter}`).get(storeId);
  const rows = db.prepare(`SELECT r.*, o.MBR_ID, m.MBR_NM, rp.RVW_REPLY_ID, rp.RVW_REPLY_CN,
      rp.REG_DTTM AS replyCreatedAt, rpt.RVW_RPT_STTS,
      (SELECT group_concat(ORD_MENU_NM, ', ') FROM
        (SELECT ORD_MENU_NM FROM TB_ORD_DTL WHERE ORD_ID = o.ORD_ID ORDER BY ORD_DTL_SEQ)) AS orderedMenus
    ${joins} JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
    LEFT JOIN TB_RVW_RPT rpt ON rpt.RVW_ID = r.RVW_ID AND rpt.RPTR_MBR_ID = ?
    WHERE ${filter} ORDER BY r.REG_DTTM DESC, r.RVW_ID DESC LIMIT ? OFFSET ?`)
    .all(owner.MBR_ID, storeId, pg.size, pg.offset);
  const rating = db.prepare("SELECT AVG_RTNG AS avgRating, RVW_CNT AS reviewCount FROM V_STORE_RATING WHERE STORE_ID = ?").get(storeId);
  const items = rows.map((r) => ({
    reviewId: r.RVW_ID, orderId: r.ORD_ID, writerName: `${Array.from(r.MBR_NM)[0] ?? ""}**`,
    rating: r.RVW_RTNG, content: r.RVW_CN, createdAt: r.REG_DTTM, orderedMenus: r.orderedMenus ?? "",
    hidden: r.RVW_HDN_YN === "Y",
    reply: r.RVW_REPLY_ID ? { replyId: r.RVW_REPLY_ID, content: r.RVW_REPLY_CN, createdAt: r.replyCreatedAt } : null,
    report: r.RVW_RPT_STTS ? { status: r.RVW_RPT_STTS } : null,
  }));
  return { ...rating, ...paged(pg, items, totalCount) };
});
