import { handler } from "@/lib/server/http";
import { transitionOrder } from "@/lib/server/orders";
import { ownerStore, ownOrder, unpickedDelivery } from "@/lib/server/owner-orders";

export const runtime = "nodejs";

export const POST = handler(async ({ request, params }) => {
  const { storeId } = ownerStore(request, params);
  const order = ownOrder(storeId, params.orderId);
  transitionOrder(order.ORD_ID, { from: ["COOKING"], to: "READY",
    where: `STORE_ID = ? AND ${unpickedDelivery}`, params: [storeId] });
  return { orderId: order.ORD_ID, status: "READY" };
});
