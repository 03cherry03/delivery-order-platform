import db from "@/lib/db";
import { fail, forbidden, invalid, notFound } from "@/lib/server/http";
import { DELIVERY_RANGE_M, distanceM } from "@/lib/server/geo";
import { OPER_STATUS_SQL } from "@/lib/server/stores";

export function safeAmount(value, field = "quantity") {
  if (!Number.isSafeInteger(value) || value < 0) invalid(field, "수량과 금액은 안전한 정수 범위여야 합니다.");
  return value;
}

export function selection(menuId, optionIds, storeId) {
  const menu = db.prepare(`SELECT m.*, c.STORE_ID AS CATEGORY_STORE_ID, c.DEL_YN AS CATEGORY_DELETED
    FROM TB_MENU m JOIN TB_MENU_CTGR c ON c.CTGR_ID = m.CTGR_ID WHERE m.MENU_ID = ?`).get(menuId);
  const options = optionIds.map((id) => db.prepare(`SELECT o.*, g.MENU_ID, g.OPT_GRP_NM, g.DEL_YN AS GROUP_DELETED
    FROM TB_MENU_OPT o JOIN TB_MENU_OPT_GRP g ON g.OPT_GRP_ID = o.OPT_GRP_ID WHERE o.OPT_ID = ?`).get(id));
  let issue = null;
  if (!menu || menu.DEL_YN !== "N" || menu.CATEGORY_DELETED !== "N" || menu.STORE_ID !== storeId || menu.CATEGORY_STORE_ID !== storeId) {
    issue = { missing: true, code: "MENU_UNAVAILABLE", message: "메뉴 또는 분류를 사용할 수 없습니다." };
  } else if (menu.MENU_SALE_STTS !== "ON_SALE") {
    issue = { code: "MENU_UNAVAILABLE", message: "품절된 메뉴입니다." };
  } else if (options.some((o) => !o || o.DEL_YN !== "N" || o.GROUP_DELETED !== "N")) {
    issue = { missing: true, code: "INVALID_OPTION_SELECTION", message: "삭제되었거나 없는 옵션입니다." };
  } else if (options.some((o) => o.MENU_ID !== menuId)) {
    issue = { code: "INVALID_OPTION_SELECTION", message: "다른 메뉴의 옵션입니다." };
  } else {
    const groups = db.prepare("SELECT * FROM TB_MENU_OPT_GRP WHERE MENU_ID = ? AND DEL_YN = 'N'").all(menuId);
    for (const group of groups) {
      const count = options.filter((o) => o.OPT_GRP_ID === group.OPT_GRP_ID).length;
      if ((group.RQRD_YN === "Y" && count === 0) || count > group.MAX_SLCT_CNT) {
        issue = { code: "INVALID_OPTION_SELECTION", message: "필수 옵션과 최대 선택 수를 확인해 주세요." };
        break;
      }
    }
  }
  return { menu, options: options.filter(Boolean), issue };
}

export function lineAmount(menuPrice, options, quantity) {
  safeAmount(quantity);
  let unit = safeAmount(menuPrice);
  for (const option of options) unit = safeAmount(unit + safeAmount(option.OPT_AMT));
  return safeAmount(unit * quantity);
}

export function readCart(memberId) {
  const cart = db.prepare("SELECT * FROM TB_CART WHERE MBR_ID = ?").get(memberId);
  if (!cart) return null;
  const store = db.prepare(`SELECT s.*, ${OPER_STATUS_SQL("s")} AS OPER_STATUS FROM TB_STORE s WHERE s.STORE_ID = ?`).get(cart.STORE_ID);
  const items = db.prepare("SELECT * FROM TB_CART_DTL WHERE CART_ID = ? ORDER BY CART_DTL_ID").all(cart.CART_ID).map((row) => {
    const ids = db.prepare("SELECT OPT_ID FROM TB_CART_DTL_OPT WHERE CART_DTL_ID = ? ORDER BY OPT_ID").all(row.CART_DTL_ID).map((o) => o.OPT_ID);
    const current = selection(row.MENU_ID, ids, cart.STORE_ID);
    return { ...row, ...current, lineTotal: lineAmount(current.menu?.MENU_AMT ?? 0, current.options, row.CART_QTY) };
  });
  let orderTotal = 0;
  for (const item of items) orderTotal = safeAmount(orderTotal + item.lineTotal);
  return { cart, store, items, orderTotal, payAmount: safeAmount(orderTotal + store.DLVR_TIP_AMT) };
}

export function checkout(memberId, addressId, payMethod) {
  const address = db.prepare("SELECT * FROM TB_MBR_ADDR WHERE MBR_ADDR_ID = ? AND DEL_YN = 'N'").get(addressId);
  if (!address) notFound("주소를 찾을 수 없습니다.");
  if (address.MBR_ID !== memberId) forbidden();
  const state = readCart(memberId);
  if (!state || !state.items.length) fail(409, "EMPTY_CART", "장바구니가 비어 있습니다.");
  const { store, items, orderTotal, payAmount } = state;
  if (!store || store.DEL_YN !== "N") notFound("가게를 찾을 수 없습니다.");
  if (store.STORE_APRV_STTS !== "APPROVED") fail(409, "STORE_NOT_APPROVED", "승인되지 않은 가게입니다.");
  if (store.OPER_STATUS !== "OPEN") fail(409, "STORE_CLOSED", "현재 영업 중이 아닙니다.");
  const distance = distanceM(address.MBR_LAT, address.MBR_LNG, store.STORE_LAT, store.STORE_LNG);
  if (distance > DELIVERY_RANGE_M) fail(409, "OUT_OF_DELIVERY_RANGE", "배달 가능 범위를 벗어났습니다.");
  for (const item of items) if (item.issue) fail(409, item.issue.code, item.issue.message);
  if (orderTotal < store.MIN_ORD_AMT) fail(409, "MIN_ORDER_NOT_MET", "최소 주문금액을 충족하지 못했습니다.");
  const balance = db.prepare("SELECT PNT_BAL_AMT FROM TB_MBR WHERE MBR_ID = ?").get(memberId).PNT_BAL_AMT;
  if (payMethod === "POINT" && balance < payAmount) fail(409, "INSUFFICIENT_POINTS", "포인트 잔액이 부족합니다.");
  return { ...state, address, distance, balance };
}
