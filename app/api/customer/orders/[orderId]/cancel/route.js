import db from "@/lib/db";
import { handler, pathId, notFound, forbidden } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { cancelOrder } from "@/lib/server/orders";

export const runtime = "nodejs";

export const POST = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const orderId = pathId(params.orderId, "orderId");
  const own = db.prepare("SELECT MBR_ID FROM TB_ORD WHERE ORD_ID = ?").get(orderId);
  if (!own) notFound();
  if (own.MBR_ID !== me.MBR_ID) forbidden();
  return cancelOrder(orderId, {
    from: ["WAIT"], actor: "CUSTOMER", reason: "CUSTOMER_REQUEST", checkExpiry: true,
    where: "MBR_ID = ?", params: [me.MBR_ID],
    after: () => {
      const row = db.prepare(`SELECT o.*, p.PAY_STTS FROM TB_ORD o JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID WHERE o.ORD_ID = ?`).get(orderId);
      return { orderId, status: row.ORD_STTS, cancelActor: row.CNCL_ACTR_CD, cancelReason: row.CNCL_RSN_CD, canceledAt: row.ORD_CNCL_DTTM, refunded: row.PAY_STTS === "CANCELED" };
    },
  });
});
