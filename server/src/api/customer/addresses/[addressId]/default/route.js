import db from "#lib/db";
import { handler, pathId } from "#lib/http";
import { requireRole } from "#lib/auth";
import { customerAddress } from "#lib/customer-stores";



export const PATCH = handler(({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const id = pathId(params.addressId, "addressId");
  return db.transaction(() => {
    customerAddress(me.MBR_ID, id);
    db.prepare("UPDATE TB_MBR_ADDR SET DFLT_YN = 'N' WHERE MBR_ID = ? AND DEL_YN = 'N' AND DFLT_YN = 'Y'").run(me.MBR_ID);
    db.prepare("UPDATE TB_MBR_ADDR SET DFLT_YN = 'Y' WHERE MBR_ADDR_ID = ?").run(id);
    return { addressId: id, isDefault: true };
  })();
});
