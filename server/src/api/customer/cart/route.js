import db from "#lib/db";
import { handler } from "#lib/http";
import { requireRole } from "#lib/auth";
import { readCart } from "#lib/cart";



export const GET = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  const state = readCart(me.MBR_ID);
  if (!state || !state.items.length) return { cartId: null, storeId: null, storeName: null, minOrderAmount: 0, deliveryTip: 0, orderTotal: 0, payAmount: 0, meetsMinOrder: false, items: [] };
  const { cart, store, items, orderTotal, payAmount } = state;
  return {
    cartId: cart.CART_ID, storeId: cart.STORE_ID, storeName: store.STORE_NM,
    minOrderAmount: store.MIN_ORD_AMT, deliveryTip: store.DLVR_TIP_AMT, orderTotal, payAmount,
    meetsMinOrder: orderTotal >= store.MIN_ORD_AMT,
    items: items.map((item) => ({
      cartItemId: item.CART_DTL_ID, menuId: item.MENU_ID, menuName: item.menu.MENU_NM,
      quantity: item.CART_QTY, unitPrice: item.menu.MENU_AMT,
      options: item.options.map((o) => ({ optionId: o.OPT_ID, optionName: o.OPT_NM, price: o.OPT_AMT })),
      lineTotal: item.lineTotal, available: !item.issue, unavailableReason: item.issue?.message ?? null,
    })),
  };
});

export const DELETE = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  db.transaction(() => db.prepare("DELETE FROM TB_CART WHERE MBR_ID = ?").run(me.MBR_ID))();
  return { cleared: true };
});
