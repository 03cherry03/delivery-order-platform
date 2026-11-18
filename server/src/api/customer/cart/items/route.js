import db from "#lib/db";
import { handler, readJson, int, intArray, bool, created, invalid, notFound, fail } from "#lib/http";
import { requireRole } from "#lib/auth";
import { selection, lineAmount, safeAmount, readCart } from "#lib/cart";



export const POST = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  const body = await readJson(request);
  for (const field of ["storeId", "menuId", "quantity"]) {
    if (typeof body[field] !== "number") invalid(field, "정수여야 합니다.");
  }
  if (!Array.isArray(body.optionIds) || body.optionIds.some((id) => typeof id !== "number")) invalid("optionIds", "정수 배열이어야 합니다.");
  const storeId = int(body.storeId, "storeId", { min: 1 });
  const menuId = int(body.menuId, "menuId", { min: 1 });
  const quantity = int(body.quantity, "quantity", { min: 1 });
  const optionIds = intArray(body.optionIds, "optionIds").sort((a, b) => a - b);
  if (new Set(optionIds).size !== optionIds.length) invalid("optionIds", "중복 선택할 수 없습니다.");
  const replaceCart = body.replaceCart === undefined ? false : bool(body.replaceCart, "replaceCart");
  return created(db.transaction(() => {
    const store = db.prepare("SELECT * FROM TB_STORE WHERE STORE_ID = ? AND DEL_YN = 'N' AND STORE_APRV_STTS = 'APPROVED'").get(storeId);
    if (!store) notFound();
    const current = selection(menuId, optionIds, storeId);
    if (current.issue?.missing) notFound(current.issue.message);
    if (current.issue) fail(409, current.issue.code, current.issue.message);
    lineAmount(current.menu.MENU_AMT, current.options, quantity);
    let cart = db.prepare("SELECT * FROM TB_CART WHERE MBR_ID = ?").get(me.MBR_ID);
    if (cart && cart.STORE_ID !== storeId) {
      if (!replaceCart) fail(409, "CART_STORE_CONFLICT", "다른 가게의 장바구니가 있습니다.");
      db.prepare("DELETE FROM TB_CART WHERE CART_ID = ?").run(cart.CART_ID);
      cart = null;
    }
    if (!cart) cart = { CART_ID: Number(db.prepare("INSERT INTO TB_CART (MBR_ID, STORE_ID) VALUES (?, ?)").run(me.MBR_ID, storeId).lastInsertRowid) };
    const matching = db.prepare("SELECT * FROM TB_CART_DTL WHERE CART_ID = ? AND MENU_ID = ? ORDER BY CART_DTL_ID").all(cart.CART_ID, menuId).find((item) => {
      const existing = db.prepare("SELECT OPT_ID FROM TB_CART_DTL_OPT WHERE CART_DTL_ID = ? ORDER BY OPT_ID").all(item.CART_DTL_ID);
      return existing.length === optionIds.length && existing.every((o, i) => o.OPT_ID === optionIds[i]);
    });
    let cartItemId;
    let mergedQuantity = quantity;
    if (matching) {
      mergedQuantity = safeAmount(matching.CART_QTY + quantity);
      lineAmount(current.menu.MENU_AMT, current.options, mergedQuantity);
      cartItemId = matching.CART_DTL_ID;
      db.prepare("UPDATE TB_CART_DTL SET CART_QTY = ? WHERE CART_DTL_ID = ?").run(mergedQuantity, cartItemId);
    } else {
      cartItemId = Number(db.prepare("INSERT INTO TB_CART_DTL (CART_ID, MENU_ID, CART_QTY) VALUES (?, ?, ?)").run(cart.CART_ID, menuId, quantity).lastInsertRowid);
      for (const optionId of optionIds) db.prepare("INSERT INTO TB_CART_DTL_OPT (CART_DTL_ID, OPT_ID) VALUES (?, ?)").run(cartItemId, optionId);
    }
    readCart(me.MBR_ID);
    return { cartId: cart.CART_ID, cartItemId, quantity: mergedQuantity };
  })());
});
