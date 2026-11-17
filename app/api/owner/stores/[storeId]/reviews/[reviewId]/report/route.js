import db from "@/lib/db";
import { handler, readJson, oneOf, str, fail, created } from "@/lib/server/http";
import { ownerStore, usableReview, bodyFields } from "@/lib/server/owner-orders";

export const runtime = "nodejs";

export const POST = handler(async ({ request, params }) => {
  const { owner, storeId } = ownerStore(request, params);
  const body = await readJson(request);
  bodyFields(body, ["reason", "content"]);
  const reason = oneOf(body.reason, "reason", ["ABUSE", "FALSE", "UNRELATED", "ETC"]);
  const content = str(body.content, "content", { max: 300 });
  const data = db.transaction(() => {
    const review = usableReview(storeId, params.reviewId);
    if (db.prepare("SELECT 1 FROM TB_RVW_RPT WHERE RVW_ID = ? AND RPTR_MBR_ID = ?").get(review.RVW_ID, owner.MBR_ID)) {
      fail(409, "ALREADY_REPORTED", "이미 신고한 리뷰입니다.");
    }
    const result = db.prepare(`INSERT INTO TB_RVW_RPT (RVW_ID, RPTR_MBR_ID, RVW_RPT_RSN_CD, RVW_RPT_CN)
      VALUES (?, ?, ?, ?)`).run(review.RVW_ID, owner.MBR_ID, reason, content);
    return { reportId: Number(result.lastInsertRowid), status: "PENDING" };
  })();
  return created(data);
});
