// 주문 상태 변경과 10분 미접수 자동 취소. 주문 상태 변경은 모두 이 모듈을 거친다.
// 취소 후 결제 취소·포인트 환불·라이더 IDLE은 TRG_ORD_CANCEL, MOD_DTTM은 TRG_ORD_MOD_DTTM이 한다(여기서 다시 하지 않음).
import db from "@/lib/db";
import { fail } from "@/lib/server/http";

export const WAIT_LIMIT_MINUTES = 10;
export const NOW = Symbol("now"); // set 값으로 쓰면 datetime('now','localtime')

const EXPIRED = `ORD_STTS = 'WAIT' AND ORD_DTTM <= datetime('now', 'localtime', '-${WAIT_LIMIT_MINUTES} minutes')`;
const SYSTEM_CANCEL = `ORD_STTS = 'CANCEL', ORD_CNCL_DTTM = datetime('now', 'localtime'),
  CNCL_ACTR_CD = 'SYSTEM', CNCL_RSN_CD = 'NO_RESPONSE'`;

// 주문을 읽는 API는 조회 전에 호출한다. 만료된 WAIT 주문 전체를 UPDATE 한 번으로 SYSTEM 취소(트리거가 건마다 환불).
export function expireWaitingOrders() {
  return db.prepare(`UPDATE TB_ORD SET ${SYSTEM_CANCEL} WHERE ${EXPIRED}`).run().changes;
}

const expireOne = (orderId) => db.prepare(`UPDATE TB_ORD SET ${SYSTEM_CANCEL} WHERE ORD_ID = ? AND ${EXPIRED}`).run(orderId).changes > 0;

/**
 * 조건부 상태 변경: ORD_STTS가 from 중 하나일 때만 to로 바꾼다.
 * - set: 함께 바꿀 컬럼 { COL: 값 | NOW }
 * - checkExpiry: 접수·거절·고객 취소. 같은 트랜잭션에서 만료면 SYSTEM 취소를 커밋하고 409
 * - where/params: 추가 조건 (예: 본인 주문 "MBR_ID = ?")
 * - after(order): 같은 트랜잭션에서 이어서 할 쓰기 (예: TB_DLVR INSERT)
 * 반환: after의 반환값. 바뀐 행이 없으면 409 ORDER_ALREADY_PROCESSED
 */
export function transitionOrder(orderId, { from, to, set = {}, checkExpiry = false, where, params = [], after }) {
  const cols = Object.entries(set);
  const assignments = ["ORD_STTS = ?", ...cols.map(([c, v]) => (v === NOW ? `${c} = datetime('now', 'localtime')` : `${c} = ?`))];
  const values = [to, ...cols.filter(([, v]) => v !== NOW).map(([, v]) => v)];
  const sql = `UPDATE TB_ORD SET ${assignments.join(", ")}
    WHERE ORD_ID = ? AND ORD_STTS IN (${from.map(() => "?").join(", ")})${where ? ` AND ${where}` : ""}`;

  const result = db.transaction(() => {
    if (checkExpiry && expireOne(orderId)) return { expired: true };
    if (db.prepare(sql).run(...values, orderId, ...from, ...params).changes === 0) return { conflict: true };
    return { value: after ? after() : undefined };
  })();

  if (result.expired) fail(409, "ORDER_ALREADY_PROCESSED", "접수 대기 시간이 지나 자동 취소된 주문입니다.");
  if (result.conflict) fail(409, "ORDER_ALREADY_PROCESSED", "주문 상태가 이미 바뀌었습니다.");
  return result.value;
}

// 취소: ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE
export function cancelOrder(orderId, { from, actor, reason, reasonDetail = null, processorId = null, memo = null, checkExpiry = false, where, params, after }) {
  return transitionOrder(orderId, {
    from,
    to: "CANCEL",
    set: {
      ORD_CNCL_DTTM: NOW,
      CNCL_ACTR_CD: actor,
      CNCL_RSN_CD: reason,
      ORD_CNCL_RSN_CN: reasonDetail,
      CNCL_PRCSR_MBR_ID: processorId,
      CNSL_MEMO_CN: memo,
    },
    checkExpiry,
    where,
    params,
    after,
  });
}
