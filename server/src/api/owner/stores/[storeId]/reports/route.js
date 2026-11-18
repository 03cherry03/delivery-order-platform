import db from "#lib/db";
import { handler } from "#lib/http";
import { ownerStore } from "#lib/owner-orders";



export const GET = handler(async ({ request, params }) => {
  const { owner, storeId } = ownerStore(request, params);
  return db.prepare(`SELECT rpt.RVW_RPT_ID AS reportId, rpt.RVW_ID AS reviewId, r.RVW_CN AS reviewContent,
      rpt.RVW_RPT_RSN_CD AS reason, rpt.RVW_RPT_STTS AS status, rpt.REG_DTTM AS reportedAt,
      rpt.PRCS_DTTM AS processedAt, rpt.PRCS_CN AS processNote
    FROM TB_RVW_RPT rpt JOIN TB_RVW r ON r.RVW_ID = rpt.RVW_ID JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID
    WHERE rpt.RPTR_MBR_ID = ? AND o.STORE_ID = ? ORDER BY rpt.REG_DTTM DESC, rpt.RVW_RPT_ID DESC`)
    .all(owner.MBR_ID, storeId);
});
