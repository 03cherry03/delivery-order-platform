import db from "#lib/db";
import { handler, pathId, notFound } from "#lib/http";
import { requireRole } from "#lib/auth";
import { storeHours } from "#lib/stores";
import { customerAddress, STORE_COLUMNS, storeSummary } from "#lib/customer-stores";



export const GET = handler(({ request, params, query }) => {
  const me = requireRole(request, "CUSTOMER");
  const id = pathId(params.storeId, "storeId");
  const address = customerAddress(me.MBR_ID, pathId(query.get("addressId"), "addressId"));
  const store = db.prepare(`SELECT ${STORE_COLUMNS}, s.STORE_TELNO AS telNo,
    s.STORE_ADDR AS address, s.STORE_CN AS description FROM TB_STORE s
    JOIN V_STORE_RATING r ON r.STORE_ID = s.STORE_ID
    WHERE s.STORE_ID = ? AND s.DEL_YN = 'N' AND s.STORE_APRV_STTS = 'APPROVED'`).get(id);
  if (!store) notFound();
  return { ...storeSummary(store, address), telNo: store.telNo, address: store.address,
    description: store.description, ...storeHours(id), cookMinutes: store.cookMinutes };
});
