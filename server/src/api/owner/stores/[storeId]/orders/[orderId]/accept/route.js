import db from "#lib/db";
import { handler, readJson, int } from "#lib/http";
import { transitionOrder, NOW } from "#lib/orders";
import { ownerStore, ownOrder, bodyFields } from "#lib/owner-orders";



export const POST = handler(async ({ request, params }) => {
  const { storeId } = ownerStore(request, params);
  const order = ownOrder(storeId, params.orderId);
  const body = await readJson(request);
  bodyFields(body, ["cookMinutes"]);
  const cookMinutes = int(body.cookMinutes, "cookMinutes", { min: 1 });
  transitionOrder(order.ORD_ID, {
    from: ["WAIT"], to: "COOKING", set: { ORD_RCPT_DTTM: NOW, COOK_EST_MI: cookMinutes },
    checkExpiry: true, where: "STORE_ID = ?", params: [storeId],
    after: () => db.prepare("INSERT INTO TB_DLVR (ORD_ID, RIDER_MBR_ID) VALUES (?, NULL)").run(order.ORD_ID),
  });
  return db.prepare(`SELECT ORD_ID AS orderId, ORD_STTS AS status, ORD_RCPT_DTTM AS acceptedAt,
    COOK_EST_MI AS cookMinutes FROM TB_ORD WHERE ORD_ID = ?`).get(order.ORD_ID);
});
