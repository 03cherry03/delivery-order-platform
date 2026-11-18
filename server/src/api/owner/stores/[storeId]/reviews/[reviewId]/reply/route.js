import db from "#lib/db";
import { handler, readJson, str, created, fail, forbidden, notFound } from "#lib/http";
import { ownerStore, usableReview, bodyFields } from "#lib/owner-orders";



const replyData = (reviewId) => db.prepare(`SELECT RVW_REPLY_ID AS replyId, RVW_REPLY_CN AS content,
  REG_DTTM AS createdAt FROM TB_RVW_REPLY WHERE RVW_ID = ? AND DEL_YN = 'N'`).get(reviewId);

export const POST = handler(async ({ request, params }) => {
  const { storeId, owner } = ownerStore(request, params);
  const body = await readJson(request);
  bodyFields(body, ["content"]);
  const content = str(body.content, "content", { max: 1000 });
  const data = db.transaction(() => {
    const review = usableReview(storeId, params.reviewId);
    const reply = db.prepare("SELECT * FROM TB_RVW_REPLY WHERE RVW_ID = ?").get(review.RVW_ID);
    if (reply?.DEL_YN === "N") fail(409, "REPLY_EXISTS", "이미 답글이 있습니다.");
    if (reply) {
      db.prepare("UPDATE TB_RVW_REPLY SET DEL_YN = 'N', RVW_REPLY_CN = ?, OWNR_MBR_ID = ? WHERE RVW_ID = ?")
        .run(content, owner.MBR_ID, review.RVW_ID);
    } else {
      db.prepare("INSERT INTO TB_RVW_REPLY (RVW_ID, OWNR_MBR_ID, RVW_REPLY_CN) VALUES (?, ?, ?)")
        .run(review.RVW_ID, owner.MBR_ID, content);
    }
    return replyData(review.RVW_ID);
  })();
  return created(data);
});

export const PATCH = handler(async ({ request, params }) => {
  const { storeId, owner } = ownerStore(request, params);
  const body = await readJson(request);
  bodyFields(body, ["content"]);
  const content = str(body.content, "content", { max: 1000 });
  return db.transaction(() => {
    const review = usableReview(storeId, params.reviewId);
    const reply = db.prepare("SELECT * FROM TB_RVW_REPLY WHERE RVW_ID = ? AND DEL_YN = 'N'").get(review.RVW_ID);
    if (!reply) notFound();
    if (reply.OWNR_MBR_ID !== owner.MBR_ID) forbidden();
    db.prepare("UPDATE TB_RVW_REPLY SET RVW_REPLY_CN = ? WHERE RVW_REPLY_ID = ?").run(content, reply.RVW_REPLY_ID);
    return replyData(review.RVW_ID);
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const { storeId, owner } = ownerStore(request, params);
  return db.transaction(() => {
    const review = usableReview(storeId, params.reviewId);
    const reply = db.prepare("SELECT * FROM TB_RVW_REPLY WHERE RVW_ID = ? AND DEL_YN = 'N'").get(review.RVW_ID);
    if (!reply) notFound();
    if (reply.OWNR_MBR_ID !== owner.MBR_ID) forbidden();
    db.prepare("UPDATE TB_RVW_REPLY SET DEL_YN = 'Y' WHERE RVW_REPLY_ID = ?").run(reply.RVW_REPLY_ID);
    return null;
  })();
});
