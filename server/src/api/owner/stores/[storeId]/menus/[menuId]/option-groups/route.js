import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson, created, str, bool, invalid } from "#lib/http";
import { ownStore, menu, groupDetail, fields, bodyInt, optionValues } from "#lib/owner-menus";



export const POST = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const menuId = pathId(params.menuId, "menuId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["groupName", "required", "maxSelect", "seq", "options"]);
  const groupName = str(body.groupName, "groupName");
  const required = bool(body.required, "required") ? "Y" : "N";
  const maxSelect = bodyInt(body.maxSelect, "maxSelect", 1);
  const seq = "seq" in body ? bodyInt(body.seq, "seq") : undefined;
  if ("options" in body && !Array.isArray(body.options)) invalid("options", "배열이어야 합니다.");
  const options = (body.options ?? []).map((item) => {
    fields(item, ["optionName", "price"]);
    return optionValues(item, true);
  });
  const result = db.transaction(() => {
    ownStore(owner, storeId);
    menu(storeId, menuId);
    const groupSeq = seq ?? bodyInt(db.prepare("SELECT COALESCE(MAX(OPT_GRP_SEQ), 0) + 1 AS seq FROM TB_MENU_OPT_GRP WHERE MENU_ID = ? AND DEL_YN = 'N'").get(menuId).seq, "seq");
    const { lastInsertRowid } = db.prepare(`INSERT INTO TB_MENU_OPT_GRP (MENU_ID, OPT_GRP_NM, RQRD_YN, MAX_SLCT_CNT, OPT_GRP_SEQ)
      VALUES (?, ?, ?, ?, ?)`).run(menuId, groupName, required, maxSelect, groupSeq);
    const groupId = Number(lastInsertRowid);
    const insert = db.prepare("INSERT INTO TB_MENU_OPT (OPT_GRP_ID, OPT_NM, OPT_AMT, OPT_SEQ) VALUES (?, ?, ?, ?)");
    options.forEach((item, i) => insert.run(groupId, item.OPT_NM, item.OPT_AMT, i + 1));
    return groupDetail(groupId);
  })();
  return created(result);
});
