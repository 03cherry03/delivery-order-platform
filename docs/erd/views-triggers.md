# VIEW와 트리거

배달 주문 플랫폼 DB의 VIEW 3개와 트리거 19개를 정리한 문서다. 객체마다 목적, 정의 SQL, 실제 실행 결과를 적었다. 테이블·제약조건·인덱스는 `physical.md`에 있다.

- 기준: `main` 커밋 `c9f4ae0`(PR #7 merge)의 `server/db/views.sql`, `server/db/triggers.sql`
- 실행 결과: `views-triggers-demo.sql`을 시드 데이터가 든 새 메모리 DB에서 돌린 출력이다(SQLite 3.51). 실행 방법은 맨 아래 "다시 실행"에 있다.

## 한눈에 보기

| 이름 | 종류 | 하는 일 |
|---|---|---|
| `V_STORE_RATING` | VIEW | 가게별 평균 평점과 리뷰 수를 계산한다 |
| `V_DONE_ORDER` | VIEW | 배달 완료 주문을 매출일과 함께 보여 준다. 사장 매출의 기준이다 |
| `V_RIDER_DONE_DELIVERY` | VIEW | 라이더별 완료 배달을 일·주·월과 함께 보여 준다. 배달팁 집계의 기준이다 |
| `TRG_ORD_CANCEL` | 트리거 | 주문이 취소되면 결제 취소, 포인트 환불, 라이더 복귀를 한 번에 한다 |
| `TRG_STORE_APRV_BLOCK_DELETED_STORE` | 트리거 | 삭제된 가게의 입점 신청은 승인·반려하지 못하게 막는다 |
| `TRG_<테이블>_MOD_DTTM` (17개) | 트리거 | 행을 수정하면 수정 일시(`MOD_DTTM`)를 기록한다 |

## VIEW

평점, 매출, 배달팁 합계는 테이블에 저장하지 않고 VIEW로 계산한다. 그래서 리뷰를 숨기거나 주문을 취소해도 따로 고칠 값이 없다. 이 결정은 `logical.md`의 제3정규형 절에도 있다.

### V_STORE_RATING: 가게별 평점

- 쓰는 곳: 고객 가게 목록·상세(평점순 정렬 포함), 고객·사장 리뷰 화면의 평점, 사장 가게 정보
- 리뷰가 없는 가게도 행이 나온다. 이때 평점은 NULL, 리뷰 수는 0이다. `LEFT JOIN`을 쓴 이유다.
- 관리자가 숨긴 리뷰와 고객이 지운 리뷰는 계산에서 뺀다.

```sql
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
```

실행 결과 (`SELECT … FROM V_STORE_RATING`):

```
┌──────────┬───────────────┬──────────┬─────────┐
│ STORE_ID │   STORE_NM    │ AVG_RTNG │ RVW_CNT │
├──────────┼───────────────┼──────────┼─────────┤
│ 1        │ 숭실 바삭치킨 │ 4.0      │ 2       │
│ 2        │ 상도 화덕피자 │ 4.0      │ 1       │
│ 3        │ 숭실 든든한식 │          │ 0       │
│ 4        │ 준비중 분식   │          │ 0       │
│ 5        │ 반려된 커피집 │          │ 0       │
└──────────┴───────────────┴──────────┴─────────┘
```

- 1번 가게: 리뷰 3개 중 숨긴 리뷰(평점 1)를 빼고 평점 5와 3의 평균 4.0, 리뷰 수 2
- 2번 가게: 리뷰 2개 중 삭제된 리뷰(평점 2)를 빼고 평점 4 하나
- 3~5번 가게: 리뷰가 없어서 평점이 비어 있고 리뷰 수는 0

### V_DONE_ORDER: 배달 완료 주문 (매출 기준)

- 쓰는 곳: 사장 기간별 매출, 메뉴별 매출
- 매출일(`SALES_DT`)은 주문 일시가 아니라 배달 완료 날짜다.
- 매출 금액(`ORD_TOT_AMT`)에는 배달팁이 들어가지 않는다. 배달팁은 `DLVR_TIP_AMT`로 따로 본다.

```sql
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
```

실행 결과 (가게별·매출일별 합계):

```
┌──────────┬────────────┬─────────┬───────────┐
│ STORE_ID │  SALES_DT  │ ORD_CNT │ SALES_AMT │
├──────────┼────────────┼─────────┼───────────┤
│ 1        │ 2026-11-10 │ 1       │ 21000     │
│ 1        │ 2026-11-12 │ 1       │ 42000     │
│ 1        │ 2026-11-15 │ 1       │ 26000     │
│ 2        │ 2026-11-11 │ 1       │ 29000     │
│ 2        │ 2026-11-13 │ 1       │ 25000     │
│ 3        │ 2026-11-16 │ 1       │ 20000     │
└──────────┴────────────┴─────────┴───────────┘
```

- 취소 주문(13~16번)과 진행 중 주문(1~6번)은 나오지 않는다. 시드의 배달 완료 주문 6건만 나온다.

### V_RIDER_DONE_DELIVERY: 라이더 완료 배달 (배달팁 기준)

- 쓰는 곳: 라이더 배달 내역, 오늘·이번 주·이번 달 배달팁 합계
- 주의 시작은 월요일이다. `date(…, 'weekday 0', '-6 days')`는 그 주 일요일에서 6일을 빼서 월요일을 구한다.

```sql
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
```

실행 결과 (라이더별 주 단위 배달팁 합계):

```
┌──────────────┬───────────────┬──────────┬─────────┐
│ RIDER_MBR_ID │ WEEK_START_DT │ DLVR_CNT │ TIP_AMT │
├──────────────┼───────────────┼──────────┼─────────┤
│ 5            │ 2026-11-09    │ 2        │ 4000    │
│ 6            │ 2026-11-09    │ 2        │ 5000    │
│ 7            │ 2026-11-09    │ 1        │ 2000    │
│ 8            │ 2026-11-16    │ 1        │ 1500    │
└──────────────┴───────────────┴──────────┴─────────┘
```

- 2026-11-10(화)~11-15(일) 완료 배달은 2026-11-09(월) 주로 묶인다. 2026-11-16(월) 완료 배달은 다음 주가 된다.

## 트리거

### TRG_ORD_CANCEL: 주문 취소 연쇄 처리

- 시점: `AFTER UPDATE OF ORD_STTS ON TB_ORD`. 상태가 다른 값에서 `CANCEL`로 바뀔 때만 실행한다.
- 하는 일 (모두 취소 UPDATE와 같은 트랜잭션)
  1. 승인된 포인트 결제면 회원 포인트 잔액을 결제 금액만큼 늘린다.
  2. 포인트 환불 거래(`REFUND`)를 거래 후 잔액과 함께 기록한다.
  3. 결제를 취소 상태로 바꾼다. 결제수단과 관계없다.
  4. 배차된 라이더가 있고 배달이 끝나지 않았으면 라이더를 대기(`IDLE`)로 돌린다.
- 트리거로 만든 이유: 고객 취소, 사장 거절, 관리자 취소, 10분 미접수 자동 취소가 모두 같은 처리를 한다. 취소하는 곳이 넷이어도 연쇄 처리는 여기 한 곳에만 있다. API는 이 처리를 다시 하지 않는다.
- 중복 환불 방지: 트리거는 상태가 처음 `CANCEL`이 될 때만 돈다. 그래도 같은 주문에 환불이 두 번 들어오면 조건부 UNIQUE 인덱스 `UK_PNT_TXN_ORD_TYPE`가 막는다.

```sql
CREATE TRIGGER TRG_ORD_CANCEL
AFTER UPDATE OF ORD_STTS ON TB_ORD
FOR EACH ROW
WHEN NEW.ORD_STTS = 'CANCEL' AND OLD.ORD_STTS <> 'CANCEL'
BEGIN
  -- 1. POINT 결제(승인됨)면 회원 잔액을 결제금액만큼 늘린다
  UPDATE TB_MBR
     SET PNT_BAL_AMT = PNT_BAL_AMT + (SELECT p.PAY_AMT FROM TB_PAY p WHERE p.ORD_ID = NEW.ORD_ID)
   WHERE MBR_ID = NEW.MBR_ID
     AND EXISTS (SELECT 1 FROM TB_PAY p
                  WHERE p.ORD_ID = NEW.ORD_ID AND p.PAY_MTHD_CD = 'POINT' AND p.PAY_STTS = 'APPROVED');

  -- 2. 환불 거래를 거래 후 잔액과 함께 기록한다 (결제금액 0원이면 거래 없음)
  INSERT INTO TB_PNT_TXN (MBR_ID, ORD_ID, PNT_TXN_TYPE_CD, PNT_TXN_AMT, PNT_BAL_AMT, PNT_TXN_STTS, PNT_TXN_DTTM)
  SELECT NEW.MBR_ID, NEW.ORD_ID, 'REFUND', p.PAY_AMT, m.PNT_BAL_AMT, 'COMPLETED', datetime('now', 'localtime')
    FROM TB_PAY p
    JOIN TB_MBR m ON m.MBR_ID = NEW.MBR_ID
   WHERE p.ORD_ID = NEW.ORD_ID AND p.PAY_MTHD_CD = 'POINT' AND p.PAY_STTS = 'APPROVED' AND p.PAY_AMT > 0;

  -- 3. 결제를 취소 처리한다 (결제수단과 관계없이)
  UPDATE TB_PAY
     SET PAY_STTS = 'CANCELED', PAY_CNCL_DTTM = datetime('now', 'localtime')
   WHERE ORD_ID = NEW.ORD_ID AND PAY_STTS <> 'CANCELED';

  -- 4. 배차된 라이더가 있고 배달이 끝나지 않았으면 라이더를 대기(IDLE)로 돌린다
  UPDATE TB_RIDER
     SET RIDER_STTS = 'IDLE'
   WHERE MBR_ID = (SELECT d.RIDER_MBR_ID FROM TB_DLVR d
                    WHERE d.ORD_ID = NEW.ORD_ID AND d.DLVR_CMPL_DTTM IS NULL);
END;
```

**시연 1. 관리자 취소.** 배달 중인 6번 주문(포인트 23,000원 결제, 7번 라이더 배차)을 취소한다. 실행한 SQL은 `UPDATE TB_ORD SET ORD_STTS = 'CANCEL', … WHERE ORD_ID = 6` 한 문장이다.

```
-- 취소 전
┌────────────┬─────────────┬─────────┬──────────┬─────────────┬────────────┐
│  ORD_STTS  │ PAY_MTHD_CD │ PAY_AMT │ PAY_STTS │ PNT_BAL_AMT │ RIDER_STTS │
├────────────┼─────────────┼─────────┼──────────┼─────────────┼────────────┤
│ DELIVERING │ POINT       │ 23000   │ APPROVED │ 27000       │ BUSY       │
└────────────┴─────────────┴─────────┴──────────┴─────────────┴────────────┘
-- 취소 후: UPDATE 한 번으로 결제·잔액·라이더가 함께 바뀐다
┌──────────┬─────────────┬─────────┬──────────┬─────────────┬────────────┐
│ ORD_STTS │ PAY_MTHD_CD │ PAY_AMT │ PAY_STTS │ PNT_BAL_AMT │ RIDER_STTS │
├──────────┼─────────────┼─────────┼──────────┼─────────────┼────────────┤
│ CANCEL   │ POINT       │ 23000   │ CANCELED │ 50000       │ IDLE       │
└──────────┴─────────────┴─────────┴──────────┴─────────────┴────────────┘
-- 트리거가 기록한 환불 거래
┌────────────┬────────┬────────┬─────────────────┬─────────────┬─────────────┐
│ PNT_TXN_ID │ MBR_ID │ ORD_ID │ PNT_TXN_TYPE_CD │ PNT_TXN_AMT │ PNT_BAL_AMT │
├────────────┼────────┼────────┼─────────────────┼─────────────┼─────────────┤
│ 11         │ 11     │ 6      │ USE             │ 23000       │ 27000       │
│ 13         │ 11     │ 6      │ REFUND          │ 23000       │ 50000       │
└────────────┴────────┴────────┴─────────────────┴─────────────┴─────────────┘
```

- 결제가 `CANCELED`가 됐다.
- 고객 잔액이 27,000원에서 50,000원으로 23,000원 늘었다.
- 환불 거래(13번)가 거래 후 잔액 50,000원과 함께 생겼다.
- 라이더가 `BUSY`에서 `IDLE`로 돌아왔다.

**시연 2. 일괄 자동 취소.** 미접수(`WAIT`) 주문을 UPDATE 한 문장으로 모두 취소한다. 트리거는 `FOR EACH ROW`라서 주문마다 따로 돈다.

```
┌────────┬──────────┬─────────────┬──────────┬────────┬─────────────┬────────────┐
│ ORD_ID │ ORD_STTS │ PAY_MTHD_CD │ PAY_STTS │ MBR_ID │ PNT_BAL_AMT │ REFUND_CNT │
├────────┼──────────┼─────────────┼──────────┼────────┼─────────────┼────────────┤
│ 1      │ CANCEL   │ POINT       │ CANCELED │ 9      │ 177000      │ 1          │
│ 2      │ CANCEL   │ CARD        │ CANCELED │ 10     │ 60000       │ 0          │
└────────┴──────────┴─────────────┴──────────┴────────┴─────────────┴────────────┘
```

- 1번 주문(포인트 결제): 결제 취소, 잔액 154,000원에서 177,000원으로 환불, 환불 거래 1건
- 2번 주문(카드 결제): 결제만 취소. 포인트 잔액과 환불 거래는 그대로다.

### TRG_STORE_APRV_BLOCK_DELETED_STORE: 삭제된 가게 심사 차단

- 시점: `BEFORE UPDATE OF STORE_APRV_STTS ON TB_STORE_APRV`. 심사 상태가 바뀔 때만 검사한다.
- 하는 일: 가게가 삭제(`DEL_YN = 'Y'`)됐으면 `RAISE(ABORT, 'STORE_APRV_STORE_DELETED')`로 UPDATE를 취소한다.
- 트리거로 만든 이유: 가게가 삭제돼도 처리 대기 신청 행은 남는다. 승인 API와 반려 API가 같은 검사를 따로 두지 않도록 DB 한 곳에서 막는다. 검사와 변경이 한 UPDATE 문 안에서 일어나므로 그 사이에 가게 상태가 바뀔 틈도 없다.
- API는 이 오류를 HTTP 409 `STORE_DELETED`로 돌려준다.

```sql
CREATE TRIGGER TRG_STORE_APRV_BLOCK_DELETED_STORE
BEFORE UPDATE OF STORE_APRV_STTS ON TB_STORE_APRV
FOR EACH ROW
WHEN NEW.STORE_APRV_STTS <> OLD.STORE_APRV_STTS
  AND EXISTS (SELECT 1 FROM TB_STORE WHERE STORE_ID = NEW.STORE_ID AND DEL_YN = 'Y')
BEGIN
  SELECT RAISE(ABORT, 'STORE_APRV_STORE_DELETED');
END;
```

**시연 3.** 4번 가게를 삭제 표시한 뒤 그 가게의 처리 대기 신청(4번)을 승인한다.

```
Runtime error near line 960: STORE_APRV_STORE_DELETED (19)
-- 위 UPDATE는 오류로 막히고, 신청은 PENDING 그대로다
┌───────────────┬──────────┬─────────────────┬──────────────┐
│ STORE_APRV_ID │ STORE_ID │ STORE_APRV_STTS │ PRCSR_MBR_ID │
├───────────────┼──────────┼─────────────────┼──────────────┤
│ 4             │ 4        │ PENDING         │              │
└───────────────┴──────────┴─────────────────┴──────────────┘
```

- UPDATE가 `STORE_APRV_STORE_DELETED` 오류로 실패했다. `(19)`는 SQLite 제약 위반 코드다.
- 신청은 `PENDING` 그대로이고 처리자도 비어 있다.

### TRG_<테이블>_MOD_DTTM: 수정 일시 기록 (17개)

- 시점: `AFTER UPDATE ON <테이블>`
- 하는 일: UPDATE가 `MOD_DTTM`을 직접 바꾸지 않았으면 현재 시각을 기록한다.
- 트리거로 만든 이유: SQLite에는 MySQL의 `ON UPDATE CURRENT_TIMESTAMP`가 없다. API마다 `MOD_DTTM`을 쓰게 하면 빠뜨리기 쉽다.
- 무한 반복이 없는 이유: 트리거 안의 UPDATE도 같은 트리거를 다시 부를 수 있다. 하지만 그때는 `MOD_DTTM`이 이미 현재 시각이므로 `WHEN` 조건이 거짓이 되어 멈춘다.
- 대상 17개: `TB_MBR`, `TB_MBR_ADDR`, `TB_RIDER`, `TB_STORE`, `TB_STORE_HOURS`, `TB_STORE_APRV`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`, `TB_CART`, `TB_CART_DTL`, `TB_ORD`, `TB_PAY`, `TB_DLVR`, `TB_RVW`, `TB_RVW_REPLY`
- `MOD_DTTM`이 없는 6개 테이블은 수정하지 않는 기록용 테이블이다: `TB_CART_DTL_OPT`, `TB_ORD_DTL`, `TB_ORD_DTL_OPT`, `TB_PNT_TXN`, `TB_RVW_RPT`, `TB_MBR_RSTR`

17개는 테이블 이름과 PK 컬럼만 다르다. `TB_MENU`의 예:

```sql
CREATE TRIGGER TRG_MENU_MOD_DTTM
AFTER UPDATE ON TB_MENU
FOR EACH ROW
WHEN NEW.MOD_DTTM IS OLD.MOD_DTTM AND NEW.MOD_DTTM IS NOT datetime('now', 'localtime')
BEGIN
  UPDATE TB_MENU SET MOD_DTTM = datetime('now', 'localtime') WHERE MENU_ID = NEW.MENU_ID;
END;
```

**시연 4.** 1번 메뉴의 가격만 바꾼다. UPDATE 문에는 `MOD_DTTM`이 없다.

```
┌─────────┬──────────┬─────────────────────┬────────┐
│ MENU_ID │ MENU_AMT │      MOD_DTTM       │ IS_NOW │
├─────────┼──────────┼─────────────────────┼────────┤
│ 1       │ 18000    │ 2026-11-01 09:00:00 │ 0      │
└─────────┴──────────┴─────────────────────┴────────┘
┌─────────┬──────────┬─────────────────────┬────────┐
│ MENU_ID │ MENU_AMT │      MOD_DTTM       │ IS_NOW │
├─────────┼──────────┼─────────────────────┼────────┤
│ 1       │ 19000    │ 2026-11-20 16:33:47 │ 1      │
└─────────┴──────────┴─────────────────────┴────────┘
```

- 수정 일시가 2026-11-01에서 실행 시각으로 바뀌었다(`IS_NOW = 1`). 시각 값은 실행할 때마다 다르다.

### 트리거로 만들지 않은 처리

다음 상태 변경은 API가 트랜잭션 안에서 한다. 조건이 API 요청 맥락(누가, 어떤 화면에서)에 달려 있어서다.

- 라이더가 배차를 수락하면 `BUSY`, 배달을 완료하면 `IDLE`
- 입점 승인·반려 때 `TB_STORE.STORE_APRV_STTS` 동기화
- 리뷰 작성 조건, 장바구니 가게 일치, 활성 제한 중복 검사

## 다시 실행

```sh
# 프로젝트 루트에서. 새 메모리 DB를 쓰므로 server/delivery.db 는 바뀌지 않는다
cat server/db/schema.sql server/db/views.sql server/db/triggers.sql server/db/seed.sql \
    docs/erd/views-triggers-demo.sql | sqlite3 :memory:
```

- 필요한 것: `sqlite3` 3.37 이상(`STRICT` 테이블 지원). macOS 기본 `sqlite3`로 된다.
- 종료 코드는 1이다. 시연 3이 일부러 트리거 오류를 내기 때문이다. 나머지 출력은 위 결과와 같다.
- 트리거 시연은 모두 `ROLLBACK`으로 끝난다. 시연 순서를 바꿔도 결과가 섞이지 않는다.
- 시드의 1·2번 주문은 실행 시각 기준 1~2분 전 주문이다. 시연 2는 시각과 관계없이 `WAIT` 주문 전체를 취소한다.
