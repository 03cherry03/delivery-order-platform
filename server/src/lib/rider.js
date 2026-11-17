import db from "#lib/db";

// 수락·현재 배달·픽업 응답을 같은 조회로 구성한다.
export function deliveryDetail(deliveryId, riderId) {
  const row = db.prepare(`
    SELECT d.DLVR_ID, d.ORD_ID, d.DSPCH_DTTM, d.PKUP_DTTM,
      o.ORD_STTS, o.DLVR_ADDR, o.DLVR_DADDR, o.DLVR_LAT, o.DLVR_LNG,
      o.RIDER_RQST_CN, o.DLVR_TIP_AMT,
      datetime(o.ORD_RCPT_DTTM, '+' || o.COOK_EST_MI || ' minutes') AS expectedReadyAt,
      s.STORE_NM, s.STORE_ADDR, s.STORE_TELNO, s.STORE_LAT, s.STORE_LNG,
      CASE WHEN m.MBR_STTS = 'ACTIVE' THEN m.MBR_TELNO ELSE NULL END AS customerTel,
      (SELECT COUNT(*) FROM TB_ORD_DTL i WHERE i.ORD_ID = o.ORD_ID) AS itemCount,
      (SELECT i.ORD_MENU_NM FROM TB_ORD_DTL i WHERE i.ORD_ID = o.ORD_ID
        ORDER BY i.ORD_DTL_SEQ LIMIT 1) AS firstItem
    FROM TB_DLVR d
    JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
    JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID
    JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
    WHERE d.DLVR_ID = ? AND d.RIDER_MBR_ID = ?
  `).get(deliveryId, riderId);
  if (!row) return null;
  return {
    deliveryId: row.DLVR_ID,
    orderId: row.ORD_ID,
    orderStatus: row.ORD_STTS,
    store: {
      name: row.STORE_NM,
      address: row.STORE_ADDR,
      tel: row.STORE_TELNO,
      lat: row.STORE_LAT,
      lng: row.STORE_LNG,
    },
    delivery: {
      address: row.DLVR_ADDR,
      addressDetail: row.DLVR_DADDR,
      lat: row.DLVR_LAT,
      lng: row.DLVR_LNG,
      customerTel: row.customerTel,
      riderRequest: row.RIDER_RQST_CN,
    },
    itemSummary: (row.firstItem ?? "") + (row.itemCount > 1 ? ` 외 ${row.itemCount - 1}건` : ""),
    itemCount: row.itemCount,
    deliveryTip: row.DLVR_TIP_AMT,
    expectedReadyAt: row.expectedReadyAt,
    dispatchedAt: row.DSPCH_DTTM,
    pickedUpAt: row.PKUP_DTTM,
  };
}
