// 가게 영업 계산 (고객 C-08·C-09·C-18·C-19, 사장 S-01, 관리자 공용)
// 표시 상태: 저장값 PAUSED면 PAUSED, 아니면 현재 한국 요일·시각이 TB_STORE_HOURS 구간 안이면 OPEN, 밖이면 CLOSED.
// 구간은 OPEN_TM 이상 CLOSE_TM 미만(자정은 24:00). 요일에 행이 여러 개면 브레이크타임, 행이 없으면 휴무.
import db from "@/lib/db";

// SQL 조각: 별칭 s 의 TB_STORE 가 지금 영업시간 안인지 (0/1)
export const IN_HOURS_SQL = (s = "s") => `EXISTS (SELECT 1 FROM TB_STORE_HOURS h
  WHERE h.STORE_ID = ${s}.STORE_ID
    AND h.DAY_OF_WEEK = CAST(strftime('%w', 'now', 'localtime') AS INTEGER)
    AND h.OPEN_TM <= strftime('%H:%M', 'now', 'localtime')
    AND strftime('%H:%M', 'now', 'localtime') < h.CLOSE_TM)`;

// SQL 조각: 표시 상태 OPEN / PAUSED / CLOSED
export const OPER_STATUS_SQL = (s = "s") =>
  `CASE WHEN ${s}.STORE_OPER_STTS = 'PAUSED' THEN 'PAUSED' WHEN ${IN_HOURS_SQL(s)} THEN 'OPEN' ELSE 'CLOSED' END`;

// 영업시간 응답 형태: hours [{dayOfWeek, open, close}], closedDays [행이 없는 요일]
export function storeHours(storeId) {
  const hours = db.prepare(
    `SELECT DAY_OF_WEEK AS dayOfWeek, OPEN_TM AS open, CLOSE_TM AS close
       FROM TB_STORE_HOURS WHERE STORE_ID = ? ORDER BY DAY_OF_WEEK, OPEN_TM`,
  ).all(storeId);
  const open = new Set(hours.map((h) => h.dayOfWeek));
  return { hours, closedDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !open.has(d)) };
}
