import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson, fail } from "#lib/http";
import { ownStore, storeDetail, fields } from "#lib/owner-menus";



export const PUT = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  ownStore(owner, storeId);
  const body = await readJson(request);
  fields(body, ["hours"]);
  const invalidHours = () => fail(400, "INVALID_HOURS", "요일과 영업시간 구간을 확인해 주세요.");
  if (!Array.isArray(body.hours) || !body.hours.length) invalidHours();
  const hours = body.hours.map((hour) => {
    if (!hour || typeof hour !== "object" || Array.isArray(hour)) invalidHours();
    fields(hour, ["dayOfWeek", "open", "close"]);
    const { dayOfWeek, open, close } = hour;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6
      || typeof open !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(open)
      || typeof close !== "string" || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(close)
      || open >= close) invalidHours();
    return { dayOfWeek, open, close };
  }).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.open.localeCompare(b.open));
  for (let i = 1; i < hours.length; i++) {
    if (hours[i - 1].dayOfWeek === hours[i].dayOfWeek && hours[i - 1].close > hours[i].open) invalidHours();
  }
  return db.transaction(() => {
    ownStore(owner, storeId);
    db.prepare("DELETE FROM TB_STORE_HOURS WHERE STORE_ID = ?").run(storeId);
    const insert = db.prepare("INSERT INTO TB_STORE_HOURS (STORE_ID, DAY_OF_WEEK, OPEN_TM, CLOSE_TM) VALUES (?, ?, ?, ?)");
    for (const hour of hours) insert.run(storeId, hour.dayOfWeek, hour.open, hour.close);
    return storeDetail(storeId);
  })();
});
