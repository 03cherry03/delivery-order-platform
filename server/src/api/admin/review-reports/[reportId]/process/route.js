import db from "#lib/db";
import { handler, pathId, readJson, oneOf, str, bool, invalid, notFound, fail } from "#lib/http";
import { requireRole } from "#lib/auth";
import { ACTIVE_RESTRICTION_SQL } from "#lib/admin";



export const POST = handler(async ({ request, params }) => {
  const admin = requireRole(request, "ADMIN");
  const reportId = pathId(params.reportId, "reportId");
  const body = await readJson(request);
  const decision = oneOf(body.decision, "decision", ["ACCEPTED", "REJECTED"]);
  const note = str(body.note, "note");
  const restrictWriter = body.restrictWriter === undefined ? false : bool(body.restrictWriter, "restrictWriter");
  if (restrictWriter && decision !== "ACCEPTED") invalid("restrictWriter", "신고 수용 시에만 제한할 수 있습니다.");
  return db.transaction(() => {
    const report = db.prepare(`SELECT p.RVW_RPT_STTS, p.RVW_ID, o.MBR_ID FROM TB_RVW_RPT p
      JOIN TB_RVW v ON v.RVW_ID = p.RVW_ID JOIN TB_ORD o ON o.ORD_ID = v.ORD_ID
      WHERE p.RVW_RPT_ID = ?`).get(reportId);
    if (!report) notFound();
    if (report.RVW_RPT_STTS !== "PENDING") fail(409, "ALREADY_PROCESSED", "이미 처리된 신고입니다.");
    const result = db.prepare(`UPDATE TB_RVW_RPT SET RVW_RPT_STTS = ?, PRCSR_MBR_ID = ?,
      PRCS_DTTM = datetime('now', 'localtime'), PRCS_CN = ?
      WHERE RVW_RPT_ID = ? AND RVW_RPT_STTS = 'PENDING'`).run(decision, admin.MBR_ID, note, reportId);
    if (!result.changes) fail(409, "ALREADY_PROCESSED", "이미 처리된 신고입니다.");
    if (decision === "ACCEPTED") db.prepare("UPDATE TB_RVW SET RVW_HDN_YN = 'Y' WHERE RVW_ID = ?").run(report.RVW_ID);
    let restricted = Boolean(db.prepare(`SELECT 1 FROM TB_MBR_RSTR r WHERE r.MBR_ID = ?
      AND ${ACTIVE_RESTRICTION_SQL()}`).get(report.MBR_ID));
    if (restrictWriter && !restricted) {
      db.prepare(`INSERT INTO TB_MBR_RSTR (MBR_ID, RVW_RPT_ID, RSTR_TYPE_CD, RSTR_RSN_CN, PRCSR_MBR_ID)
        VALUES (?, ?, 'REVIEW_WRITE', ?, ?)`).run(report.MBR_ID, reportId, note, admin.MBR_ID);
      restricted = true;
    }
    const processed = db.prepare(`SELECT p.RVW_RPT_ID AS reportId, p.RVW_RPT_STTS AS status,
      p.PRCS_DTTM AS processedAt, v.RVW_HDN_YN AS hidden FROM TB_RVW_RPT p
      JOIN TB_RVW v ON v.RVW_ID = p.RVW_ID WHERE p.RVW_RPT_ID = ?`).get(reportId);
    return { reportId, status: processed.status, processedAt: processed.processedAt,
      reviewHidden: processed.hidden === "Y", writerRestricted: restricted };
  })();
});
