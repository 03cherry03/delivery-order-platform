import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson, oneOf, fail } from "@/lib/server/http";
import { ownStore, fields } from "@/lib/server/owner-menus";

export const runtime = "nodejs";

export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["operStatus"]);
  const operStatus = oneOf(body.operStatus, "operStatus", ["OPEN", "PAUSED"]);
  return db.transaction(() => {
    ownStore(owner, storeId);
    if (operStatus === "OPEN" && !db.prepare("SELECT 1 FROM TB_MENU WHERE STORE_ID = ? AND DEL_YN = 'N' AND MENU_SALE_STTS = 'ON_SALE'").get(storeId)) {
      fail(409, "NO_MENU_ON_SALE", "판매중인 메뉴가 없습니다.");
    }
    db.prepare("UPDATE TB_STORE SET STORE_OPER_STTS = ? WHERE STORE_ID = ?").run(operStatus, storeId);
    return { operStatus };
  })();
});
