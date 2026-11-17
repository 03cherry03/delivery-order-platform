import db from "#lib/db";
import { handler, pathId, notFound } from "#lib/http";
import { requireRole } from "#lib/auth";
import { OPER_STATUS_SQL, storeHours } from "#lib/stores";



export const GET = handler(({ request, params }) => {
  requireRole(request, "ADMIN");
  const applicationId = pathId(params.applicationId, "applicationId");
  const application = db.prepare(`SELECT a.STORE_APRV_ID AS applicationId,
    s.STORE_ID AS storeId, s.STORE_NM AS storeName, s.STORE_CTGR_CD AS categoryCode,
    s.BIZ_NO AS bizNo, s.STORE_TELNO AS telNo, s.STORE_ADDR AS address,
    s.STORE_DADDR AS addressDetail, s.STORE_LAT AS lat, s.STORE_LNG AS lng,
    s.MIN_ORD_AMT AS minOrderAmount, s.DLVR_TIP_AMT AS deliveryTip,
    s.COOK_EST_MI AS cookMinutes, s.STORE_CN AS description,
    s.STORE_APRV_STTS AS approvalStatus, ${OPER_STATUS_SQL()} AS operStatus,
    (SELECT COUNT(*) FROM TB_MENU menu WHERE menu.STORE_ID = s.STORE_ID
      AND menu.DEL_YN = 'N' AND menu.MENU_SALE_STTS = 'ON_SALE') AS onSaleMenuCount,
    m.MBR_NM AS ownerName, m.MBR_EMAIL AS ownerEmail, m.MBR_TELNO AS ownerTel
    FROM TB_STORE_APRV a JOIN TB_STORE s ON s.STORE_ID = a.STORE_ID
    JOIN TB_MBR m ON m.MBR_ID = s.OWNR_MBR_ID WHERE a.STORE_APRV_ID = ?`).get(applicationId);
  if (!application) notFound();
  const history = db.prepare(`SELECT APLY_DTTM AS appliedAt, STORE_APRV_STTS AS status,
    PRCS_DTTM AS processedAt, RJCT_RSN_CN AS rejectReason FROM TB_STORE_APRV
    WHERE STORE_ID = ? AND STORE_APRV_ID < ? ORDER BY APLY_DTTM DESC, STORE_APRV_ID DESC`)
    .all(application.storeId, applicationId);
  return { ...application, ...storeHours(application.storeId), isOpenNow: application.operStatus === "OPEN", history };
});
