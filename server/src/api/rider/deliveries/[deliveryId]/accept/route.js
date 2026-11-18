import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { fail, handler, notFound, pathId } from "#lib/http";
import { deliveryDetail } from "#lib/rider";



export const POST = handler(({ request, params }) => {
  const me = requireRole(request, "RIDER");
  const deliveryId = pathId(params.deliveryId, "deliveryId");
  return db.transaction(() => {
    const delivery = db.prepare(`
      SELECT o.ORD_STTS FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
      WHERE d.DLVR_ID = ?
    `).get(deliveryId);
    const rider = db.prepare("SELECT 1 FROM TB_RIDER WHERE MBR_ID = ?").get(me.MBR_ID);
    if (!delivery || !rider) notFound("배달 또는 라이더 정보를 찾을 수 없습니다.");
    if (!["COOKING", "READY"].includes(delivery.ORD_STTS)) {
      fail(409, "ORDER_ALREADY_PROCESSED", "수락할 수 없는 주문 상태입니다.");
    }
    const assigned = db.prepare(`
      UPDATE TB_DLVR SET RIDER_MBR_ID = ?, DSPCH_DTTM = datetime('now', 'localtime')
      WHERE DLVR_ID = ? AND RIDER_MBR_ID IS NULL
    `).run(me.MBR_ID, deliveryId);
    if (!assigned.changes) fail(409, "ALREADY_DISPATCHED", "이미 배차된 요청입니다.");
    const busy = db.prepare("UPDATE TB_RIDER SET RIDER_STTS = 'BUSY' WHERE MBR_ID = ? AND RIDER_STTS = 'IDLE'")
      .run(me.MBR_ID);
    if (!busy.changes) fail(409, "RIDER_BUSY", "이미 배달 중입니다.");
    return deliveryDetail(deliveryId, me.MBR_ID);
  }).immediate();
});
