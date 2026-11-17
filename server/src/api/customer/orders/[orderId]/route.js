import db from "#lib/db";
import { handler, pathId, notFound, forbidden } from "#lib/http";
import { requireRole } from "#lib/auth";
import { expireWaitingOrders } from "#lib/orders";



export const GET = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const orderId = pathId(params.orderId, "orderId");
  const own = db.prepare("SELECT MBR_ID FROM TB_ORD WHERE ORD_ID = ?").get(orderId);
  if (!own) notFound();
  if (own.MBR_ID !== me.MBR_ID) forbidden();
  expireWaitingOrders();
  const row = db.prepare(`SELECT o.*, s.STORE_NM, p.PAY_AMT, p.PAY_MTHD_CD,
      datetime(o.ORD_DTTM, '+10 minutes') AS AUTO_CANCEL_AT,
      d.RIDER_MBR_ID, d.DSPCH_DTTM, d.PKUP_DTTM, d.DLVR_CMPL_DTTM, m.MBR_NM AS RIDER_NAME, rider.VHCL_TYPE_CD,
      r.RVW_ID, r.RVW_HDN_YN, r.DEL_YN AS REVIEW_DELETED,
      (o.ORD_STTS = 'DONE' AND d.DLVR_CMPL_DTTM IS NOT NULL AND d.DLVR_CMPL_DTTM >= datetime('now', 'localtime', '-72 hours')) AS IN_REVIEW_PERIOD,
      EXISTS (SELECT 1 FROM TB_MBR_RSTR x WHERE x.MBR_ID = o.MBR_ID AND x.RSTR_TYPE_CD = 'REVIEW_WRITE'
        AND x.RSTR_STRT_DTTM <= datetime('now', 'localtime') AND (x.RSTR_END_DTTM IS NULL OR x.RSTR_END_DTTM > datetime('now', 'localtime'))) AS RESTRICTED
    FROM TB_ORD o JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
    LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID LEFT JOIN TB_MBR m ON m.MBR_ID = d.RIDER_MBR_ID
    LEFT JOIN TB_RIDER rider ON rider.MBR_ID = d.RIDER_MBR_ID LEFT JOIN TB_RVW r ON r.ORD_ID = o.ORD_ID
    WHERE o.ORD_ID = ? AND o.MBR_ID = ?`).get(orderId, me.MBR_ID);
  const items = db.prepare("SELECT * FROM TB_ORD_DTL WHERE ORD_ID = ? ORDER BY ORD_DTL_SEQ").all(orderId).map((item) => {
    const options = db.prepare(`SELECT ORD_OPT_GRP_NM AS groupName, ORD_OPT_NM AS optionName, ORD_OPT_AMT AS price
      FROM TB_ORD_DTL_OPT WHERE ORD_DTL_ID = ? ORDER BY ORD_DTL_OPT_ID`).all(item.ORD_DTL_ID);
    return { menuName: item.ORD_MENU_NM, quantity: item.ORD_QTY, unitPrice: item.ORD_UPRC, options,
      lineTotal: (item.ORD_UPRC + options.reduce((sum, option) => sum + option.price, 0)) * item.ORD_QTY };
  });
  const hasReview = row.RVW_ID !== null && row.REVIEW_DELETED === "N";
  return {
    orderId, store: { storeId: row.STORE_ID, storeName: row.STORE_NM }, orderedAt: row.ORD_DTTM, status: row.ORD_STTS,
    autoCancelAt: row.ORD_STTS === "WAIT" ? row.AUTO_CANCEL_AT : null, items,
    storeRequest: row.STORE_RQST_CN, riderRequest: row.RIDER_RQST_CN, cutlery: row.CUTLERY_YN === "Y",
    deliveryAddress: row.DLVR_ADDR, deliveryAddressDetail: row.DLVR_DADDR,
    orderTotal: row.ORD_TOT_AMT, deliveryTip: row.DLVR_TIP_AMT, payAmount: row.PAY_AMT, payMethod: row.PAY_MTHD_CD,
    acceptedAt: row.ORD_RCPT_DTTM, cookMinutes: row.COOK_EST_MI,
    rider: row.RIDER_MBR_ID === null ? null : { name: row.RIDER_NAME, vehicle: row.VHCL_TYPE_CD, dispatchedAt: row.DSPCH_DTTM, pickedUpAt: row.PKUP_DTTM },
    deliveredAt: row.DLVR_CMPL_DTTM, canceledAt: row.ORD_CNCL_DTTM, cancelActor: row.CNCL_ACTR_CD,
    cancelReason: row.CNCL_RSN_CD, cancelReasonDetail: row.ORD_CNCL_RSN_CN,
    canCancel: row.ORD_STTS === "WAIT", canReview: !!row.IN_REVIEW_PERIOD && row.RVW_ID === null && !row.RESTRICTED,
    myReview: { reviewId: hasReview ? row.RVW_ID : null, isHidden: hasReview && row.RVW_HDN_YN === "Y", canEdit: hasReview && row.RVW_HDN_YN === "N" && !!row.IN_REVIEW_PERIOD },
  };
});
