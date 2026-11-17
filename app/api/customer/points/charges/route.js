import db from "@/lib/db";
import { handler, readJson, int, oneOf, invalid, created } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";

export const runtime = "nodejs";

export const POST = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  const body = await readJson(request);
  if (typeof body.amount !== "number") invalid("amount", "정수여야 합니다.");
  const amount = int(body.amount, "amount", { min: 1 });
  if (amount % 10000 !== 0) invalid("amount", "10,000원 단위여야 합니다.");
  const method = oneOf(body.method, "method", ["CARD", "KAKAO", "NAVER"]);
  const result = db.transaction(() => {
    const updated = db.prepare(`UPDATE TB_MBR SET PNT_BAL_AMT = PNT_BAL_AMT + ?
      WHERE MBR_ID = ? AND PNT_BAL_AMT <= ?`).run(amount, me.MBR_ID, Number.MAX_SAFE_INTEGER - amount);
    if (!updated.changes) invalid("amount", "충전 후 잔액이 안전한 정수 범위를 벗어납니다.");
    const { balance } = db.prepare("SELECT PNT_BAL_AMT AS balance FROM TB_MBR WHERE MBR_ID = ?").get(me.MBR_ID);
    const txn = db.prepare(`INSERT INTO TB_PNT_TXN
      (MBR_ID, PNT_TXN_TYPE_CD, PNT_TXN_AMT, PNT_BAL_AMT, CHRG_MTHD_CD, PNT_TXN_STTS)
      VALUES (?, 'CHARGE', ?, ?, ?, 'COMPLETED')`).run(me.MBR_ID, amount, balance, method);
    return db.prepare(`SELECT PNT_TXN_ID AS transactionId, PNT_TXN_TYPE_CD AS type,
      PNT_TXN_AMT AS amount, PNT_BAL_AMT AS balance, PNT_TXN_STTS AS status,
      PNT_TXN_DTTM AS chargedAt FROM TB_PNT_TXN WHERE PNT_TXN_ID = ?`).get(txn.lastInsertRowid);
  })();
  return created(result);
});
