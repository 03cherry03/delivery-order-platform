import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson, fail } from "@/lib/server/http";
import { ownStore, option, group, optionDetail, optionValues } from "@/lib/server/owner-menus";

export const runtime = "nodejs";

export const PATCH = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const optionId = pathId(params.optionId, "optionId");
  ownStore(owner, storeId);
  const values = optionValues(await readJson(request));
  return db.transaction(() => {
    ownStore(owner, storeId);
    option(storeId, optionId);
    const keys = Object.keys(values);
    if (keys.length) db.prepare(`UPDATE TB_MENU_OPT SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE OPT_ID = ?`).run(...Object.values(values), optionId);
    return optionDetail(optionId);
  })();
});

export const DELETE = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const optionId = pathId(params.optionId, "optionId");
  return db.transaction(() => {
    ownStore(owner, storeId);
    const row = option(storeId, optionId);
    const parent = group(storeId, row.OPT_GRP_ID);
    if (parent.RQRD_YN === "Y" && db.prepare("SELECT count(*) AS count FROM TB_MENU_OPT WHERE OPT_GRP_ID = ? AND DEL_YN = 'N'").get(parent.OPT_GRP_ID).count === 1) {
      fail(409, "REQUIRED_GROUP_EMPTY", "필수 그룹의 마지막 옵션은 삭제할 수 없습니다.");
    }
    db.prepare("UPDATE TB_MENU_OPT SET DEL_YN = 'Y' WHERE OPT_ID = ?").run(optionId);
    return null;
  })();
});
