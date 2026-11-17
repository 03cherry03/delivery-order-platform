import { handler, readJson, int, oneOf, invalid } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { checkout } from "@/lib/server/cart";

export const runtime = "nodejs";

export const POST = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  const body = await readJson(request);
  if (typeof body.addressId !== "number") invalid("addressId", "정수여야 합니다.");
  const addressId = int(body.addressId, "addressId", { min: 1 });
  const payMethod = oneOf(body.payMethod, "payMethod", ["CARD", "KAKAO", "NAVER", "POINT"]);
  const { store, address, items, orderTotal, payAmount, distance, balance } = checkout(me.MBR_ID, addressId, payMethod);
  return {
    storeId: store.STORE_ID, storeName: store.STORE_NM, addressId,
    deliveryAddress: address.MBR_ADDR, distance: Math.round(distance),
    items: items.map((item) => ({
      menuId: item.MENU_ID, menuName: item.menu.MENU_NM, quantity: item.CART_QTY, unitPrice: item.menu.MENU_AMT,
      options: item.options.map((o) => ({ optionName: o.OPT_NM, price: o.OPT_AMT })), lineTotal: item.lineTotal,
    })),
    orderTotal, deliveryTip: store.DLVR_TIP_AMT, payAmount, minOrderAmount: store.MIN_ORD_AMT,
    pointBalance: balance, canOrder: true,
  };
});
