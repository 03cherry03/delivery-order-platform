import db from "#lib/db";
import { handler, oneOf } from "#lib/http";
import { requireRole } from "#lib/auth";



export const GET = handler(({ request, query }) => {
  requireRole(request, "ADMIN");
  const status = oneOf(query.get("status") ?? "PENDING", "status", ["PENDING", "APPROVED", "REJECTED"]);
  return db.prepare(`SELECT a.STORE_APRV_ID AS applicationId, s.STORE_ID AS storeId,
    s.STORE_NM AS storeName, m.MBR_NM AS ownerName, s.BIZ_NO AS bizNo,
    s.STORE_CTGR_CD AS categoryCode, a.APLY_DTTM AS appliedAt,
    EXISTS (SELECT 1 FROM TB_STORE_APRV old WHERE old.STORE_ID = a.STORE_ID
      AND old.STORE_APRV_ID < a.STORE_APRV_ID AND old.STORE_APRV_STTS = 'REJECTED') AS isReapply
    FROM TB_STORE_APRV a JOIN TB_STORE s ON s.STORE_ID = a.STORE_ID
    JOIN TB_MBR m ON m.MBR_ID = s.OWNR_MBR_ID WHERE a.STORE_APRV_STTS = ?
    ORDER BY ${status === "PENDING" ? "a.APLY_DTTM ASC, a.STORE_APRV_ID ASC" : "a.PRCS_DTTM DESC, a.STORE_APRV_ID DESC"}`)
    .all(status).map((row) => ({ ...row, isReapply: Boolean(row.isReapply) }));
});
