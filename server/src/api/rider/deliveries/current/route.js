import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler } from "#lib/http";
import { expireWaitingOrders } from "#lib/orders";
import { deliveryDetail } from "#lib/rider";



export const GET = handler(({ request }) => {
  const me = requireRole(request, "RIDER");
  expireWaitingOrders();
  return db.transaction(() => {
    const current = db.prepare(`
      SELECT d.DLVR_ID FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
      WHERE d.RIDER_MBR_ID = ? AND d.DLVR_CMPL_DTTM IS NULL AND o.ORD_STTS <> 'CANCEL'
      LIMIT 1
    `).get(me.MBR_ID);
    return current ? deliveryDetail(current.DLVR_ID, me.MBR_ID) : null;
  })();
});
