import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { fail, forbidden, handler, notFound, pathId } from "#lib/http";
import { transitionOrder } from "#lib/orders";
import { deliveryDetail } from "#lib/rider";



export const POST = handler(({ request, params }) => {
  const me = requireRole(request, "RIDER");
  const deliveryId = pathId(params.deliveryId, "deliveryId");
  return db.transaction(() => {
    const delivery = db.prepare(`
      SELECT d.RIDER_MBR_ID, d.ORD_ID, o.ORD_STTS
      FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID WHERE d.DLVR_ID = ?
    `).get(deliveryId);
    if (!delivery) notFound("배달을 찾을 수 없습니다.");
    if (delivery.RIDER_MBR_ID !== me.MBR_ID) forbidden("내 배달이 아닙니다.");
    if (delivery.ORD_STTS === "COOKING") fail(409, "NOT_READY", "아직 조리 중인 주문입니다.");
    return transitionOrder(delivery.ORD_ID, {
      from: ["READY"],
      to: "DELIVERING",
      after: () => {
        db.prepare("UPDATE TB_DLVR SET PKUP_DTTM = datetime('now', 'localtime') WHERE DLVR_ID = ?")
          .run(deliveryId);
        return deliveryDetail(deliveryId, me.MBR_ID);
      },
    });
  }).immediate();
});
