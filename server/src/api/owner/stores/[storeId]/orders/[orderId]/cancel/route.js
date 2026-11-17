import db from "#lib/db";
import { handler, readJson, oneOf } from "#lib/http";
import { cancelOrder } from "#lib/orders";
import { ownerStore, ownOrder, reasonDetail, unpickedDelivery, bodyFields } from "#lib/owner-orders";



export const POST = handler(async ({ request, params }) => {
  const { storeId } = ownerStore(request, params);
  const order = ownOrder(storeId, params.orderId);
  const body = await readJson(request);
  bodyFields(body, ["reason", "reasonDetail"]);
  const reason = oneOf(body.reason, "reason", ["OUT_OF_STOCK", "CANNOT_COOK", "ETC"]);
  cancelOrder(order.ORD_ID, { from: ["COOKING"], actor: "OWNER", reason, reasonDetail: reasonDetail(body),
    where: `STORE_ID = ? AND ${unpickedDelivery}`, params: [storeId] });
  return db.prepare(`SELECT ORD_ID AS orderId, ORD_STTS AS status, ORD_CNCL_DTTM AS canceledAt
    FROM TB_ORD WHERE ORD_ID = ?`).get(order.ORD_ID);
});
