import db from "@/lib/db";
import { requireRole, requireOwnStore } from "@/lib/server/auth";
import { DATE, fail, forbidden, invalid, notFound, pathId, str } from "@/lib/server/http";

export function ownerStore(request, params) {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const store = requireOwnStore(owner, storeId);
  if (store.STORE_APRV_STTS !== "APPROVED") fail(409, "STORE_NOT_APPROVED", "승인된 가게만 이용할 수 있습니다.");
  return { owner, store, storeId };
}

export function ownOrder(storeId, value) {
  const orderId = pathId(value, "orderId");
  const order = db.prepare("SELECT * FROM TB_ORD WHERE ORD_ID = ?").get(orderId);
  if (!order) notFound();
  if (order.STORE_ID !== storeId) forbidden();
  return order;
}

export function usableReview(storeId, value) {
  const reviewId = pathId(value, "reviewId");
  const review = db.prepare(`SELECT r.*, o.STORE_ID FROM TB_RVW r
    JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID WHERE r.RVW_ID = ?`).get(reviewId);
  if (!review) notFound();
  if (review.STORE_ID !== storeId) forbidden();
  if (review.RVW_HDN_YN === "Y" || review.DEL_YN === "Y") fail(409, "REVIEW_UNAVAILABLE", "변경할 수 없는 리뷰입니다.");
  return review;
}

export function dateValue(value, field) {
  const date = str(value, field, { pattern: DATE });
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) invalid(field, "올바른 날짜여야 합니다.");
  return date;
}

export function salesRange(query) {
  const from = dateValue(query.get("from"), "from");
  const to = dateValue(query.get("to"), "to");
  const limit = new Date(`${from}T00:00:00Z`);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  if (from > to || new Date(`${to}T00:00:00Z`) >= limit) invalid("to", "시작일 이후 최대 1년 이내여야 합니다.");
  return { from, to };
}

export function reasonDetail(body) {
  return str(body.reasonDetail, "reasonDetail", { required: body.reason === "ETC" }) ?? null;
}

export const unpickedDelivery = `EXISTS (SELECT 1 FROM TB_DLVR d WHERE d.ORD_ID = TB_ORD.ORD_ID
  AND d.PKUP_DTTM IS NULL AND d.DLVR_CMPL_DTTM IS NULL)`;

export function bodyFields(body, allowed) {
  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) invalid(field, "허용되지 않은 필드입니다.");
  }
}
