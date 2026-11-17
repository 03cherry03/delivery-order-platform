import db from "@/lib/db";
import { handler, readJson, oneOf, intArray, forbidden, notFound } from "@/lib/server/http";
import { cancelOrder } from "@/lib/server/orders";
import { ownerStore, ownOrder, reasonDetail, bodyFields } from "@/lib/server/owner-orders";

export const runtime = "nodejs";

export const POST = handler(async ({ request, params }) => {
  const { storeId } = ownerStore(request, params);
  const order = ownOrder(storeId, params.orderId);
  const body = await readJson(request);
  bodyFields(body, ["reason", "reasonDetail", "soldOutMenuIds"]);
  const reason = oneOf(body.reason, "reason", ["OUT_OF_STOCK", "BUSY", "CLOSING", "ETC"]);
  const detail = reasonDetail(body);
  const menuIds = intArray(body.soldOutMenuIds, "soldOutMenuIds", { required: false }) ?? [];
  cancelOrder(order.ORD_ID, {
    from: ["WAIT"], actor: "OWNER", reason, reasonDetail: detail, checkExpiry: true,
    where: "STORE_ID = ?", params: [storeId],
    after: () => {
      for (const menuId of menuIds) {
        const menu = db.prepare("SELECT STORE_ID, DEL_YN FROM TB_MENU WHERE MENU_ID = ?").get(menuId);
        if (!menu || menu.DEL_YN === "Y") notFound();
        if (menu.STORE_ID !== storeId) forbidden();
        db.prepare("UPDATE TB_MENU SET MENU_SALE_STTS = 'SOLD_OUT' WHERE MENU_ID = ?").run(menuId);
      }
    },
  });
  return db.prepare(`SELECT ORD_ID AS orderId, ORD_STTS AS status, ORD_CNCL_DTTM AS canceledAt
    FROM TB_ORD WHERE ORD_ID = ?`).get(order.ORD_ID);
});
