import db from "#lib/db";
import { handler, pathId, readJson, int, str, created, invalid, notFound, forbidden, fail } from "#lib/http";
import { requireRole } from "#lib/auth";
import { expireWaitingOrders } from "#lib/orders";



export const POST = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const orderId = pathId(params.orderId, "orderId");
  const body = await readJson(request);
  if (typeof body.rating !== "number") invalid("rating", "정수여야 합니다.");
  const rating = int(body.rating, "rating", { min: 1, max: 5 });
  if (body.content !== undefined && typeof body.content !== "string") invalid("content", "문자열이어야 합니다.");
  const content = str(body.content, "content", { required: false, min: 0, max: 1000 }) || null;
  expireWaitingOrders();
  return created(db.transaction(() => {
    const order = db.prepare(`SELECT o.*, d.DLVR_CMPL_DTTM,
      d.DLVR_CMPL_DTTM >= datetime('now', 'localtime', '-72 hours') AS IN_PERIOD
      FROM TB_ORD o LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID WHERE o.ORD_ID = ?`).get(orderId);
    if (!order) notFound();
    if (order.MBR_ID !== me.MBR_ID) forbidden();
    if (order.ORD_STTS !== "DONE" || !order.DLVR_CMPL_DTTM) fail(409, "ORDER_NOT_DELIVERED", "배달이 완료된 주문만 리뷰를 작성할 수 있습니다.");
    if (!order.IN_PERIOD) fail(409, "REVIEW_PERIOD_EXPIRED", "리뷰 작성 기간이 지났습니다.");
    if (db.prepare("SELECT 1 FROM TB_RVW WHERE ORD_ID = ?").get(orderId)) fail(409, "REVIEW_ALREADY_EXISTS", "이미 리뷰를 작성한 주문입니다.");
    const restricted = db.prepare(`SELECT 1 FROM TB_MBR_RSTR WHERE MBR_ID = ? AND RSTR_TYPE_CD = 'REVIEW_WRITE'
      AND RSTR_STRT_DTTM <= datetime('now', 'localtime') AND (RSTR_END_DTTM IS NULL OR RSTR_END_DTTM > datetime('now', 'localtime'))`).get(me.MBR_ID);
    if (restricted) fail(409, "REVIEW_RESTRICTED", "리뷰 작성이 제한된 회원입니다.");
    const reviewId = Number(db.prepare("INSERT INTO TB_RVW (ORD_ID, RVW_RTNG, RVW_CN) VALUES (?, ?, ?)").run(orderId, rating, content).lastInsertRowid);
    return db.prepare("SELECT RVW_ID AS reviewId, ORD_ID AS orderId, RVW_RTNG AS rating, RVW_CN AS content, REG_DTTM AS createdAt FROM TB_RVW WHERE RVW_ID = ?").get(reviewId);
  })());
});
