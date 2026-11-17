import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson, created } from "@/lib/server/http";
import { ownStore, group, optionDetail, optionValues, bodyInt } from "@/lib/server/owner-menus";

export const runtime = "nodejs";

export const POST = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const groupId = pathId(params.groupId, "groupId");
  ownStore(owner, storeId);
  const values = optionValues(await readJson(request), true);
  const result = db.transaction(() => {
    ownStore(owner, storeId);
    group(storeId, groupId);
    const seq = values.OPT_SEQ ?? bodyInt(db.prepare("SELECT COALESCE(MAX(OPT_SEQ), 0) + 1 AS seq FROM TB_MENU_OPT WHERE OPT_GRP_ID = ? AND DEL_YN = 'N'").get(groupId).seq, "seq");
    const { lastInsertRowid } = db.prepare("INSERT INTO TB_MENU_OPT (OPT_GRP_ID, OPT_NM, OPT_AMT, OPT_SEQ) VALUES (?, ?, ?, ?)").run(groupId, values.OPT_NM, values.OPT_AMT, seq);
    return optionDetail(Number(lastInsertRowid));
  })();
  return created(result);
});
