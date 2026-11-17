import db from "@/lib/db";
import { handler, pathId } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { customerAddress } from "@/lib/server/customer-stores";

export const runtime = "nodejs";

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
