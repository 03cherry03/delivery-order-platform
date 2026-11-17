import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson, str, bool } from "@/lib/server/http";
import { ownStore, group, groupDetail, fields, bodyInt } from "@/lib/server/owner-menus";

export const runtime = "nodejs";

export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const groupId = pathId(params.groupId, "groupId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["groupName", "required", "maxSelect", "seq"]);
  const values = {};
  if ("groupName" in body) values.OPT_GRP_NM = str(body.groupName, "groupName");
  if ("required" in body) values.RQRD_YN = bool(body.required, "required") ? "Y" : "N";
  if ("maxSelect" in body) values.MAX_SLCT_CNT = bodyInt(body.maxSelect, "maxSelect", 1);
  if ("seq" in body) values.OPT_GRP_SEQ = bodyInt(body.seq, "seq");
  return db.transaction(() => {
    ownStore(owner, storeId);
    group(storeId, groupId);
    const keys = Object.keys(values);
    if (keys.length) db.prepare(`UPDATE TB_MENU_OPT_GRP SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE OPT_GRP_ID = ?`).run(...Object.values(values), groupId);
    return groupDetail(groupId);
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const groupId = pathId(params.groupId, "groupId");
  return db.transaction(() => {
    ownStore(owner, storeId);
    group(storeId, groupId);
    db.prepare("UPDATE TB_MENU_OPT SET DEL_YN = 'Y' WHERE OPT_GRP_ID = ? AND DEL_YN = 'N'").run(groupId);
    db.prepare("UPDATE TB_MENU_OPT_GRP SET DEL_YN = 'Y' WHERE OPT_GRP_ID = ?").run(groupId);
    return null;
  })();
});
