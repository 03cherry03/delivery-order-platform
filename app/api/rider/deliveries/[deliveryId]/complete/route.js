import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { fail, forbidden, handler, notFound, pathId } from "@/lib/server/http";
import { transitionOrder } from "@/lib/server/orders";

export const runtime = "nodejs";

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
    if (["COOKING", "READY"].includes(delivery.ORD_STTS)) {
      fail(409, "NOT_PICKED_UP", "아직 픽업하지 않은 주문입니다.");
    }
    return transitionOrder(delivery.ORD_ID, {
      from: ["DELIVERING"],
      to: "DONE",
      after: () => {
        db.prepare("UPDATE TB_DLVR SET DLVR_CMPL_DTTM = datetime('now', 'localtime') WHERE DLVR_ID = ?")
          .run(deliveryId);
        db.prepare("UPDATE TB_RIDER SET RIDER_STTS = 'IDLE' WHERE MBR_ID = ?").run(me.MBR_ID);
        return db.prepare("SELECT DLVR_ID AS deliveryId, DLVR_CMPL_DTTM AS completedAt FROM TB_DLVR WHERE DLVR_ID = ?")
          .get(deliveryId);
      },
    });
  }).immediate();
});
