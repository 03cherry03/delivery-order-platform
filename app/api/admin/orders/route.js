import db from "@/lib/db";
import { handler, str, invalid, EMAIL } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { expireWaitingOrders } from "@/lib/server/orders";
import { CANCELABLE_ORDER_STATES } from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = handler(({ request, query }) => {
  requireRole(request, "ADMIN");
  const keyword = str(query.get("keyword"), "keyword");
  let where;
  let value = keyword;
  if (keyword.includes("@")) {
    if (!EMAIL.test(keyword)) invalid("keyword", "이메일 형식이 올바르지 않습니다.");
    where = "m.MBR_EMAIL = ?";
  } else if (keyword.includes("-") || keyword.startsWith("010")) {
    if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(keyword)) invalid("keyword", "전화번호 형식이 올바르지 않습니다.");
    where = "replace(m.MBR_TELNO, '-', '') = ?";
    value = keyword.replaceAll("-", "");
  } else {
    if (!/^\d+$/.test(keyword) || !Number.isSafeInteger(Number(keyword)) || Number(keyword) < 1) {
      invalid("keyword", "주문번호·이메일·전화번호로 검색해 주세요.");
    }
    where = "o.ORD_ID = ?";
    value = Number(keyword);
  }
  expireWaitingOrders();
  return db.prepare(`SELECT o.ORD_ID AS orderId, o.ORD_DTTM AS orderedAt, o.ORD_STTS AS status,
    m.MBR_NM AS customerName, m.MBR_TELNO AS customerTel, s.STORE_NM AS storeName, p.PAY_AMT AS payAmount
    FROM TB_ORD o JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
    JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
    WHERE ${where} ORDER BY o.ORD_DTTM DESC, o.ORD_ID DESC LIMIT 50`).all(value)
    .map((row) => ({ ...row, canCancel: CANCELABLE_ORDER_STATES.includes(row.status) }));
});
