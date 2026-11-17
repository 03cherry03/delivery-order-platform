import db from "@/lib/db";
import { handler, readJson, int, pathId, invalid, notFound, forbidden } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { lineAmount, readCart } from "@/lib/server/cart";

export const runtime = "nodejs";

function ownItem(memberId, itemId) {
  const item = db.prepare(`SELECT d.*, c.MBR_ID FROM TB_CART_DTL d JOIN TB_CART c ON c.CART_ID = d.CART_ID WHERE d.CART_DTL_ID = ?`).get(itemId);
  if (!item) notFound();
  if (item.MBR_ID !== memberId) forbidden();
  return item;
}

export const PATCH = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const cartItemId = pathId(params.cartItemId, "cartItemId");
  const body = await readJson(request);
  const quantity = int(body.quantity, "quantity", { min: 1 });
  if (typeof body.quantity !== "number") invalid("quantity", "정수여야 합니다.");
  return db.transaction(() => {
    const item = ownItem(me.MBR_ID, cartItemId);
    const menu = db.prepare("SELECT MENU_AMT FROM TB_MENU WHERE MENU_ID = ?").get(item.MENU_ID);
    const options = db.prepare(`SELECT o.OPT_AMT FROM TB_CART_DTL_OPT c JOIN TB_MENU_OPT o ON o.OPT_ID = c.OPT_ID WHERE c.CART_DTL_ID = ?`).all(cartItemId);
    const lineTotal = lineAmount(menu.MENU_AMT, options, quantity);
    db.prepare("UPDATE TB_CART_DTL SET CART_QTY = ? WHERE CART_DTL_ID = ?").run(quantity, cartItemId);
    readCart(me.MBR_ID);
    return { cartItemId, quantity, lineTotal };
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const cartItemId = pathId(params.cartItemId, "cartItemId");
  return db.transaction(() => {
    const item = ownItem(me.MBR_ID, cartItemId);
    db.prepare("DELETE FROM TB_CART_DTL WHERE CART_DTL_ID = ?").run(cartItemId);
    const remainingItemCount = db.prepare("SELECT COUNT(*) AS count FROM TB_CART_DTL WHERE CART_ID = ?").get(item.CART_ID).count;
    if (!remainingItemCount) db.prepare("DELETE FROM TB_CART WHERE CART_ID = ?").run(item.CART_ID);
    return { deletedCartItemId: cartItemId, remainingItemCount };
  })();
});
