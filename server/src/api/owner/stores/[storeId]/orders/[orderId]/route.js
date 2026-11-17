import db from "#lib/db";
import { handler } from "#lib/http";
import { expireWaitingOrders } from "#lib/orders";
import { ownerStore, ownOrder } from "#lib/owner-orders";
import { distanceM } from "#lib/geo";



export const GET = handler(async ({ request, params }) => {
  const { storeId, store } = ownerStore(request, params);
  ownOrder(storeId, params.orderId);
  expireWaitingOrders();
  const o = ownOrder(storeId, params.orderId);
  const pay = db.prepare("SELECT PAY_AMT, PAY_MTHD_CD FROM TB_PAY WHERE ORD_ID = ?").get(o.ORD_ID);
  const rider = db.prepare(`SELECT m.MBR_NM AS name, r.VHCL_TYPE_CD AS vehicle,
      d.DSPCH_DTTM AS dispatchedAt, d.PKUP_DTTM AS pickedUpAt
    FROM TB_DLVR d JOIN TB_RIDER r ON r.MBR_ID = d.RIDER_MBR_ID
    JOIN TB_MBR m ON m.MBR_ID = r.MBR_ID WHERE d.ORD_ID = ?`).get(o.ORD_ID) ?? null;
  const items = db.prepare("SELECT * FROM TB_ORD_DTL WHERE ORD_ID = ? ORDER BY ORD_DTL_SEQ").all(o.ORD_ID).map((item) => {
    const options = db.prepare(`SELECT ORD_OPT_GRP_NM AS groupName, ORD_OPT_NM AS optionName, ORD_OPT_AMT AS price
      FROM TB_ORD_DTL_OPT WHERE ORD_DTL_ID = ? ORDER BY ORD_DTL_OPT_ID`).all(item.ORD_DTL_ID);
    return { menuName: item.ORD_MENU_NM, quantity: item.ORD_QTY, unitPrice: item.ORD_UPRC, options,
      lineTotal: (item.ORD_UPRC + options.reduce((sum, option) => sum + option.price, 0)) * item.ORD_QTY };
  });
  return {
    orderId: o.ORD_ID, orderedAt: o.ORD_DTTM, status: o.ORD_STTS, items,
    storeRequest: o.STORE_RQST_CN, riderRequest: o.RIDER_RQST_CN, cutlery: o.CUTLERY_YN === "Y",
    deliveryAddress: o.DLVR_ADDR, deliveryAddressDetail: o.DLVR_DADDR,
    distance: Math.round(distanceM(store.STORE_LAT, store.STORE_LNG, o.DLVR_LAT, o.DLVR_LNG)),
    orderTotal: o.ORD_TOT_AMT, deliveryTip: o.DLVR_TIP_AMT, payAmount: pay.PAY_AMT, payMethod: pay.PAY_MTHD_CD,
    acceptedAt: o.ORD_RCPT_DTTM, cookMinutes: o.COOK_EST_MI, canceledAt: o.ORD_CNCL_DTTM,
    cancelActor: o.CNCL_ACTR_CD, cancelReason: o.CNCL_RSN_CD, cancelReasonDetail: o.ORD_CNCL_RSN_CN, rider,
  };
});
