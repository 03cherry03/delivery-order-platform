-- 과제 요구 VIEW

-- 가게별 평균 평점·리뷰 수. 관리자 숨김(RVW_HDN_YN='Y')·삭제(DEL_YN='Y') 리뷰는 제외한다.
-- 리뷰가 0건인 가게도 행이 있다 (AVG_RTNG NULL, RVW_CNT 0). C-08 평점순은 AVG_RTNG IS NULL 을 뒤로 보낸다.
-- 가게의 승인·삭제 여부는 보지 않으므로 조회하는 쪽에서 거른다.
CREATE VIEW V_STORE_RATING AS
SELECT s.STORE_ID,
       ROUND(AVG(r.RVW_RTNG), 1) AS AVG_RTNG,
       COUNT(r.RVW_ID)           AS RVW_CNT
  FROM TB_STORE s
  LEFT JOIN TB_ORD o ON o.STORE_ID = s.STORE_ID
  LEFT JOIN TB_RVW r ON r.ORD_ID = o.ORD_ID AND r.RVW_HDN_YN = 'N' AND r.DEL_YN = 'N'
 GROUP BY s.STORE_ID;

-- 배달 완료(DONE) 주문. 사장 매출 공통 기준(SAL-01).
-- SALES_DT = 배달 완료 날짜, ORD_TOT_AMT = 메뉴·옵션 합계(배달팁 제외), DLVR_TIP_AMT 는 따로.
-- T-01은 이 VIEW를 합계하고, T-02는 ORD_ID로 TB_ORD_DTL·TB_ORD_DTL_OPT와 조인한다.
CREATE VIEW V_DONE_ORDER AS
SELECT o.ORD_ID,
       o.STORE_ID,
       o.MBR_ID,
       o.ORD_DTTM,
       d.DLVR_CMPL_DTTM,
       date(d.DLVR_CMPL_DTTM) AS SALES_DT,
       o.ORD_TOT_AMT,
       o.DLVR_TIP_AMT
  FROM TB_ORD o
  JOIN TB_DLVR d ON d.ORD_ID = o.ORD_ID
 WHERE o.ORD_STTS = 'DONE';

-- 라이더별 완료 배달. D-09 배달 내역과 날짜·주·월 집계의 공통 기준.
-- 완료 일시는 저장된 현지 시간 그대로 사용하며, 주의 시작은 월요일이다.
CREATE VIEW V_RIDER_DONE_DELIVERY AS
SELECT d.DLVR_ID,
       d.RIDER_MBR_ID,
       o.ORD_ID,
       o.STORE_ID,
       o.DLVR_ADDR,
       d.PKUP_DTTM,
       d.DLVR_CMPL_DTTM,
       date(d.DLVR_CMPL_DTTM) AS CMPL_DT,
       date(d.DLVR_CMPL_DTTM, 'weekday 0', '-6 days') AS WEEK_START_DT,
       strftime('%Y-%m', d.DLVR_CMPL_DTTM) AS MONTH,
       o.DLVR_TIP_AMT
  FROM TB_DLVR d
  JOIN TB_ORD o ON o.ORD_ID = d.ORD_ID
 WHERE o.ORD_STTS = 'DONE'
   AND d.RIDER_MBR_ID IS NOT NULL
   AND d.DLVR_CMPL_DTTM IS NOT NULL;
