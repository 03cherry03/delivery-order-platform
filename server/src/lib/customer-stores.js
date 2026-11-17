import db from "#lib/db";
import { forbidden, notFound } from "#lib/http";
import { distanceM, DELIVERY_RANGE_M } from "#lib/geo";
import { IN_HOURS_SQL, OPER_STATUS_SQL } from "#lib/stores";

export function customerAddress(memberId, addressId) {
  const address = db.prepare("SELECT * FROM TB_MBR_ADDR WHERE MBR_ADDR_ID = ? AND DEL_YN = 'N'").get(addressId);
  if (!address) notFound();
  if (address.MBR_ID !== memberId) forbidden();
  return address;
}

export function publicStore(storeId) {
  const store = db.prepare("SELECT STORE_ID FROM TB_STORE WHERE STORE_ID = ? AND DEL_YN = 'N' AND STORE_APRV_STTS = 'APPROVED'").get(storeId);
  if (!store) notFound();
  return store;
}

export const STORE_COLUMNS = `s.STORE_ID AS storeId, s.STORE_NM AS storeName,
  s.STORE_CTGR_CD AS categoryCode, s.STORE_LAT AS lat, s.STORE_LNG AS lng,
  s.MIN_ORD_AMT AS minOrderAmount, s.DLVR_TIP_AMT AS deliveryTip,
  s.COOK_EST_MI AS cookMinutes, r.AVG_RTNG AS avgRating, r.RVW_CNT AS reviewCount,
  ${OPER_STATUS_SQL("s")} AS operStatus,
  (s.STORE_OPER_STTS = 'OPEN' AND ${IN_HOURS_SQL("s")}) AS isOpenNow,
  EXISTS (SELECT 1 FROM TB_MENU m JOIN TB_MENU_CTGR c ON c.CTGR_ID = m.CTGR_ID
    AND c.STORE_ID = m.STORE_ID AND c.DEL_YN = 'N'
    WHERE m.STORE_ID = s.STORE_ID AND m.DEL_YN = 'N' AND m.MENU_SALE_STTS = 'ON_SALE') AS hasMenu`;

export function storeSummary(store, address, actualDistance = distanceM(address.MBR_LAT, address.MBR_LNG, store.lat, store.lng)) {
  return {
    storeId: store.storeId,
    storeName: store.storeName,
    categoryCode: store.categoryCode,
    operStatus: store.operStatus,
    isOpenNow: Boolean(store.isOpenNow),
    distance: Math.round(actualDistance),
    minOrderAmount: store.minOrderAmount,
    deliveryTip: store.deliveryTip,
    estimatedDeliveryMinutes: Math.ceil(store.cookMinutes + actualDistance / 1000 * 3),
    avgRating: store.avgRating,
    reviewCount: store.reviewCount,
    canOrder: Boolean(store.isOpenNow && store.hasMenu && actualDistance <= DELIVERY_RANGE_M),
  };
}
