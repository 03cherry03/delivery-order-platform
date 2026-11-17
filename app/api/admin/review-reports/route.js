import db from "@/lib/db";
import { handler, oneOf } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = handler(({ request, query }) => {
  requireRole(request, "ADMIN");
  const status = oneOf(query.get("status") ?? "PENDING", "status", ["PENDING", "ACCEPTED", "REJECTED"]);
  return db.prepare(`SELECT p.RVW_RPT_ID AS reportId, r.RVW_ID AS reviewId,
    s.STORE_NM AS storeName, p.RVW_RPT_RSN_CD AS reason, p.REG_DTTM AS reportedAt,
    r.RVW_RTNG AS rating, r.RVW_CN AS reviewPreview
    FROM TB_RVW_RPT p JOIN TB_RVW r ON r.RVW_ID = p.RVW_ID
    JOIN TB_ORD o ON o.ORD_ID = r.ORD_ID JOIN TB_STORE s ON s.STORE_ID = o.STORE_ID
    WHERE p.RVW_RPT_STTS = ? ORDER BY ${status === "PENDING" ? "p.REG_DTTM ASC, p.RVW_RPT_ID ASC" : "p.PRCS_DTTM DESC, p.RVW_RPT_ID DESC"}`)
    .all(status);
});
