import db from "#lib/db";
import { handler, readJson, int, oneOf, str, bool, created, fail, invalid, pageOf, paged } from "#lib/http";
import { requireRole } from "#lib/auth";
import { checkout } from "#lib/cart";
import { expireWaitingOrders } from "#lib/orders";



export const POST = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  const body = await readJson(request);
  if (typeof body.addressId !== "number") invalid("addressId", "정수여야 합니다.");
  const addressId = int(body.addressId, "addressId", { min: 1 });
  const payMethod = oneOf(body.payMethod, "payMethod", ["CARD", "KAKAO", "NAVER", "POINT"]);
  for (const field of ["storeRequest", "riderRequest"]) {
    if (body[field] !== undefined && typeof body[field] !== "string") invalid(field, "문자열이어야 합니다.");
  }
  const storeRequest = str(body.storeRequest, "storeRequest", { required: false, min: 0, max: 500 }) ?? null;
  const riderRequest = str(body.riderRequest, "riderRequest", { required: false, min: 0, max: 500 }) ?? null;
  const cutlery = body.cutlery === undefined ? false : bool(body.cutlery, "cutlery");
  return created(db.transaction(() => {
    const { cart, store, address, items, orderTotal, payAmount } = checkout(me.MBR_ID, addressId, payMethod);
    const orderId = Number(db.prepare(`INSERT INTO TB_ORD
      (MBR_ID, STORE_ID, ORD_STTS, ORD_TOT_AMT, DLVR_TIP_AMT, STORE_RQST_CN, RIDER_RQST_CN, CUTLERY_YN, DLVR_ADDR, DLVR_DADDR, DLVR_LAT, DLVR_LNG)
      VALUES (?, ?, 'WAIT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(me.MBR_ID, store.STORE_ID, orderTotal, store.DLVR_TIP_AMT, storeRequest, riderRequest, cutlery ? "Y" : "N", address.MBR_ADDR, address.MBR_DADDR, address.MBR_LAT, address.MBR_LNG).lastInsertRowid);
    const insertDetail = db.prepare(`INSERT INTO TB_ORD_DTL (ORD_ID, ORD_DTL_SEQ, MENU_ID, ORD_MENU_NM, ORD_QTY, ORD_UPRC) VALUES (?, ?, ?, ?, ?, ?)`);
    const insertOption = db.prepare(`INSERT INTO TB_ORD_DTL_OPT (ORD_DTL_ID, OPT_ID, ORD_OPT_GRP_NM, ORD_OPT_NM, ORD_OPT_AMT) VALUES (?, ?, ?, ?, ?)`);
    for (const [index, item] of items.entries()) {
      const detailId = Number(insertDetail.run(orderId, index + 1, item.MENU_ID, item.menu.MENU_NM, item.CART_QTY, item.menu.MENU_AMT).lastInsertRowid);
      for (const option of item.options) insertOption.run(detailId, option.OPT_ID, option.OPT_GRP_NM, option.OPT_NM, option.OPT_AMT);
    }
    db.prepare(`INSERT INTO TB_PAY (ORD_ID, PAY_MTHD_CD, PAY_AMT, PAY_STTS, PAY_APRV_DTTM)
      VALUES (?, ?, ?, 'APPROVED', datetime('now', 'localtime'))`).run(orderId, payMethod, payAmount);
    if (payMethod === "POINT" && payAmount > 0) {
      const result = db.prepare("UPDATE TB_MBR SET PNT_BAL_AMT = PNT_BAL_AMT - ? WHERE MBR_ID = ? AND PNT_BAL_AMT >= ?").run(payAmount, me.MBR_ID, payAmount);
      if (result.changes !== 1) fail(409, "INSUFFICIENT_POINTS", "포인트 잔액이 부족합니다.");
      db.prepare(`INSERT INTO TB_PNT_TXN (MBR_ID, ORD_ID, PNT_TXN_TYPE_CD, PNT_TXN_AMT, PNT_BAL_AMT, PNT_TXN_STTS)
        SELECT MBR_ID, ?, 'USE', ?, PNT_BAL_AMT, 'COMPLETED' FROM TB_MBR WHERE MBR_ID = ?`).run(orderId, payAmount, me.MBR_ID);
    }
    db.prepare("DELETE FROM TB_CART WHERE CART_ID = ? AND MBR_ID = ?").run(cart.CART_ID, me.MBR_ID);
    const row = db.prepare("SELECT ORD_DTTM, datetime(ORD_DTTM, '+10 minutes') AS AUTO_CANCEL_AT FROM TB_ORD WHERE ORD_ID = ?").get(orderId);
    return { orderId, status: "WAIT", orderedAt: row.ORD_DTTM, orderTotal, deliveryTip: store.DLVR_TIP_AMT, payAmount, payMethod, paymentStatus: "APPROVED", autoCancelAt: row.AUTO_CANCEL_AT };
  })());
});

export const GET = handler(async ({ request, query }) => {
  const me = requireRole(request, "CUSTOMER");
  const pg = pageOf(query);
  const status = oneOf(query.get("status") ?? "ALL", "status", ["ALL", "WAIT", "COOKING", "READY", "DELIVERING", "DONE", "CANCEL"]);
  expireWaitingOrders();
  const where = `o.MBR_ID = ?${status === "ALL" ? "" : " AND o.ORD_STTS = ?"}`;
  const args = status === "ALL" ? [me.MBR_ID] : [me.MBR_ID, status];
  const totalCount = db.prepare(`SELECT COUNT(*) AS count FROM TB_ORD o WHERE ${where}`).get(...args).count;
  const rows = db.prepare(`SELECT o.*, s.STORE_NM, p.PAY_AMT, p.PAY_MTHD_CD,
      (SELECT ORD_MENU_NM FROM TB_ORD_DTL WHERE ORD_ID = o.ORD_ID ORDER BY ORD_DTL_SEQ LIMIT 1) AS FIRST_MENU,
      (SELECT COUNT(*) FROM TB_ORD_DTL WHERE ORD_ID = o.ORD_ID) AS DETAIL_COUNT,
      (o.ORD_STTS = 'DONE' AND d.DLVR_CMPL_DTTM IS NOT NULL
        AND d.DLVR_CMPL_DTTM >= datetime('now', 'localtime', '-72 hours')
        AND NOT EXISTS (SELECT 1 FROM TB_RVW r WHERE r.ORD_ID = o.ORD_ID)
        AND NOT EXISTS (SELECT 1 FROM TB_MBR_RSTR x WHERE x.MBR_ID = o.MBR_ID AND x.RSTR_TYPE_CD = 'REVIEW_WRITE'
          AND x.RSTR_STRT_DTTM <= datetime('now', 'localtime') AND (x.RSTR_END_DTTM IS NULL OR x.RSTR_END_DTTM > datetime('now', 'localtime')))) AS CAN_REVIEW
    FROM TB_ORD o JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
    LEFT JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID
    WHERE ${where} ORDER BY o.ORD_DTTM DESC, o.ORD_ID DESC LIMIT ? OFFSET ?`).all(...args, pg.size, pg.offset);
  return paged(pg, rows.map((row) => ({
    orderId: row.ORD_ID, storeId: row.STORE_ID, storeName: row.STORE_NM, orderedAt: row.ORD_DTTM,
    status: row.ORD_STTS, summary: `${row.FIRST_MENU ?? ""} 외 ${Math.max(0, row.DETAIL_COUNT - 1)}건`,
    payAmount: row.PAY_AMT, payMethod: row.PAY_MTHD_CD, canCancel: row.ORD_STTS === "WAIT", canReview: !!row.CAN_REVIEW,
  })), totalCount);
});
