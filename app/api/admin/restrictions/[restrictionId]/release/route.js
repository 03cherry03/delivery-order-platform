import db from "@/lib/db";
import { handler, pathId, notFound, fail } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";

export const runtime = "nodejs";

export const POST = handler(({ request, params }) => {
  requireRole(request, "ADMIN");
  const restrictionId = pathId(params.restrictionId, "restrictionId");
  return db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM TB_MBR_RSTR WHERE MBR_RSTR_ID = ?").get(restrictionId)) notFound();
    const result = db.prepare(`UPDATE TB_MBR_RSTR SET RSTR_END_DTTM = datetime('now', 'localtime')
      WHERE MBR_RSTR_ID = ? AND (RSTR_END_DTTM IS NULL OR RSTR_END_DTTM > datetime('now', 'localtime'))`)
      .run(restrictionId);
    if (!result.changes) fail(409, "ALREADY_RELEASED", "이미 해제된 제한입니다.");
    return db.prepare("SELECT MBR_RSTR_ID AS restrictionId, RSTR_END_DTTM AS endedAt FROM TB_MBR_RSTR WHERE MBR_RSTR_ID = ?")
      .get(restrictionId);
  })();
});
