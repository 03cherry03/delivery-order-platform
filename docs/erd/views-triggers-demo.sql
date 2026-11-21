-- VIEW·트리거 시연 스크립트 (sqlite3 CLI). 결과는 views-triggers.md 에 붙였다.
-- 새 메모리 DB에서 실행한다 (프로젝트 루트):
--   cat server/db/schema.sql server/db/views.sql server/db/triggers.sql server/db/seed.sql \
--       docs/erd/views-triggers-demo.sql | sqlite3 :memory:
-- 트리거 시연은 모두 ROLLBACK 하므로 시연 사이에 데이터가 섞이지 않는다.

.mode box
.bail off

.print '== V1. V_STORE_RATING: 가게별 평균 평점·리뷰 수'
SELECT r.STORE_ID, s.STORE_NM, r.AVG_RTNG, r.RVW_CNT
  FROM V_STORE_RATING r JOIN TB_STORE s ON s.STORE_ID = r.STORE_ID
 ORDER BY r.STORE_ID;

.print '== V2. V_DONE_ORDER: 가게별·매출일별 매출 (배달팁 제외)'
SELECT STORE_ID, SALES_DT, COUNT(*) AS ORD_CNT, SUM(ORD_TOT_AMT) AS SALES_AMT
  FROM V_DONE_ORDER
 GROUP BY STORE_ID, SALES_DT
 ORDER BY STORE_ID, SALES_DT;

.print '== V3. V_RIDER_DONE_DELIVERY: 라이더별 주 단위 배달팁 합계'
SELECT RIDER_MBR_ID, WEEK_START_DT, COUNT(*) AS DLVR_CNT, SUM(DLVR_TIP_AMT) AS TIP_AMT
  FROM V_RIDER_DONE_DELIVERY
 GROUP BY RIDER_MBR_ID, WEEK_START_DT
 ORDER BY RIDER_MBR_ID, WEEK_START_DT;

.print '== T1. TRG_ORD_CANCEL: 배달 중인 포인트 결제 주문(6번)을 관리자가 취소'
BEGIN;
.print '-- 취소 전'
SELECT o.ORD_STTS, p.PAY_MTHD_CD, p.PAY_AMT, p.PAY_STTS, m.PNT_BAL_AMT, r.RIDER_STTS
  FROM TB_ORD o
  JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
  JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
  JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID
  JOIN TB_RIDER r ON r.MBR_ID = d.RIDER_MBR_ID
 WHERE o.ORD_ID = 6;
UPDATE TB_ORD
   SET ORD_STTS = 'CANCEL', ORD_CNCL_DTTM = datetime('now', 'localtime'),
       CNCL_ACTR_CD = 'ADMIN', CNCL_RSN_CD = 'DELIVERY_FAIL',
       CNCL_PRCSR_MBR_ID = 1, CNSL_MEMO_CN = '배달 불가 지역으로 확인되어 취소'
 WHERE ORD_ID = 6;
.print '-- 취소 후: UPDATE 한 번으로 결제·잔액·라이더가 함께 바뀐다'
SELECT o.ORD_STTS, p.PAY_MTHD_CD, p.PAY_AMT, p.PAY_STTS, m.PNT_BAL_AMT, r.RIDER_STTS
  FROM TB_ORD o
  JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
  JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
  JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID
  JOIN TB_RIDER r ON r.MBR_ID = d.RIDER_MBR_ID
 WHERE o.ORD_ID = 6;
.print '-- 트리거가 기록한 환불 거래'
SELECT PNT_TXN_ID, MBR_ID, ORD_ID, PNT_TXN_TYPE_CD, PNT_TXN_AMT, PNT_BAL_AMT
  FROM TB_PNT_TXN WHERE ORD_ID = 6 ORDER BY PNT_TXN_ID;
ROLLBACK;

.print '== T2. TRG_ORD_CANCEL: 미접수(WAIT) 주문 일괄 자동 취소. 행마다 실행된다'
BEGIN;
UPDATE TB_ORD
   SET ORD_STTS = 'CANCEL', ORD_CNCL_DTTM = datetime('now', 'localtime'),
       CNCL_ACTR_CD = 'SYSTEM', CNCL_RSN_CD = 'NO_RESPONSE'
 WHERE ORD_STTS = 'WAIT';
SELECT o.ORD_ID, o.ORD_STTS, p.PAY_MTHD_CD, p.PAY_STTS, m.MBR_ID, m.PNT_BAL_AMT,
       (SELECT COUNT(*) FROM TB_PNT_TXN t WHERE t.ORD_ID = o.ORD_ID AND t.PNT_TXN_TYPE_CD = 'REFUND') AS REFUND_CNT
  FROM TB_ORD o
  JOIN TB_PAY p ON p.ORD_ID = o.ORD_ID
  JOIN TB_MBR m ON m.MBR_ID = o.MBR_ID
 WHERE o.ORD_ID IN (1, 2)
 ORDER BY o.ORD_ID;
ROLLBACK;

.print '== T3. TRG_STORE_APRV_BLOCK_DELETED_STORE: 삭제된 가게(4번)의 입점 신청 승인 시도'
BEGIN;
UPDATE TB_STORE SET DEL_YN = 'Y' WHERE STORE_ID = 4;
UPDATE TB_STORE_APRV
   SET STORE_APRV_STTS = 'APPROVED', PRCSR_MBR_ID = 1, PRCS_DTTM = datetime('now', 'localtime')
 WHERE STORE_APRV_ID = 4;
.print '-- 위 UPDATE는 오류로 막히고, 신청은 PENDING 그대로다'
SELECT STORE_APRV_ID, STORE_ID, STORE_APRV_STTS, PRCSR_MBR_ID FROM TB_STORE_APRV WHERE STORE_APRV_ID = 4;
ROLLBACK;

.print '== T4. TRG_MENU_MOD_DTTM: 메뉴 가격만 바꿔도 수정 일시가 기록된다'
BEGIN;
SELECT MENU_ID, MENU_AMT, MOD_DTTM, MOD_DTTM = datetime('now', 'localtime') AS IS_NOW FROM TB_MENU WHERE MENU_ID = 1;
UPDATE TB_MENU SET MENU_AMT = 19000 WHERE MENU_ID = 1;
SELECT MENU_ID, MENU_AMT, MOD_DTTM, MOD_DTTM = datetime('now', 'localtime') AS IS_NOW FROM TB_MENU WHERE MENU_ID = 1;
ROLLBACK;
