import db from "@/lib/db";
import { handler, readJson, pathId, int, str, invalid, notFound, forbidden, fail } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { expireWaitingOrders } from "@/lib/server/orders";

export const runtime = "nodejs";

function ownReview(memberId, reviewId) {
  const row = db.prepare(`SELECT r.*, o.MBR_ID, o.ORD_STTS, d.DLVR_CMPL_DTTM,
      d.DLVR_CMPL_DTTM >= datetime('now', 'localtime', '-72 hours') AS IN_PERIOD
    FROM TB_RVW r JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID
    WHERE r.RVW_ID = ? AND r.DEL_YN = 'N'`).get(reviewId);
  if (!row) notFound();
  if (row.MBR_ID !== memberId) forbidden();
  return row;
}

export const PATCH = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const reviewId = pathId(params.reviewId, "reviewId");
  const body = await readJson(request);
  if (body.rating === undefined && body.content === undefined) invalid("body", "수정할 필드가 필요합니다.");
  const rating = body.rating === undefined ? undefined : int(body.rating, "rating", { min: 1, max: 5 });
  if (body.content !== undefined && body.content !== null && typeof body.content !== "string") invalid("content", "문자열 또는 null이어야 합니다.");
  const content = body.content === undefined ? undefined : str(body.content, "content", { required: false, min: 0, max: 1000 }) || null;
  if (body.rating !== undefined && typeof body.rating !== "number") invalid("rating", "정수여야 합니다.");
  expireWaitingOrders();
  return db.transaction(() => {
    const row = ownReview(me.MBR_ID, reviewId);
    if (row.RVW_HDN_YN === "Y" || row.ORD_STTS !== "DONE" || !row.DLVR_CMPL_DTTM) fail(409, "REVIEW_UNAVAILABLE", "수정할 수 없는 리뷰입니다.");
    if (!row.IN_PERIOD) fail(409, "REVIEW_PERIOD_EXPIRED", "리뷰 수정 기간이 지났습니다.");
    const assignments = [];
    const args = [];
    if (rating !== undefined) { assignments.push("RVW_RTNG = ?"); args.push(rating); }
    if (content !== undefined) { assignments.push("RVW_CN = ?"); args.push(content); }
    db.prepare(`UPDATE TB_RVW SET ${assignments.join(", ")} WHERE RVW_ID = ?`).run(...args, reviewId);
    return db.prepare("SELECT RVW_ID AS reviewId, RVW_RTNG AS rating, RVW_CN AS content, MOD_DTTM AS updatedAt FROM TB_RVW WHERE RVW_ID = ?").get(reviewId);
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const reviewId = pathId(params.reviewId, "reviewId");
  expireWaitingOrders();
  return db.transaction(() => {
    ownReview(me.MBR_ID, reviewId);
    db.prepare("UPDATE TB_RVW SET DEL_YN = 'Y' WHERE RVW_ID = ?").run(reviewId);
    return { reviewId, deleted: true };
  })();
});
