import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson, str } from "@/lib/server/http";
import { ownStore, storeDetail, fields, bodyInt, description } from "@/lib/server/owner-menus";

export const runtime = "nodejs";

export const GET = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId, false);
  return storeDetail(storeId);
});

export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["minOrderAmount", "deliveryTip", "cookMinutes", "telNo", "description"]);
  const values = {};
  if ("minOrderAmount" in body) values.MIN_ORD_AMT = bodyInt(body.minOrderAmount, "minOrderAmount", 0);
  if ("deliveryTip" in body) values.DLVR_TIP_AMT = bodyInt(body.deliveryTip, "deliveryTip", 0);
  if ("cookMinutes" in body) values.COOK_EST_MI = bodyInt(body.cookMinutes, "cookMinutes", 1);
  if ("telNo" in body) values.STORE_TELNO = str(body.telNo, "telNo");
  if ("description" in body) values.STORE_CN = description(body.description);
  return db.transaction(() => {
    ownStore(owner, storeId);
    const keys = Object.keys(values);
    if (keys.length) db.prepare(`UPDATE TB_STORE SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE STORE_ID = ?`).run(...Object.values(values), storeId);
    return storeDetail(storeId);
  })();
});
