import { handler } from "#lib/http";
import { transitionOrder } from "#lib/orders";
import { ownerStore, ownOrder, unpickedDelivery } from "#lib/owner-orders";



export const POST = handler(async ({ request, params }) => {
  const { storeId } = ownerStore(request, params);
  const order = ownOrder(storeId, params.orderId);
  transitionOrder(order.ORD_ID, { from: ["COOKING"], to: "READY",
    where: `STORE_ID = ? AND ${unpickedDelivery}`, params: [storeId] });
  return { orderId: order.ORD_ID, status: "READY" };
});
