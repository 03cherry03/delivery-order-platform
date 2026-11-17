import db from "@/lib/db";
import { handler, pathId, readJson, oneOf, str, notFound } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { cancelOrder } from "@/lib/server/orders";
import { CANCELABLE_ORDER_STATES } from "@/lib/server/admin";

export const runtime = "nodejs";

export const POST = handler(async ({ request, params }) => {
  const admin = requireRole(request, "ADMIN");
  const orderId = pathId(params.orderId, "orderId");
  const body = await readJson(request);
  const reason = oneOf(body.reason, "reason", ["CUSTOMER_REQUEST", "STORE_ISSUE", "DELIVERY_FAIL", "ETC"]);
  const counselNote = str(body.counselNote, "counselNote", { max: 300 });
  const reasonDetail = str(body.reasonDetail, "reasonDetail", { required: reason === "ETC" }) ?? null;
  return db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM TB_ORD WHERE ORD_ID = ?").get(orderId)) notFound();
    return cancelOrder(orderId, {
      from: CANCELABLE_ORDER_STATES, actor: "ADMIN", reason, reasonDetail, processorId: admin.MBR_ID, memo: counselNote,
      after: () => ({ ...db.prepare(`SELECT ORD_ID AS orderId, ORD_STTS AS status, ORD_CNCL_DTTM AS canceledAt
        FROM TB_ORD WHERE ORD_ID = ?`).get(orderId), refunded: true }),
    });
  })();
});
