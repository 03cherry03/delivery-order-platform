import db from "#lib/db";
import { handler, pathId, notFound, fail, readJson, str } from "#lib/http";
import { requireRole } from "#lib/auth";



export const POST = handler(async ({ request, params }) => {
  const admin = requireRole(request, "ADMIN");
  const applicationId = pathId(params.applicationId, "applicationId");
  const body = await readJson(request);
  const rejectReason = str(body.rejectReason, "rejectReason", { max: 300 });
  return db.transaction(() => {
    const application = db.prepare(`SELECT a.STORE_ID, a.STORE_APRV_STTS FROM TB_STORE_APRV a
      JOIN TB_STORE s ON s.STORE_ID = a.STORE_ID WHERE a.STORE_APRV_ID = ?`).get(applicationId);
    if (!application) notFound();
    if (application.STORE_APRV_STTS !== "PENDING") fail(409, "ALREADY_PROCESSED", "이미 처리된 신청입니다.");
    let result;
    try {
      result = db.prepare(`UPDATE TB_STORE_APRV SET STORE_APRV_STTS = 'REJECTED',
        PRCSR_MBR_ID = ?, PRCS_DTTM = datetime('now', 'localtime'), RJCT_RSN_CN = ?
        WHERE STORE_APRV_ID = ? AND STORE_APRV_STTS = 'PENDING'`).run(admin.MBR_ID, rejectReason, applicationId);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_TRIGGER" && error.message === "STORE_APRV_STORE_DELETED") {
        fail(409, "STORE_DELETED", "삭제된 가게의 신청은 처리할 수 없습니다.");
      }
      throw error;
    }
    if (!result.changes) fail(409, "ALREADY_PROCESSED", "이미 처리된 신청입니다.");
    db.prepare("UPDATE TB_STORE SET STORE_APRV_STTS = 'REJECTED' WHERE STORE_ID = ?").run(application.STORE_ID);
    return db.prepare(`SELECT STORE_APRV_ID AS applicationId, STORE_APRV_STTS AS status,
      PRCS_DTTM AS processedAt FROM TB_STORE_APRV WHERE STORE_APRV_ID = ?`).get(applicationId);
  })();
});
