import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { created, handler, readJson } from "@/lib/server/http";
import { saveStoreApplication, storeInput } from "@/lib/server/members";
import { expireWaitingOrders } from "@/lib/server/orders";
import { OPER_STATUS_SQL } from "@/lib/server/stores";

export const runtime = "nodejs";

export const GET = handler(({ request }) => {
  const owner = requireRole(request, "OWNER");
  expireWaitingOrders();
  return db.prepare(`SELECT s.STORE_ID AS storeId, s.STORE_NM AS storeName, s.STORE_APRV_STTS AS approvalStatus,
    ${OPER_STATUS_SQL("s")} AS operStatus,
    (SELECT a.RJCT_RSN_CN FROM TB_STORE_APRV a WHERE a.STORE_ID = s.STORE_ID ORDER BY a.APLY_DTTM DESC, a.STORE_APRV_ID DESC LIMIT 1) AS rejectReason,
    (SELECT COUNT(*) FROM TB_ORD o WHERE o.STORE_ID = s.STORE_ID AND o.ORD_STTS = 'WAIT') AS waitingOrderCount
    FROM TB_STORE s WHERE s.OWNR_MBR_ID = ? AND s.DEL_YN = 'N' ORDER BY s.STORE_ID`).all(owner.MBR_ID);
});

export const POST = handler(async ({ request }) => {
  const owner = requireRole(request, "OWNER");
  const data = storeInput(await readJson(request));
  return created(db.transaction(() => saveStoreApplication(owner.MBR_ID, data)).immediate());
});
