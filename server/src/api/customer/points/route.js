import db from "#lib/db";
import { handler, pageOf, paged } from "#lib/http";
import { requireRole } from "#lib/auth";



export const GET = handler(({ request, query }) => {
  const me = requireRole(request, "CUSTOMER");
  const pg = pageOf(query);
  const items = db.prepare(`SELECT PNT_TXN_ID AS transactionId, PNT_TXN_TYPE_CD AS type,
    PNT_TXN_AMT AS amount, PNT_BAL_AMT AS balanceAfter, CHRG_MTHD_CD AS method,
    ORD_ID AS orderId, PNT_TXN_STTS AS status, PNT_TXN_DTTM AS occurredAt
    FROM TB_PNT_TXN WHERE MBR_ID = ? ORDER BY PNT_TXN_DTTM DESC, PNT_TXN_ID DESC LIMIT ? OFFSET ?`)
    .all(me.MBR_ID, pg.size, pg.offset);
  const { totalCount } = db.prepare("SELECT COUNT(*) AS totalCount FROM TB_PNT_TXN WHERE MBR_ID = ?").get(me.MBR_ID);
  return { balance: me.PNT_BAL_AMT, ...paged(pg, items, totalCount) };
});
