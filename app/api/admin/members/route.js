import db from "@/lib/db";
import { handler, str, oneOf } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { ACTIVE_RESTRICTION_SQL } from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = handler(({ request, query }) => {
  requireRole(request, "ADMIN");
  const keyword = str(query.get("keyword"), "keyword");
  const role = query.has("role") ? oneOf(query.get("role"), "role", ["CUSTOMER", "OWNER", "RIDER"]) : undefined;
  return db.prepare(`SELECT m.MBR_ID AS memberId, m.MBR_NM AS name, m.MBR_EMAIL AS email,
    m.MBR_TELNO AS tel, m.MBR_ROLE_CD AS role, m.REG_DTTM AS joinedAt,
    (SELECT COUNT(*) FROM TB_ORD o WHERE o.MBR_ID = m.MBR_ID) AS orderCount,
    (SELECT COUNT(*) FROM TB_RVW v JOIN TB_ORD o ON o.ORD_ID = v.ORD_ID
      WHERE o.MBR_ID = m.MBR_ID AND v.RVW_HDN_YN = 'Y') AS hiddenReviewCount,
    EXISTS (SELECT 1 FROM TB_MBR_RSTR r WHERE r.MBR_ID = m.MBR_ID AND ${ACTIVE_RESTRICTION_SQL()}) AS restricted
    FROM TB_MBR m WHERE m.MBR_ROLE_CD IN ('CUSTOMER', 'OWNER', 'RIDER')
    ${role ? "AND m.MBR_ROLE_CD = @role" : ""}
    AND (instr(lower(m.MBR_NM), lower(@keyword)) > 0 OR instr(lower(m.MBR_EMAIL), lower(@keyword)) > 0
      OR instr(m.MBR_TELNO, @keyword) > 0)
    ORDER BY m.REG_DTTM DESC, m.MBR_ID DESC LIMIT 50`).all(role ? { keyword, role } : { keyword })
    .map((row) => ({ ...row, restricted: Boolean(row.restricted) }));
});
