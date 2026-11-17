import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { fail, handler, int, invalid, notFound, oneOf, readJson } from "#lib/http";
import { expireWaitingOrders } from "#lib/orders";



const profile = (member, rider, currentDeliveryId = null) => ({
  memberId: member.MBR_ID,
  name: member.MBR_NM,
  tel: member.MBR_TELNO,
  vehicleType: rider.VHCL_TYPE_CD,
  actRadiusM: rider.ACT_RADIUS_M,
  riderStatus: rider.RIDER_STTS,
  currentDeliveryId,
});

export const GET = handler(({ request }) => {
  const me = requireRole(request, "RIDER");
  expireWaitingOrders();
  return db.transaction(() => {
    const rider = db.prepare("SELECT * FROM TB_RIDER WHERE MBR_ID = ?").get(me.MBR_ID);
    if (!rider) notFound("라이더 정보를 찾을 수 없습니다.");
    const current = rider.RIDER_STTS === "BUSY" ? db.prepare(`
      SELECT d.DLVR_ID FROM TB_DLVR d JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
      WHERE d.RIDER_MBR_ID = ? AND d.DLVR_CMPL_DTTM IS NULL AND o.ORD_STTS <> 'CANCEL'
      LIMIT 1
    `).get(me.MBR_ID) : null;
    return profile(me, rider, current?.DLVR_ID ?? null);
  })();
});

export const PATCH = handler(async ({ request }) => {
  const me = requireRole(request, "RIDER");
  const body = await readJson(request);
  const assignments = [];
  const values = [];
  if (Object.hasOwn(body, "vehicleType")) {
    values.push(oneOf(body.vehicleType, "vehicleType", ["WALK", "BICYCLE", "MOTORCYCLE", "CAR"]));
    assignments.push("VHCL_TYPE_CD = ?");
  }
  if (Object.hasOwn(body, "actRadiusM")) {
    if (typeof body.actRadiusM !== "number") invalid("actRadiusM", "500~5000의 정수여야 합니다.");
    values.push(int(body.actRadiusM, "actRadiusM", { min: 500, max: 5000 }));
    assignments.push("ACT_RADIUS_M = ?");
  }
  if (!assignments.length) invalid("body", "수정할 필드를 하나 이상 보내 주세요.");
  return db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM TB_RIDER WHERE MBR_ID = ?").get(me.MBR_ID)) {
      notFound("라이더 정보를 찾을 수 없습니다.");
    }
    const result = db.prepare(`UPDATE TB_RIDER SET ${assignments.join(", ")}
      WHERE MBR_ID = ? AND RIDER_STTS = 'IDLE'`).run(...values, me.MBR_ID);
    if (!result.changes) fail(409, "RIDER_BUSY", "배달 중에는 활동 정보를 수정할 수 없습니다.");
    return profile(me, db.prepare("SELECT * FROM TB_RIDER WHERE MBR_ID = ?").get(me.MBR_ID));
  }).immediate();
});
