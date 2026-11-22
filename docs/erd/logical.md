# 논리 데이터 모델

개념 모델(`conceptual.md`)을 관계형 스키마로 옮기고 정규화 근거를 적은 문서다. 구현 세부(타입, 제약조건, 인덱스, DDL)는 `physical.md`에, VIEW와 트리거는 `views-triggers.md`에 있다.

- 기준: `main` 커밋 `c9f4ae0`(PR #7 merge)의 `server/db/schema.sql`
- 표기: <u>밑줄</u> = 기본 키(PK), `→ 테이블` = 외래 키(FK), `AK` = 대체 키(UNIQUE). `?` = NULL 허용
- 모든 테이블은 대리 키(`…_ID`, 정수 자동 증가)를 PK로 쓴다. 업무 식별자는 대체 키로 둔다.
- 공통 감사 컬럼은 줄여 적는다: `REG_DTTM`(등록 일시), `MOD_DTTM`(수정 일시), `DEL_YN`(논리 삭제). 각 릴레이션 끝의 `[R M D]`가 그 컬럼의 유무다.

## 개념 모델에서 옮긴 규칙

| 개념 모델 | 논리 모델 |
|---|---|
| 엔터티 | 릴레이션 하나 |
| 1:N 관계 | N 쪽 릴레이션에 FK |
| 1:1 관계 | 한쪽에 UNIQUE FK (`TB_PAY.ORD_ID`, `TB_DLVR.ORD_ID`, `TB_RVW.ORD_ID`, `TB_RVW_REPLY.RVW_ID`, `TB_CART.MBR_ID`) |
| M:N 관계 (항목 ↔ 옵션 선택) | 연결 릴레이션 `TB_CART_DTL_OPT`, `TB_ORD_DTL_OPT` |
| 상위·하위 유형 (회원 ISA 라이더) | 하위 릴레이션 `TB_RIDER`가 상위 PK를 그대로 PK·FK로 사용 |
| 다중값 속성 (가게 영업시간) | 별도 릴레이션 `TB_STORE_HOURS` (요일·시간대마다 한 행) |

## 릴레이션 스키마

### 회원

- **TB_MBR** 회원 (<u>MBR_ID</u>, MBR_EMAIL, MBR_PWD?, MBR_NM, MBR_TELNO?, MBR_ROLE_CD, MBR_STTS, PNT_BAL_AMT, MBR_LOGIN_DTTM?, MBR_WTHDR_DTTM?) [R M D]
  - AK: MBR_EMAIL (활성 회원 사이에서만)
- **TB_MBR_ADDR** 회원주소 (<u>MBR_ADDR_ID</u>, MBR_ID → TB_MBR, MBR_ADDR_NM, MBR_ADDR, MBR_DADDR?, MBR_ZIP, MBR_LAT, MBR_LNG, DFLT_YN) [R M D]
  - 회원당 기본 주소 하나 (삭제되지 않은 주소 중)
- **TB_RIDER** 라이더 (<u>MBR_ID</u> → TB_MBR, RIDER_STTS, VHCL_TYPE_CD, ACT_RADIUS_M) [R M]
- **TB_MBR_RSTR** 회원제한 (<u>MBR_RSTR_ID</u>, MBR_ID → TB_MBR, RVW_RPT_ID? → TB_RVW_RPT, RSTR_TYPE_CD, RSTR_STRT_DTTM, RSTR_END_DTTM?, RSTR_RSN_CN, PRCSR_MBR_ID → TB_MBR) [R]

### 가게·메뉴

- **TB_STORE** 가게 (<u>STORE_ID</u>, OWNR_MBR_ID → TB_MBR, STORE_NM, STORE_CTGR_CD, BIZ_NO, STORE_TELNO, STORE_ADDR, STORE_DADDR?, STORE_LAT, STORE_LNG, STORE_CN?, MIN_ORD_AMT, DLVR_TIP_AMT, COOK_EST_MI, STORE_OPER_STTS, STORE_APRV_STTS) [R M D]
  - AK: BIZ_NO
- **TB_STORE_HOURS** 가게영업시간 (<u>STORE_HOURS_ID</u>, STORE_ID → TB_STORE, DAY_OF_WEEK, OPEN_TM, CLOSE_TM) [R M]
- **TB_STORE_APRV** 입점신청 (<u>STORE_APRV_ID</u>, STORE_ID → TB_STORE, STORE_APRV_STTS, APLY_DTTM, PRCSR_MBR_ID? → TB_MBR, PRCS_DTTM?, RJCT_RSN_CN?) [R M]
  - 가게당 처리 대기 신청 하나
- **TB_MENU_CTGR** 메뉴분류 (<u>CTGR_ID</u>, STORE_ID → TB_STORE, CTGR_NM, CTGR_SEQ) [R M D]
  - AK: (STORE_ID, CTGR_NM) (삭제되지 않은 분류 사이에서만)
- **TB_MENU** 메뉴 (<u>MENU_ID</u>, STORE_ID → TB_STORE, CTGR_ID → TB_MENU_CTGR, MENU_NM, MENU_AMT, MENU_CN?, MENU_SEQ, MENU_SALE_STTS) [R M D]
- **TB_MENU_OPT_GRP** 메뉴옵션그룹 (<u>OPT_GRP_ID</u>, MENU_ID → TB_MENU, OPT_GRP_NM, RQRD_YN, MAX_SLCT_CNT, OPT_GRP_SEQ) [R M D]
- **TB_MENU_OPT** 메뉴옵션 (<u>OPT_ID</u>, OPT_GRP_ID → TB_MENU_OPT_GRP, OPT_NM, OPT_AMT, OPT_SEQ) [R M D]

### 장바구니

- **TB_CART** 장바구니 (<u>CART_ID</u>, MBR_ID → TB_MBR, STORE_ID → TB_STORE) [R M]
  - AK: MBR_ID (회원당 하나)
- **TB_CART_DTL** 장바구니항목 (<u>CART_DTL_ID</u>, CART_ID → TB_CART, MENU_ID → TB_MENU, CART_QTY) [R M]
- **TB_CART_DTL_OPT** 장바구니항목옵션 (<u>CART_DTL_OPT_ID</u>, CART_DTL_ID → TB_CART_DTL, OPT_ID → TB_MENU_OPT) [R]
  - AK: (CART_DTL_ID, OPT_ID)

### 주문·결제

- **TB_ORD** 주문 (<u>ORD_ID</u>, MBR_ID → TB_MBR, STORE_ID → TB_STORE, ORD_DTTM, ORD_STTS, ORD_TOT_AMT, DLVR_TIP_AMT, STORE_RQST_CN?, RIDER_RQST_CN?, CUTLERY_YN, DLVR_ADDR, DLVR_DADDR?, DLVR_LAT, DLVR_LNG, ORD_RCPT_DTTM?, COOK_EST_MI?, ORD_CNCL_DTTM?, CNCL_ACTR_CD?, CNCL_RSN_CD?, ORD_CNCL_RSN_CN?, CNCL_PRCSR_MBR_ID? → TB_MBR, CNSL_MEMO_CN?) [R M]
- **TB_ORD_DTL** 주문상세 (<u>ORD_DTL_ID</u>, ORD_ID → TB_ORD, ORD_DTL_SEQ, MENU_ID → TB_MENU, ORD_MENU_NM, ORD_QTY, ORD_UPRC) [R]
  - AK: (ORD_ID, ORD_DTL_SEQ)
- **TB_ORD_DTL_OPT** 주문상세옵션 (<u>ORD_DTL_OPT_ID</u>, ORD_DTL_ID → TB_ORD_DTL, OPT_ID → TB_MENU_OPT, ORD_OPT_GRP_NM, ORD_OPT_NM, ORD_OPT_AMT) [R]
- **TB_PAY** 결제 (<u>PAY_ID</u>, ORD_ID → TB_ORD, PAY_MTHD_CD, PAY_AMT, PAY_STTS, PAY_REF_NO?, PAY_APRV_DTTM?, PAY_CNCL_DTTM?) [R M]
  - AK: ORD_ID (주문당 결제 하나)
- **TB_PNT_TXN** 포인트거래 (<u>PNT_TXN_ID</u>, MBR_ID → TB_MBR, ORD_ID? → TB_ORD, PNT_TXN_TYPE_CD, PNT_TXN_AMT, PNT_BAL_AMT, CHRG_MTHD_CD?, PNT_TXN_STTS, PNT_TXN_DTTM) [R]
  - 주문에 연결된 거래는 (ORD_ID, PNT_TXN_TYPE_CD)마다 하나

### 배달

- **TB_DLVR** 배달 (<u>DLVR_ID</u>, ORD_ID → TB_ORD, RIDER_MBR_ID? → TB_RIDER, DSPCH_DTTM?, PKUP_DTTM?, DLVR_CMPL_DTTM?) [R M]
  - AK: ORD_ID (주문당 배달 하나). 라이더가 없으면 배차 대기

### 리뷰·신고

- **TB_RVW** 리뷰 (<u>RVW_ID</u>, ORD_ID → TB_ORD, RVW_RTNG, RVW_CN?, RVW_HDN_YN) [R M D]
  - AK: ORD_ID (주문당 리뷰 하나)
- **TB_RVW_REPLY** 리뷰답글 (<u>RVW_REPLY_ID</u>, RVW_ID → TB_RVW, OWNR_MBR_ID → TB_MBR, RVW_REPLY_CN) [R M D]
  - AK: RVW_ID (리뷰당 답글 하나)
- **TB_RVW_RPT** 리뷰신고 (<u>RVW_RPT_ID</u>, RVW_ID → TB_RVW, RPTR_MBR_ID → TB_MBR, RVW_RPT_RSN_CD, RVW_RPT_CN, RVW_RPT_STTS, PRCSR_MBR_ID? → TB_MBR, PRCS_DTTM?, PRCS_CN?) [R]
  - AK: (RVW_ID, RPTR_MBR_ID) (같은 회원은 같은 리뷰를 한 번만 신고)

## 함수 종속

`X → Y`는 X 값이 정해지면 Y 값이 하나로 정해진다는 뜻이다. 각 릴레이션의 PK는 그 릴레이션의 모든 속성을 결정하므로 따로 적지 않았다. 아래는 PK 말고도 결정자가 되는 종속, 그리고 종속처럼 보이지만 종속이 아닌 경우다.

| 릴레이션 | 함수 종속 | 비고 |
|---|---|---|
| TB_STORE | BIZ_NO → STORE_ID (따라서 가게의 모든 속성) | BIZ_NO도 후보 키 |
| TB_ORD_DTL | (ORD_ID, ORD_DTL_SEQ) → ORD_DTL_ID, MENU_ID, ORD_MENU_NM, ORD_QTY, ORD_UPRC | 복합 후보 키 |
| TB_CART_DTL_OPT | (CART_DTL_ID, OPT_ID) → CART_DTL_OPT_ID | 복합 후보 키 |
| TB_RVW_RPT | (RVW_ID, RPTR_MBR_ID) → RVW_RPT_ID | 복합 후보 키 |
| TB_PAY, TB_DLVR, TB_RVW | ORD_ID → 각 릴레이션의 PK | 주문당 하나라서 ORD_ID도 후보 키 |
| TB_CART | MBR_ID → CART_ID | 회원당 하나 |
| TB_RVW_REPLY | RVW_ID → RVW_REPLY_ID | 리뷰당 하나 |
| TB_MENU | CTGR_ID → STORE_ID | 분류는 한 가게에 속한다. CTGR_ID는 TB_MENU의 키가 아니다 (아래 "역정규화") |

종속이 **아닌** 경우:

- `MENU_ID ↛ ORD_MENU_NM, ORD_UPRC`: 메뉴 이름·가격이 바뀌어도 과거 주문의 값은 그대로다. 같은 메뉴라도 주문마다 값이 다를 수 있다.
- `STORE_ID ↛ TB_ORD.DLVR_TIP_AMT`: 가게가 배달팁을 바꿔도 이미 낸 주문의 배달팁은 바뀌지 않는다.
- `MBR_EMAIL ↛ MBR_ID`: 탈퇴한 회원의 이메일로 다시 가입할 수 있다. 그래서 이메일 하나에 회원 행이 여럿일 수 있다.

## 정규화 과정 (예시: 주문서)

고객 화면의 "주문서" 한 장을 정규화 전 릴레이션으로 보고, 단계별로 분해해서 최종 릴레이션이 나오는 과정을 보인다. 주문 영역이 반복 그룹과 복합 키를 모두 가져서 과정을 보이기에 가장 알맞다.

### 정규화 전 (비정규형)

주문서 (<u>주문번호</u>, 주문일시, 회원번호, 회원이름, 가게번호, 가게명, 배달팁, 배달주소, **{** 주문순번, 메뉴번호, 메뉴명, 단가, 수량, **{** 옵션번호, 옵션그룹명, 옵션명, 옵션금액 **}** **}**)

- `{ }`는 반복 그룹이다. 주문 하나에 메뉴가 여럿, 메뉴 하나에 옵션이 여럿 붙는다.
- 속성 값 하나에 여러 값이 들어가므로 1NF가 아니다.

### 1NF: 반복 그룹 제거

반복 그룹을 펼쳐 옵션 하나가 한 행이 되게 한다.

주문서_1NF (<u>주문번호, 주문순번, 옵션번호</u>, 주문일시, 회원번호, 회원이름, 가게번호, 가게명, 배달팁, 배달주소, 메뉴번호, 메뉴명, 단가, 수량, 옵션그룹명, 옵션명, 옵션금액)

모든 값이 원자값이 됐지만 이상 현상이 남는다.

- 수정 이상: 주문 하나에 옵션이 5개면 주문일시·배달주소가 5행에 반복된다. 하나만 고치면 값이 어긋난다.
- 삽입 이상: 옵션이 없는 메뉴는 옵션번호가 없다. 키의 일부가 비므로 이 항목을 저장할 수 없다.
- 삭제 이상: 주문의 마지막 옵션 행을 지우면 주문 정보까지 사라진다.

### 2NF: 부분 함수 종속 제거

키 (주문번호, 주문순번, 옵션번호)의 일부에만 종속하는 속성이 있다.

- 주문번호 → 주문일시, 회원번호, 회원이름, 가게번호, 가게명, 배달팁, 배달주소
- (주문번호, 주문순번) → 메뉴번호, 메뉴명, 단가, 수량
- (주문번호, 주문순번, 옵션번호) → 옵션그룹명, 옵션명, 옵션금액 (키 전체에 종속)

결정자마다 릴레이션을 나눈다.

- 주문 (<u>주문번호</u>, 주문일시, 회원번호, 회원이름, 가게번호, 가게명, 배달팁, 배달주소)
- 주문상세 (<u>주문번호, 주문순번</u>, 메뉴번호, 메뉴명, 단가, 수량)
- 주문상세옵션 (<u>주문번호, 주문순번, 옵션번호</u>, 옵션그룹명, 옵션명, 옵션금액)

옵션이 없는 메뉴도 이제 주문상세에 저장할 수 있다.

### 3NF: 이행 함수 종속 제거

주문에 이행 종속이 남아 있다.

- 주문번호 → 회원번호 → 회원이름
- 주문번호 → 가게번호 → 가게명

회원과 가게를 따로 떼어 낸다.

- 주문 (<u>주문번호</u>, 주문일시, 회원번호 → 회원, 가게번호 → 가게, 배달팁, 배달주소)
- 회원 (<u>회원번호</u>, 회원이름)
- 가게 (<u>가게번호</u>, 가게명)

다음 속성은 그대로 둔다. 위 "함수 종속"에서 본 것처럼 다른 키를 거쳐 정해지는 값이 아니기 때문이다.

- 주문.배달팁: 주문 당시 배달팁이다. 가게의 현재 배달팁과 다를 수 있다.
- 주문상세.메뉴명·단가, 주문상세옵션.옵션그룹명·옵션명·옵션금액: 주문 당시 값이다. 현재 메뉴·옵션 값과 다를 수 있다.

### 최종 릴레이션으로 옮기기

3NF 결과를 그대로 테이블로 만들되, 복합 PK 대신 대리 키를 붙였다.

| 3NF 결과 | 최종 릴레이션 | 바뀐 점 |
|---|---|---|
| 주문 | TB_ORD | PK `ORD_ID` |
| 주문상세 | TB_ORD_DTL | PK `ORD_DTL_ID` 추가. (ORD_ID, ORD_DTL_SEQ)는 대체 키(UNIQUE)로 유지 |
| 주문상세옵션 | TB_ORD_DTL_OPT | PK `ORD_DTL_OPT_ID` 추가. 부모는 (주문번호, 주문순번) 대신 `ORD_DTL_ID`로 참조. (ORD_DTL_ID, OPT_ID)에는 UNIQUE 제약이 없다 (아래 참고) |
| 회원 | TB_MBR | |
| 가게 | TB_STORE | 사업자번호 `BIZ_NO`는 대체 키 |

대리 키를 붙여도 종속 관계는 바뀌지 않는다. TB_ORD_DTL에서는 대리 키 `ORD_DTL_ID`와 원래의 복합 키 (ORD_ID, ORD_DTL_SEQ)가 모두 후보 키라서 서로를 결정한다.

TB_ORD_DTL_OPT의 원래 복합 키 (ORD_DTL_ID, OPT_ID)는 DB 제약으로 보장하지 않는다. 주문 생성 API가 장바구니 항목 옵션을 그대로 복사하고, 장바구니 쪽 `TB_CART_DTL_OPT`에는 (CART_DTL_ID, OPT_ID) UNIQUE가 있다. 그래서 같은 옵션이 한 주문 항목에 두 번 들어가지 않는다 (`server/src/api/customer/orders/route.js`).

## 정규화 결과 (전체 릴레이션)

위 과정과 같은 기준으로 23개 릴레이션 전체를 검토한 결과다.

### 제1정규형 (1NF): 모든 속성이 원자값

- 반복되는 값은 행으로 나눴다.
  - 영업시간: 요일·시간대마다 `TB_STORE_HOURS` 한 행. 점심·저녁 사이 쉬는 시간은 같은 요일에 두 행
  - 선택한 옵션: 쉼표로 이어 붙이지 않고 `TB_CART_DTL_OPT`, `TB_ORD_DTL_OPT`에 옵션마다 한 행
  - 주문 메뉴: `TB_ORD_DTL`에 메뉴마다 한 행
- 주소는 도로명(`*_ADDR`)과 상세(`*_DADDR`), 우편번호, 위도·경도로 나눠 저장한다.

### 제2정규형 (2NF): 부분 함수 종속 없음

- 모든 PK가 단일 컬럼 대리 키라서 PK에 대한 부분 종속은 생길 수 없다.
- 복합 후보 키도 확인했다. 예: `TB_ORD_DTL`의 (ORD_ID, ORD_DTL_SEQ)
  - `ORD_MENU_NM`, `ORD_QTY`, `ORD_UPRC`는 주문 하나의 몇 번째 항목인지 전체에 종속한다. 주문(ORD_ID)만으로는 정해지지 않는다.
  - 주문 일시·상태처럼 ORD_ID에만 종속하는 값은 `TB_ORD`에 있다.
- `TB_CART_DTL_OPT`의 후보 키 (CART_DTL_ID, OPT_ID)에는 키 아닌 속성이 없다.

### 제3정규형 (3NF): 이행 함수 종속 없음

- 다른 엔터티의 속성은 FK로만 참조하고 복사하지 않는다. 예외는 아래 "역정규화"에 적었다.
  - 주문은 가게 이름·전화번호를 갖지 않고 `STORE_ID`로 찾는다.
  - 메뉴분류는 별도 릴레이션 `TB_MENU_CTGR`이다. 메뉴에 분류명을 문자열로 두지 않는다.
- 라이더 속성(운송수단, 활동 반경, 상태)은 라이더에게만 있으므로 `TB_RIDER`로 분리했다. 그래서 다른 역할 회원 행에 NULL 컬럼이 생기지 않는다.
- 계산할 수 있는 값은 저장하지 않고 VIEW로 계산한다.
  - 가게 평점·리뷰 수: `V_STORE_RATING`
  - 매출: `V_DONE_ORDER`
  - 라이더 주·월 배달팁: `V_RIDER_DONE_DELIVERY`
- 배달 상태 컬럼은 없다. 배차·픽업·완료 일시로 상태를 판단하므로 상태와 일시가 어긋날 수 없다.

### BCNF: 모든 결정자가 후보 키

위 "함수 종속" 표의 결정자를 릴레이션별로 확인했다.

- 결정자가 모두 후보 키다: TB_STORE의 BIZ_NO, TB_ORD_DTL의 (ORD_ID, ORD_DTL_SEQ), TB_PAY·TB_DLVR·TB_RVW의 ORD_ID, TB_CART의 MBR_ID, TB_RVW_REPLY의 RVW_ID 등
- 예외는 TB_MENU 하나다. `CTGR_ID → STORE_ID`에서 CTGR_ID는 TB_MENU의 후보 키가 아니다. 이 종속은 이행 종속(MENU_ID → CTGR_ID → STORE_ID)이기도 해서 3NF도 벗어난다. 일부러 둔 역정규화다(아래 표).
- 따라서 TB_MENU를 뺀 22개 릴레이션은 BCNF를 만족한다.

### 역정규화와 그 이유

같은 값이 두 곳 이상에 저장되는 곳이다. 한 릴레이션 안에서 정규형을 벗어나는 곳은 `TB_MENU.STORE_ID` 하나다. 나머지는 다른 릴레이션에서 계산하거나 복사할 수 있는 값을 함께 저장한 경우(릴레이션 사이 중복), 또는 주문 당시 값을 남긴 스냅샷이다. 각 항목에 무결성을 지키는 방법을 함께 적었다.

| 위치 | 중복되는 값 | 이유 | 무결성 유지 |
|---|---|---|---|
| `TB_ORD_DTL.ORD_MENU_NM`, `ORD_UPRC` / `TB_ORD_DTL_OPT.ORD_OPT_*` | 메뉴명·단가·옵션명·옵션 금액 | 주문 당시 값을 보존(스냅샷). 메뉴 가격이 바뀌어도 과거 주문 금액은 그대로여야 함 | 주문 생성 트랜잭션에서 한 번만 기록. 이후 수정하지 않음 |
| `TB_ORD.DLVR_ADDR` 등, `TB_ORD.DLVR_TIP_AMT` | 배달 주소·좌표, 배달팁 | 주문 당시 값 보존. 고객이 주소를 지우거나 가게가 배달팁을 바꿔도 주문은 유지 | 위와 같음 |
| `TB_ORD.ORD_TOT_AMT`, `TB_PAY.PAY_AMT` | 주문 항목 합계, 합계 + 배달팁 | 매출·결제 조회 성능, 결제 기록의 독립성 | 주문 생성 트랜잭션에서 함께 계산 |
| `TB_MBR.PNT_BAL_AMT`, `TB_PNT_TXN.PNT_BAL_AMT` | 포인트 거래 누적 합 | 잔액 조회를 거래 전체 합산 없이 하기 위함. 거래 행에는 거래 직후 잔액을 남김 | 충전·사용 API와 `TRG_ORD_CANCEL`(환불)이 같은 트랜잭션에서 함께 갱신. CHECK로 음수 금지 |
| `TB_STORE.STORE_APRV_STTS` | 최신 `TB_STORE_APRV.STORE_APRV_STTS` | 가게 목록에서 승인 여부를 조인 없이 거르기 위함 | 승인·반려 API가 같은 트랜잭션에서 두 테이블을 갱신 |
| `TB_MENU.STORE_ID` | `TB_MENU_CTGR.STORE_ID`로 알 수 있음 (MENU → CTGR → STORE 이행 종속) | 가게별 메뉴 조회와 소유 확인을 조인 없이 하기 위함 | 메뉴 등록·분류 변경 API가 같은 가게의 분류인지 검사 |
| `TB_CART.STORE_ID` | 장바구니 항목 메뉴의 가게 | "한 장바구니에는 한 가게 메뉴만" 규칙을 바로 검사하기 위함 | 담기 API가 가게 일치 검사 |
| `TB_RVW_REPLY.OWNR_MBR_ID` | 리뷰 → 주문 → 가게 → 사장 | 답글 작성자 확인과 조회 단순화 | 답글 API가 가게 소유자인지 검사 |

## 조건부 무결성 규칙

다음 규칙은 일부 행에만 적용된다. 물리 모델에서는 조건부(부분) UNIQUE 인덱스로 구현했다(`physical.md` 참고).

| 규칙 | 릴레이션 |
|---|---|
| 활성 회원끼리만 이메일이 겹치지 않음 | TB_MBR |
| 회원당 기본 주소 하나 | TB_MBR_ADDR |
| 가게당 처리 대기 입점 신청 하나 | TB_STORE_APRV |
| 가게 안에서 삭제되지 않은 분류끼리만 이름이 겹치지 않음 | TB_MENU_CTGR |
| 주문당 포인트 사용·환불은 유형별 하나 | TB_PNT_TXN |
