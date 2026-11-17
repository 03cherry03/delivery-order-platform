import db from "@/lib/db";
import { handler, readJson, str, int, invalid, oneOf, notFound, fail, created } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { ACTIVE_RESTRICTION_SQL } from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = handler(({ request, query }) => {
  requireRole(request, "ADMIN");
  const active = oneOf(query.get("active") ?? "true", "active", ["true", "false"]) === "true";
  return db.prepare(`SELECT r.MBR_RSTR_ID AS restrictionId, r.MBR_ID AS memberId,
    m.MBR_NM AS memberName, m.MBR_EMAIL AS email, r.RSTR_RSN_CN AS reason,
    r.RSTR_STRT_DTTM AS startedAt, r.RSTR_END_DTTM AS endedAt, r.RVW_RPT_ID AS reportId
    FROM TB_MBR_RSTR r JOIN TB_MBR m ON m.MBR_ID = r.MBR_ID
    WHERE ${active ? ACTIVE_RESTRICTION_SQL() : "r.RSTR_TYPE_CD = 'REVIEW_WRITE'"}
    ORDER BY r.RSTR_STRT_DTTM DESC, r.MBR_RSTR_ID DESC`).all();
});

export const POST = handler(async ({ request }) => {
  const admin = requireRole(request, "ADMIN");
  const body = await readJson(request);
  const memberId = int(body.memberId, "memberId", { min: 1 });
  const reason = str(body.reason, "reason");
  const reportId = int(body.reportId, "reportId", { min: 1, required: false }) ?? null;
  const restriction = db.transaction(() => {
    const member = db.prepare("SELECT MBR_ROLE_CD FROM TB_MBR WHERE MBR_ID = ?").get(memberId);
    if (!member) notFound();
    if (member.MBR_ROLE_CD !== "CUSTOMER") fail(400, "NOT_CUSTOMER", "고객 회원만 제한할 수 있습니다.");
    if (db.prepare(`SELECT 1 FROM TB_MBR_RSTR r WHERE r.MBR_ID = ? AND ${ACTIVE_RESTRICTION_SQL()}`).get(memberId)) {
      fail(409, "ALREADY_RESTRICTED", "이미 리뷰 작성이 제한된 회원입니다.");
    }
    if (reportId !== null) {
      const report = db.prepare(`SELECT o.MBR_ID FROM TB_RVW_RPT p JOIN TB_RVW v ON v.RVW_ID = p.RVW_ID
        JOIN TB_ORD o ON o.ORD_ID = v.ORD_ID WHERE p.RVW_RPT_ID = ?`).get(reportId);
      if (!report) notFound();
      if (report.MBR_ID !== memberId) invalid("reportId", "신고 리뷰의 작성자가 대상 회원과 다릅니다.");
    }
    const result = db.prepare(`INSERT INTO TB_MBR_RSTR (MBR_ID, RVW_RPT_ID, RSTR_TYPE_CD, RSTR_RSN_CN, PRCSR_MBR_ID)
      VALUES (?, ?, 'REVIEW_WRITE', ?, ?)`).run(memberId, reportId, reason, admin.MBR_ID);
    return db.prepare(`SELECT MBR_RSTR_ID AS restrictionId, MBR_ID AS memberId,
      RSTR_STRT_DTTM AS startedAt, RSTR_END_DTTM AS endedAt FROM TB_MBR_RSTR WHERE MBR_RSTR_ID = ?`)
      .get(result.lastInsertRowid);
  })();
  return created(restriction);
});
