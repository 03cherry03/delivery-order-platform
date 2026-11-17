import db from "@/lib/db";
import { handler, pathId, notFound } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { expireWaitingOrders } from "@/lib/server/orders";
import { distanceM } from "@/lib/server/geo";
import { CANCELABLE_ORDER_STATES } from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = handler(({ request, params }) => {
  requireRole(request, "ADMIN");
  const orderId = pathId(params.orderId, "orderId");
  expireWaitingOrders();
  const order = db.prepare(`SELECT o.*, p.PAY_AMT, p.PAY_MTHD_CD,
    m.MBR_NM AS CUSTOMER_NAME, m.MBR_EMAIL AS CUSTOMER_EMAIL, m.MBR_TELNO AS CUSTOMER_TEL,
    s.STORE_NM, s.STORE_TELNO, s.STORE_LAT, s.STORE_LNG,
    d.RIDER_MBR_ID, d.DSPCH_DTTM, d.PKUP_DTTM, d.DLVR_CMPL_DTTM,
    rider.MBR_NM AS RIDER_NAME, r.VHCL_TYPE_CD, processor.MBR_NM AS PROCESSOR_NAME
    FROM TB_ORD o JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
    JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
    LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID LEFT JOIN TB_RIDER r ON r.MBR_ID = d.RIDER_MBR_ID
    LEFT JOIN TB_MBR rider ON rider.MBR_ID = r.MBR_ID
    LEFT JOIN TB_MBR processor ON processor.MBR_ID = o.CNCL_PRCSR_MBR_ID WHERE o.ORD_ID = ?`).get(orderId);
  if (!order) notFound();
  const options = db.prepare(`SELECT opt.ORD_DTL_ID, opt.ORD_OPT_GRP_NM AS groupName,
    opt.ORD_OPT_NM AS optionName, opt.ORD_OPT_AMT AS price FROM TB_ORD_DTL_OPT opt
    JOIN TB_ORD_DTL item ON item.ORD_DTL_ID = opt.ORD_DTL_ID
    WHERE item.ORD_ID = ? ORDER BY opt.ORD_DTL_OPT_ID`).all(orderId);
  const optionsByItem = new Map();
  for (const { ORD_DTL_ID, ...option } of options) {
    if (!optionsByItem.has(ORD_DTL_ID)) optionsByItem.set(ORD_DTL_ID, []);
    optionsByItem.get(ORD_DTL_ID).push(option);
  }
  const items = db.prepare(`SELECT ORD_DTL_ID, ORD_MENU_NM AS menuName, ORD_QTY AS quantity,
    ORD_UPRC AS unitPrice FROM TB_ORD_DTL WHERE ORD_ID = ? ORDER BY ORD_DTL_SEQ`).all(orderId)
    .map(({ ORD_DTL_ID, ...item }) => {
      const itemOptions = optionsByItem.get(ORD_DTL_ID) ?? [];
      return { ...item, options: itemOptions,
        lineTotal: (item.unitPrice + itemOptions.reduce((sum, option) => sum + option.price, 0)) * item.quantity };
    });
  return {
    orderId, orderedAt: order.ORD_DTTM, status: order.ORD_STTS, items,
    storeRequest: order.STORE_RQST_CN, riderRequest: order.RIDER_RQST_CN, cutlery: order.CUTLERY_YN === "Y",
    deliveryAddress: order.DLVR_ADDR, deliveryAddressDetail: order.DLVR_DADDR,
    distance: Math.round(distanceM(order.STORE_LAT, order.STORE_LNG, order.DLVR_LAT, order.DLVR_LNG)),
    orderTotal: order.ORD_TOT_AMT, deliveryTip: order.DLVR_TIP_AMT,
    payAmount: order.PAY_AMT, payMethod: order.PAY_MTHD_CD,
    acceptedAt: order.ORD_RCPT_DTTM, cookMinutes: order.COOK_EST_MI,
    canceledAt: order.ORD_CNCL_DTTM, cancelActor: order.CNCL_ACTR_CD,
    cancelReason: order.CNCL_RSN_CD, cancelReasonDetail: order.ORD_CNCL_RSN_CN,
    rider: order.RIDER_MBR_ID === null ? null : { name: order.RIDER_NAME, vehicle: order.VHCL_TYPE_CD,
      dispatchedAt: order.DSPCH_DTTM, pickedUpAt: order.PKUP_DTTM },
    customer: { memberId: order.MBR_ID, name: order.CUSTOMER_NAME, email: order.CUSTOMER_EMAIL, tel: order.CUSTOMER_TEL },
    store: { storeId: order.STORE_ID, storeName: order.STORE_NM, telNo: order.STORE_TELNO },
    timeline: { orderedAt: order.ORD_DTTM, acceptedAt: order.ORD_RCPT_DTTM, canceledAt: order.ORD_CNCL_DTTM,
      dispatchedAt: order.DSPCH_DTTM, pickedUpAt: order.PKUP_DTTM, deliveredAt: order.DLVR_CMPL_DTTM },
    canCancel: CANCELABLE_ORDER_STATES.includes(order.ORD_STTS),
    cancelProcessor: order.CNCL_PRCSR_MBR_ID === null ? null : { memberId: order.CNCL_PRCSR_MBR_ID, name: order.PROCESSOR_NAME },
    counselNote: order.CNSL_MEMO_CN,
  };
});
