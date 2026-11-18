import db from "#lib/db";
import { handler } from "#lib/http";
import { requireRole } from "#lib/auth";
import { ACTIVE_RESTRICTION_SQL } from "#lib/admin";



export const GET = handler(({ request }) => {
  requireRole(request, "ADMIN");
  return db.prepare(`SELECT
    (SELECT COUNT(*) FROM TB_STORE_APRV WHERE STORE_APRV_STTS = 'PENDING') AS pendingApplications,
    (SELECT COUNT(*) FROM TB_RVW_RPT WHERE RVW_RPT_STTS = 'PENDING') AS pendingReports,
    (SELECT COUNT(*) FROM TB_MBR_RSTR r WHERE ${ACTIVE_RESTRICTION_SQL()}) AS activeRestrictions`).get();
});
