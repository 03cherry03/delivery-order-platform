import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { distanceM, RIDER_BASE } from "@/lib/server/geo";
import { handler, notFound, num } from "@/lib/server/http";
import { expireWaitingOrders } from "@/lib/server/orders";

export const runtime = "nodejs";

export const GET = handler(({ request, query }) => {
  const me = requireRole(request, "RIDER");
  const lat = query.has("lat") ? num(query.get("lat").trim(), "lat", { min: -90, max: 90 }) : RIDER_BASE.lat;
  const lng = query.has("lng") ? num(query.get("lng").trim(), "lng", { min: -180, max: 180 }) : RIDER_BASE.lng;
  expireWaitingOrders();
  return db.transaction(() => {
    const rider = db.prepare("SELECT ACT_RADIUS_M FROM TB_RIDER WHERE MBR_ID = ?").get(me.MBR_ID);
    if (!rider) notFound("라이더 정보를 찾을 수 없습니다.");
    const rows = db.prepare(`
      SELECT d.DLVR_ID AS deliveryId, o.ORD_ID AS orderId,
        s.STORE_NM AS storeName, s.STORE_ADDR AS storeAddress,
        s.STORE_LAT AS storeLat, s.STORE_LNG AS storeLng,
        o.DLVR_ADDR AS deliveryAddress, o.DLVR_LAT, o.DLVR_LNG,
        o.DLVR_TIP_AMT AS deliveryTip, o.ORD_STTS AS orderStatus,
        datetime(o.ORD_RCPT_DTTM, '+' || o.COOK_EST_MI || ' minutes') AS expectedReadyAt
      FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
      JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID
      WHERE d.RIDER_MBR_ID IS NULL AND o.ORD_STTS IN ('COOKING', 'READY')
      ORDER BY expectedReadyAt ASC, d.DLVR_ID ASC
    `).all();
    const items = [];
    for (const { DLVR_LAT, DLVR_LNG, ...row } of rows) {
      const distance = distanceM(lat, lng, row.storeLat, row.storeLng);
      if (distance <= rider.ACT_RADIUS_M) {
        items.push({
          ...row,
          distanceToStoreM: Math.round(distance),
          deliveryDistanceM: Math.round(distanceM(row.storeLat, row.storeLng, DLVR_LAT, DLVR_LNG)),
        });
      }
    }
    return items;
  })();
});
