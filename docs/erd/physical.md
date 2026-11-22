# 물리 데이터 모델

배달 주문 플랫폼의 SQLite 구현을 정리한 문서다. 테이블, 제약조건, 인덱스와 DDL 전문을 담았다.

- 기준: `main` 커밋 `c9f4ae0`(PR #7 merge)의 `server/db/schema.sql`
- DBMS: SQLite 3 (서버는 `better-sqlite3`로 접속). 연결마다 `PRAGMA foreign_keys = ON`
- 그림: `physical.dbml`을 [dbdiagram.io](https://dbdiagram.io/d)에 붙여 넣는다. 읽는 법은 아래 "그림 읽는 법"에 있다. dbdiagram.io에서 내보낸 그림은 `physical-erd.png`, `physical-erd.pdf`다.
- VIEW와 트리거는 정의 SQL과 실행 결과까지 `views-triggers.md`에 따로 정리했다.
- 컬럼별 한글명·타입·NULL·기본값·키·CHECK는 테이블 정의서 `table-definition.md`에 있다.

## 구성

| 객체 | 개수 | 비고 |
|---|---|---|
| 테이블 | 23 | 모두 `STRICT` |
| 외래 키 | 38 | `ON DELETE CASCADE` 2개, 나머지는 기본(NO ACTION) |
| CHECK | 92 | 컬럼 CHECK와 테이블 CHECK 합계 |
| UNIQUE 제약 | 9 | 컬럼 UNIQUE 6, 복합 UNIQUE 3. SQLite가 자동 인덱스를 만든다 |
| 이름 있는 인덱스 | 24 | 일반 인덱스 19, 조건부 UNIQUE 인덱스 5 |
| VIEW | 3 | `views-triggers.md` |
| 트리거 | 19 | 업무 규칙 2, 수정 시각 17. `views-triggers.md` |

## 물리 설계 규칙

- **타입**: `STRICT` 테이블이라 선언한 타입과 다른 값은 들어가지 않는다.
  - 금액은 원 단위 `INTEGER`. 소수 오차가 없다.
  - 일시는 `TEXT 'YYYY-MM-DD HH:MM:SS'`(현지 시각). 문자열 비교가 시간 순서와 같다.
  - 위도·경도는 `REAL`.
  - 코드 값(상태, 역할, 수단)은 `TEXT` + `CHECK (… IN (…))`.
  - 여부 값은 `TEXT 'Y'/'N'` + CHECK.
- **기본 키**: 모든 테이블이 `INTEGER PRIMARY KEY AUTOINCREMENT` 대리 키를 쓴다. 지운 번호를 다시 쓰지 않는다. `TB_RIDER`만 회원 PK를 그대로 PK·FK로 쓴다.
- **문자열 길이**: `STRICT`에는 `VARCHAR(n)`이 없다. 길이는 API 입력 검사에서 확인한다.
- **논리 삭제**: 다른 행이 참조하는 데이터(회원, 가게, 메뉴, 리뷰 등)는 지우지 않고 `DEL_YN = 'Y'`로 표시한다. 그래서 FK는 대부분 NO ACTION이다.
- **감사 컬럼**: `REG_DTTM`(등록 일시)은 기본값으로, `MOD_DTTM`(수정 일시)은 트리거로 채운다.
- **이름 규칙**: 테이블 `TB_`, 일반 인덱스 `IX_<테이블>_<컬럼>`, 조건부 UNIQUE 인덱스 `UK_`, VIEW `V_`, 트리거 `TRG_`.

## 테이블

| # | 테이블 | 업무 이름 | PK | 대체 키(UNIQUE) |
|---|---|---|---|---|
| 1 | `TB_MBR` | 회원 | `MBR_ID` | `MBR_EMAIL` (활성 회원만, 조건부) |
| 2 | `TB_MBR_ADDR` | 회원주소 | `MBR_ADDR_ID` | |
| 3 | `TB_RIDER` | 라이더 | `MBR_ID` (FK 겸용) | |
| 4 | `TB_STORE` | 가게 | `STORE_ID` | `BIZ_NO` |
| 5 | `TB_STORE_HOURS` | 가게영업시간 | `STORE_HOURS_ID` | |
| 6 | `TB_STORE_APRV` | 입점신청 | `STORE_APRV_ID` | |
| 7 | `TB_MENU_CTGR` | 메뉴분류 | `CTGR_ID` | `(STORE_ID, CTGR_NM)` (삭제 안 된 분류만, 조건부) |
| 8 | `TB_MENU` | 메뉴 | `MENU_ID` | |
| 9 | `TB_MENU_OPT_GRP` | 메뉴옵션그룹 | `OPT_GRP_ID` | |
| 10 | `TB_MENU_OPT` | 메뉴옵션 | `OPT_ID` | |
| 11 | `TB_CART` | 장바구니 | `CART_ID` | `MBR_ID` |
| 12 | `TB_CART_DTL` | 장바구니항목 | `CART_DTL_ID` | |
| 13 | `TB_CART_DTL_OPT` | 장바구니항목옵션 | `CART_DTL_OPT_ID` | `(CART_DTL_ID, OPT_ID)` |
| 14 | `TB_ORD` | 주문 | `ORD_ID` | |
| 15 | `TB_ORD_DTL` | 주문상세 | `ORD_DTL_ID` | `(ORD_ID, ORD_DTL_SEQ)` |
| 16 | `TB_ORD_DTL_OPT` | 주문상세옵션 | `ORD_DTL_OPT_ID` | |
| 17 | `TB_PAY` | 결제 | `PAY_ID` | `ORD_ID` |
| 18 | `TB_PNT_TXN` | 포인트거래 | `PNT_TXN_ID` | |
| 19 | `TB_DLVR` | 배달 | `DLVR_ID` | `ORD_ID` |
| 20 | `TB_RVW` | 리뷰 | `RVW_ID` | `ORD_ID` |
| 21 | `TB_RVW_REPLY` | 리뷰답글 | `RVW_REPLY_ID` | `RVW_ID` |
| 22 | `TB_RVW_RPT` | 리뷰신고 | `RVW_RPT_ID` | `(RVW_ID, RPTR_MBR_ID)` |
| 23 | `TB_MBR_RSTR` | 회원제한 | `MBR_RSTR_ID` | |

## 제약조건

### NOT NULL과 DEFAULT

- 업무상 반드시 있는 값은 `NOT NULL`이다. NULL을 허용한 컬럼은 "아직 없음"에 뜻이 있는 컬럼이다. 예: 배차 전 `TB_DLVR.RIDER_MBR_ID`, 접수 전 `TB_ORD.ORD_RCPT_DTTM`
- 상태 컬럼은 첫 상태를 기본값으로 갖는다. 예: `TB_ORD.ORD_STTS = 'WAIT'`, `TB_RIDER.RIDER_STTS = 'IDLE'`, `TB_STORE.STORE_APRV_STTS = 'PENDING'`
- 일시 기본값은 `datetime('now', 'localtime')`이다.

### 외래 키 (38)

| 자식 테이블 | FK 컬럼 | 부모 테이블 | NULL 허용 | ON DELETE |
|---|---|---|---|---|
| `TB_MBR_ADDR` | `MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_RIDER` | `MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_STORE` | `OWNR_MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_STORE_HOURS` | `STORE_ID` | `TB_STORE` | | NO ACTION |
| `TB_STORE_APRV` | `STORE_ID` | `TB_STORE` | | NO ACTION |
| `TB_STORE_APRV` | `PRCSR_MBR_ID` | `TB_MBR` | 예 | NO ACTION |
| `TB_MENU_CTGR` | `STORE_ID` | `TB_STORE` | | NO ACTION |
| `TB_MENU` | `STORE_ID` | `TB_STORE` | | NO ACTION |
| `TB_MENU` | `CTGR_ID` | `TB_MENU_CTGR` | | NO ACTION |
| `TB_MENU_OPT_GRP` | `MENU_ID` | `TB_MENU` | | NO ACTION |
| `TB_MENU_OPT` | `OPT_GRP_ID` | `TB_MENU_OPT_GRP` | | NO ACTION |
| `TB_CART` | `MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_CART` | `STORE_ID` | `TB_STORE` | | NO ACTION |
| `TB_CART_DTL` | `CART_ID` | `TB_CART` | | **CASCADE** |
| `TB_CART_DTL` | `MENU_ID` | `TB_MENU` | | NO ACTION |
| `TB_CART_DTL_OPT` | `CART_DTL_ID` | `TB_CART_DTL` | | **CASCADE** |
| `TB_CART_DTL_OPT` | `OPT_ID` | `TB_MENU_OPT` | | NO ACTION |
| `TB_ORD` | `MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_ORD` | `STORE_ID` | `TB_STORE` | | NO ACTION |
| `TB_ORD` | `CNCL_PRCSR_MBR_ID` | `TB_MBR` | 예 | NO ACTION |
| `TB_ORD_DTL` | `ORD_ID` | `TB_ORD` | | NO ACTION |
| `TB_ORD_DTL` | `MENU_ID` | `TB_MENU` | | NO ACTION |
| `TB_ORD_DTL_OPT` | `ORD_DTL_ID` | `TB_ORD_DTL` | | NO ACTION |
| `TB_ORD_DTL_OPT` | `OPT_ID` | `TB_MENU_OPT` | | NO ACTION |
| `TB_PAY` | `ORD_ID` | `TB_ORD` | | NO ACTION |
| `TB_PNT_TXN` | `MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_PNT_TXN` | `ORD_ID` | `TB_ORD` | 예 | NO ACTION |
| `TB_DLVR` | `ORD_ID` | `TB_ORD` | | NO ACTION |
| `TB_DLVR` | `RIDER_MBR_ID` | `TB_RIDER` | 예 | NO ACTION |
| `TB_RVW` | `ORD_ID` | `TB_ORD` | | NO ACTION |
| `TB_RVW_REPLY` | `RVW_ID` | `TB_RVW` | | NO ACTION |
| `TB_RVW_REPLY` | `OWNR_MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_RVW_RPT` | `RVW_ID` | `TB_RVW` | | NO ACTION |
| `TB_RVW_RPT` | `RPTR_MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_RVW_RPT` | `PRCSR_MBR_ID` | `TB_MBR` | 예 | NO ACTION |
| `TB_MBR_RSTR` | `MBR_ID` | `TB_MBR` | | NO ACTION |
| `TB_MBR_RSTR` | `RVW_RPT_ID` | `TB_RVW_RPT` | 예 | NO ACTION |
| `TB_MBR_RSTR` | `PRCSR_MBR_ID` | `TB_MBR` | | NO ACTION |

- CASCADE는 장바구니에만 쓴다. 주문하거나 장바구니를 비우면 항목과 항목 옵션이 함께 지워진다.
- 나머지는 NO ACTION이다. 참조되는 부모 행은 지울 수 없다. 업무 데이터는 논리 삭제(`DEL_YN`)로 숨긴다.

### UNIQUE (9)

- 컬럼 UNIQUE 6: `TB_STORE.BIZ_NO`, `TB_CART.MBR_ID`, `TB_PAY.ORD_ID`, `TB_DLVR.ORD_ID`, `TB_RVW.ORD_ID`, `TB_RVW_REPLY.RVW_ID`
  - 뒤의 다섯은 1:1 관계를 만든다. 회원당 장바구니 하나, 주문당 결제·배달·리뷰 하나, 리뷰당 답글 하나
- 복합 UNIQUE 3: `TB_CART_DTL_OPT (CART_DTL_ID, OPT_ID)`, `TB_ORD_DTL (ORD_ID, ORD_DTL_SEQ)`, `TB_RVW_RPT (RVW_ID, RPTR_MBR_ID)`

### 조건부 UNIQUE (부분 UNIQUE 인덱스 5)

`WHERE` 조건을 만족하는 행 사이에서만 값이 겹치지 않는다. 일반 UNIQUE로는 표현할 수 없는 규칙이다.

| 인덱스 | 대상 | 조건 | 규칙 |
|---|---|---|---|
| `UK_MBR_EMAIL_ACTIVE` | `TB_MBR (MBR_EMAIL)` | `MBR_STTS = 'ACTIVE'` | 활성 회원끼리만 이메일 중복 금지. 탈퇴한 이메일로 다시 가입 가능 |
| `UK_MBR_ADDR_DFLT` | `TB_MBR_ADDR (MBR_ID)` | `DFLT_YN = 'Y' AND DEL_YN = 'N'` | 회원당 기본 주소 하나 |
| `UK_STORE_APRV_PENDING` | `TB_STORE_APRV (STORE_ID)` | `STORE_APRV_STTS = 'PENDING'` | 가게당 처리 대기 신청 하나. 반려 뒤 재신청 가능 |
| `UK_MENU_CTGR_STORE_NM` | `TB_MENU_CTGR (STORE_ID, CTGR_NM)` | `DEL_YN = 'N'` | 삭제되지 않은 분류끼리만 이름 중복 금지 |
| `UK_PNT_TXN_ORD_TYPE` | `TB_PNT_TXN (ORD_ID, PNT_TXN_TYPE_CD)` | `ORD_ID IS NOT NULL` | 주문당 사용·환불 거래는 유형별 하나(중복 환불 방지) |

### CHECK (92)

CHECK는 세 종류다. 전체 목록은 아래 DDL과 `physical.dbml`의 각 테이블 `checks`에 있다.

| 종류 | 예 |
|---|---|
| 코드 값 목록 | `ORD_STTS IN ('WAIT', 'COOKING', 'READY', 'DELIVERING', 'DONE', 'CANCEL')`, `DEL_YN IN ('Y', 'N')` |
| 값의 범위·형식 | `RVW_RTNG BETWEEN 1 AND 5`, `PNT_BAL_AMT >= 0`, `BIZ_NO GLOB '[0-9][0-9][0-9]-…'`, `MBR_LAT BETWEEN -90 AND 90` |
| 여러 컬럼의 짝 (테이블 CHECK) | 아래 표 |

여러 컬럼의 짝을 강제하는 테이블 CHECK:

| 테이블 | 규칙 |
|---|---|
| `TB_MBR` | 탈퇴 상태 ⇔ 탈퇴 일시. 활성 회원은 비밀번호·전화번호 필수, 탈퇴 회원은 둘 다 NULL |
| `TB_STORE_HOURS` | 시작 시각 < 종료 시각 |
| `TB_STORE_APRV`, `TB_RVW_RPT` | 처리 대기(PENDING) ⇔ 처리자·처리 일시 없음. 입점 반려 ⇔ 반려 사유 |
| `TB_ORD` | 접수 일시 ⇔ 조리 예상분. 취소 상태 ⇔ 취소 일시·주체·사유. 고객 취소는 `CUSTOMER_REQUEST`, 자동 취소는 `NO_RESPONSE`. 관리자 취소 ⇔ 처리 관리자·상담 메모 |
| `TB_PAY` | 승인 상태면 승인 일시 필수. 취소 상태 ⇔ 취소 일시 |
| `TB_PNT_TXN` | 충전 ⇔ 충전 수단. 사용·환불 ⇔ 주문 연결 |
| `TB_DLVR` | 배차 ⇔ 라이더·배차 일시. 배차 → 픽업 → 완료 시각 순서 |
| `TB_MBR_RSTR` | 종료 일시는 시작 일시 이후 |

### DB 제약 대신 서버가 검사하는 규칙

여러 테이블을 함께 봐야 하는 규칙은 CHECK로 쓸 수 없다. 이런 규칙은 API가 트랜잭션 안에서 검사한다(`schema.sql` 머리말).

- 리뷰 작성 조건(배달 완료 후 3일 이내, 리뷰 작성 제한 없음)
- 장바구니 항목의 메뉴가 장바구니 가게의 메뉴인지
- 답글 작성자가 그 가게의 사장인지
- 같은 회원에게 활성 제한이 겹치지 않는지
- 라이더 BUSY 전환, 배달 완료 시 IDLE 복귀

## 인덱스

### 일반 인덱스 (19)

| 인덱스 | 테이블 (컬럼) | 쓰는 곳 |
|---|---|---|
| `IX_MBR_ADDR_MBR` | `TB_MBR_ADDR (MBR_ID)` | 고객 주소 목록 |
| `IX_STORE_OWNR` | `TB_STORE (OWNR_MBR_ID)` | 사장의 가게 목록 |
| `IX_STORE_HOURS_STORE_DAY` | `TB_STORE_HOURS (STORE_ID, DAY_OF_WEEK)` | 지금 영업 중인지 계산 |
| `IX_MENU_CTGR_STORE_SEQ` | `TB_MENU_CTGR (STORE_ID, CTGR_SEQ)` | 가게 메뉴판의 분류 순서 |
| `IX_MENU_STORE` | `TB_MENU (STORE_ID)` | 가게별 메뉴 조회 |
| `IX_MENU_CTGR_SEQ` | `TB_MENU (CTGR_ID, MENU_SEQ)` | 분류 안의 메뉴 순서 |
| `IX_OPT_GRP_MENU_SEQ` | `TB_MENU_OPT_GRP (MENU_ID, OPT_GRP_SEQ)` | 메뉴의 옵션그룹 순서 |
| `IX_OPT_GRP_OPT_SEQ` | `TB_MENU_OPT (OPT_GRP_ID, OPT_SEQ)` | 옵션그룹의 옵션 순서 |
| `IX_CART_DTL_CART` | `TB_CART_DTL (CART_ID)` | 장바구니 항목 조회 |
| `IX_ORD_MBR_DTTM` | `TB_ORD (MBR_ID, ORD_DTTM)` | 고객 주문 내역 (최신순) |
| `IX_ORD_STORE_DTTM` | `TB_ORD (STORE_ID, ORD_DTTM)` | 사장 주문 목록, 기간 조회 |
| `IX_ORD_STTS_DTTM` | `TB_ORD (ORD_STTS, ORD_DTTM)` | 10분 미접수 주문 자동 취소 |
| `IX_ORD_DTL_MENU` | `TB_ORD_DTL (MENU_ID)` | `MENU_ID` FK 인덱스. 메뉴별 매출 쿼리는 `ORD_ID`로 조인하므로 이 인덱스를 쓰지 않는다 |
| `IX_ORD_DTL_OPT_DTL` | `TB_ORD_DTL_OPT (ORD_DTL_ID)` | 주문 상세의 옵션 조회, 메뉴별 매출의 옵션 금액 합산 |
| `IX_PNT_TXN_MBR_DTTM` | `TB_PNT_TXN (MBR_ID, PNT_TXN_DTTM)` | 포인트 내역 (최신순) |
| `IX_DLVR_RIDER_CMPL` | `TB_DLVR (RIDER_MBR_ID, DLVR_CMPL_DTTM)` | 라이더 진행 중 배달, 배달 내역, 배달팁 집계 |
| `IX_DLVR_RIDER_REG` | `TB_DLVR (RIDER_MBR_ID, REG_DTTM)` | 라이더별 배달 조회. 현재 서버 코드에는 `REG_DTTM` 조건·정렬 쿼리가 없다 |
| `IX_RVW_RPT_STTS_REG` | `TB_RVW_RPT (RVW_RPT_STTS, REG_DTTM)` | 관리자 신고 목록 (상태별, 접수순) |
| `IX_MBR_RSTR_MBR_TYPE` | `TB_MBR_RSTR (MBR_ID, RSTR_TYPE_CD)` | 회원의 활성 제한 확인 |

- 대부분 FK 컬럼을 맨 앞에 둔다. 부모 기준 조회와 FK 검사가 빨라진다.
- 정렬에 쓰는 컬럼(일시, 순서)을 두 번째에 둔다. 조회와 정렬을 인덱스 하나로 처리한다.
- 순서 컬럼(`*_SEQ`)은 UNIQUE로 만들지 않았다. 순서를 바꾸는 중간이나 논리 삭제 뒤에 값이 잠시 겹칠 수 있기 때문이다.

### UNIQUE 인덱스 (14)

- 조건부 UNIQUE 인덱스 5: 위 "조건부 UNIQUE" 표
- 자동 인덱스 9: UNIQUE 제약마다 SQLite가 `sqlite_autoindex_<테이블>_N`을 만든다. 예: `TB_PAY.ORD_ID`로 결제를 찾을 때 쓴다.

### 인덱스 사용 확인

`EXPLAIN QUERY PLAN`으로 서버가 쓰는 쿼리가 인덱스를 타는지 확인했다(시드 데이터를 넣은 DB, SQLite 3.51).

| 쿼리 | 실행 계획 |
|---|---|
| 10분 미접수 주문 찾기 `WHERE ORD_STTS = 'WAIT' AND ORD_DTTM <= …` | `SEARCH TB_ORD USING COVERING INDEX IX_ORD_STTS_DTTM (ORD_STTS=? AND ORD_DTTM<?)` |
| 고객 주문 내역 `WHERE MBR_ID = ? ORDER BY ORD_DTTM DESC` | `SEARCH o USING INDEX IX_ORD_MBR_DTTM (MBR_ID=?)` |
| 포인트 내역 `WHERE MBR_ID = ? ORDER BY PNT_TXN_DTTM DESC` | `SEARCH TB_PNT_TXN USING INDEX IX_PNT_TXN_MBR_DTTM (MBR_ID=?)` |
| 라이더 배달 내역 `V_RIDER_DONE_DELIVERY WHERE RIDER_MBR_ID = ?` | `SEARCH d USING INDEX IX_DLVR_RIDER_CMPL (RIDER_MBR_ID=? AND DLVR_CMPL_DTTM>?)` |
| 로그인 이메일 찾기 `WHERE MBR_EMAIL = ? AND MBR_STTS = 'ACTIVE'` | `SEARCH TB_MBR USING COVERING INDEX UK_MBR_EMAIL_ACTIVE (MBR_EMAIL=?)` |

## 그림 읽는 법 (`physical.dbml`)

- 테이블은 업무 영역 6묶음(회원, 가게_메뉴, 장바구니, 주문_결제, 배달, 리뷰_신고)과 VIEW 묶음으로 나뉜다.
- 관계선 표기. `>`와 `>?`는 왼쪽이 FK를 가진 테이블이고, `-`는 DBML 규칙에 따라 오른쪽이 FK를 가진 테이블이다.

| 표기 | 개수 | 뜻 |
|---|---|---|
| `>` | 26 | 다대일. FK는 NOT NULL |
| `>?` | 6 | 다대일. FK가 NULL 허용(부모가 없을 수 있음) |
| `-` | 6 | 1:1. `부모.PK - 자식.FK` 순서. FK가 UNIQUE 또는 PK |

- 컬럼에 마우스를 올리면 CHECK와 기본값이 보인다. 테이블 note에는 업무 이름과 그 테이블의 트리거가 있다.
- 조건부 UNIQUE 인덱스는 DBML로 조건을 표현할 수 없다. 그래서 `unique` 표시 없이 인덱스로만 그리고, 인덱스 note에 원문 SQL을 남겼다.

## DDL

`server/db/schema.sql` 전문이다. 테이블, 제약조건, 인덱스를 만든다. VIEW(`views.sql`)와 트리거(`triggers.sql`)의 DDL은 `views-triggers.md`에 있다.

실행 순서: `schema.sql` → `views.sql` → `triggers.sql` → `seed.sql`(시연 데이터). `npm run db:init`이 이 순서로 `server/delivery.db`를 새로 만든다.

```sql
-- 배달 주문 플랫폼 스키마 (SQLite, STRICT)
-- 기준: 11/08 테이블 정의서 21개 + 11/12 ERD 변경(신규 TB_STORE_HOURS, TB_MENU_CTGR) = 23개 테이블
-- 규칙
--   * 일시는 TEXT 'YYYY-MM-DD HH:MM:SS' (datetime('now','localtime')), 금액은 원 단위 INTEGER
--   * 한 테이블 안의 무결성(CHECK, UNIQUE, FK, 부분 UNIQUE 인덱스)만 스키마에 둔다
--   * 여러 테이블에 걸친 검사(리뷰 작성 조건, 장바구니 가게 일치, 답글 소유자, 활성 제재 중복,
--     주문↔배달 상태)는 서버 코드가 한다
--   * VARCHAR(n) 길이는 STRICT 타입에 없으므로 DB에서 강제하지 않고 API 입력 검사에서 확인한다
--   * MOD_DTTM 자동 갱신은 db/triggers.sql 의 TRG_<테이블>_MOD_DTTM 이 맡는다

PRAGMA foreign_keys = ON;

-- 1 회원
CREATE TABLE TB_MBR (
  MBR_ID         INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_EMAIL      TEXT    NOT NULL,                       -- 활성 회원 사이에서만 UNIQUE (UK_MBR_EMAIL_ACTIVE)
  MBR_PWD        TEXT,                                   -- 탈퇴 시 NULL
  MBR_NM         TEXT    NOT NULL,                       -- 탈퇴 시 '탈퇴회원'
  MBR_TELNO      TEXT,                                   -- 탈퇴 시 NULL
  MBR_ROLE_CD    TEXT    NOT NULL CHECK (MBR_ROLE_CD IN ('CUSTOMER', 'OWNER', 'RIDER', 'ADMIN')),
  MBR_STTS       TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK (MBR_STTS IN ('ACTIVE', 'WITHDRAWN')),
  PNT_BAL_AMT    INTEGER NOT NULL DEFAULT 0 CHECK (PNT_BAL_AMT >= 0),
  MBR_LOGIN_DTTM TEXT,
  MBR_WTHDR_DTTM TEXT,
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN         TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N')),
  -- 탈퇴 ⇔ 탈퇴일시, 활성 회원은 비밀번호·전화번호 필수, 탈퇴 회원은 비움
  CHECK ((MBR_STTS = 'WITHDRAWN') = (MBR_WTHDR_DTTM IS NOT NULL)),
  CHECK (MBR_STTS = 'WITHDRAWN' OR (MBR_PWD IS NOT NULL AND MBR_TELNO IS NOT NULL)),
  CHECK (MBR_STTS = 'ACTIVE' OR (MBR_PWD IS NULL AND MBR_TELNO IS NULL))
) STRICT;
-- 이메일 중복은 활성 회원끼리만 막는다. 탈퇴 회원 행은 이메일을 그대로 두고, 같은 이메일로 다시 가입할 수 있다
CREATE UNIQUE INDEX UK_MBR_EMAIL_ACTIVE ON TB_MBR (MBR_EMAIL) WHERE MBR_STTS = 'ACTIVE';

-- 2 회원주소
CREATE TABLE TB_MBR_ADDR (
  MBR_ADDR_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID      INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  MBR_ADDR_NM TEXT    NOT NULL,
  MBR_ADDR    TEXT    NOT NULL,
  MBR_DADDR   TEXT,
  MBR_ZIP     TEXT    NOT NULL CHECK (MBR_ZIP GLOB '[0-9][0-9][0-9][0-9][0-9]'),
  MBR_LAT     REAL    NOT NULL CHECK (MBR_LAT BETWEEN -90 AND 90),
  MBR_LNG     REAL    NOT NULL CHECK (MBR_LNG BETWEEN -180 AND 180),
  DFLT_YN     TEXT    NOT NULL DEFAULT 'N' CHECK (DFLT_YN IN ('Y', 'N')),
  REG_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN      TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;
CREATE INDEX IX_MBR_ADDR_MBR ON TB_MBR_ADDR (MBR_ID);
-- 회원당 (삭제되지 않은) 기본 배송지는 1개
CREATE UNIQUE INDEX UK_MBR_ADDR_DFLT ON TB_MBR_ADDR (MBR_ID) WHERE DFLT_YN = 'Y' AND DEL_YN = 'N';

-- 3 라이더 (기준 좌표 컬럼 없음: 라이더 위치는 API의 숭실대 좌표 상수)
CREATE TABLE TB_RIDER (
  MBR_ID       INTEGER PRIMARY KEY REFERENCES TB_MBR (MBR_ID),
  RIDER_STTS   TEXT    NOT NULL DEFAULT 'IDLE' CHECK (RIDER_STTS IN ('IDLE', 'BUSY')),
  VHCL_TYPE_CD TEXT    NOT NULL CHECK (VHCL_TYPE_CD IN ('WALK', 'BICYCLE', 'MOTORCYCLE', 'CAR')),
  ACT_RADIUS_M INTEGER NOT NULL DEFAULT 3000 CHECK (ACT_RADIUS_M BETWEEN 500 AND 5000),
  REG_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;

-- 4 가게 (평점은 저장하지 않음: V_STORE_RATING)
CREATE TABLE TB_STORE (
  STORE_ID        INTEGER PRIMARY KEY AUTOINCREMENT,
  OWNR_MBR_ID     INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  STORE_NM        TEXT    NOT NULL,
  STORE_CTGR_CD   TEXT    NOT NULL CHECK (STORE_CTGR_CD IN ('CHICKEN', 'PIZZA', 'KOREAN', 'CHINESE', 'JAPANESE', 'SNACK', 'CAFE', 'ETC')),
  BIZ_NO          TEXT    NOT NULL UNIQUE CHECK (BIZ_NO GLOB '[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'),
  STORE_TELNO     TEXT    NOT NULL,
  STORE_ADDR      TEXT    NOT NULL,
  STORE_DADDR     TEXT,
  STORE_LAT       REAL    NOT NULL CHECK (STORE_LAT BETWEEN -90 AND 90),
  STORE_LNG       REAL    NOT NULL CHECK (STORE_LNG BETWEEN -180 AND 180),
  STORE_CN        TEXT,                                  -- 가게 소개
  MIN_ORD_AMT     INTEGER NOT NULL CHECK (MIN_ORD_AMT >= 0),
  DLVR_TIP_AMT    INTEGER NOT NULL CHECK (DLVR_TIP_AMT >= 0),
  COOK_EST_MI     INTEGER NOT NULL CHECK (COOK_EST_MI > 0), -- 기본 조리시간(분). 11/08 DLVR_EST_MI 대체
  STORE_OPER_STTS TEXT    NOT NULL DEFAULT 'PAUSED' CHECK (STORE_OPER_STTS IN ('OPEN', 'PAUSED')), -- CLOSED는 조회 때 계산
  STORE_APRV_STTS TEXT    NOT NULL DEFAULT 'PENDING' CHECK (STORE_APRV_STTS IN ('PENDING', 'APPROVED', 'REJECTED')), -- TB_STORE_APRV와 같은 트랜잭션에서 갱신
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN          TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;
CREATE INDEX IX_STORE_OWNR ON TB_STORE (OWNR_MBR_ID);

-- 신규 가게영업시간 (요일에 행이 여러 개면 브레이크 타임, 행이 없는 요일은 휴무)
CREATE TABLE TB_STORE_HOURS (
  STORE_HOURS_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID       INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  DAY_OF_WEEK    INTEGER NOT NULL CHECK (DAY_OF_WEEK BETWEEN 0 AND 6), -- 0(일)~6(토)
  OPEN_TM        TEXT    NOT NULL CHECK (OPEN_TM GLOB '[0-2][0-9]:[0-5][0-9]' AND OPEN_TM < '24:00'),
  CLOSE_TM       TEXT    NOT NULL CHECK (CLOSE_TM GLOB '[0-2][0-9]:[0-5][0-9]' AND CLOSE_TM <= '24:00'), -- 자정은 24:00
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (OPEN_TM < CLOSE_TM)
) STRICT;
CREATE INDEX IX_STORE_HOURS_STORE_DAY ON TB_STORE_HOURS (STORE_ID, DAY_OF_WEEK);

-- 5 입점승인 (재신청 시 새 행)
CREATE TABLE TB_STORE_APRV (
  STORE_APRV_ID   INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID        INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  STORE_APRV_STTS TEXT    NOT NULL DEFAULT 'PENDING' CHECK (STORE_APRV_STTS IN ('PENDING', 'APPROVED', 'REJECTED')),
  APLY_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRCSR_MBR_ID    INTEGER REFERENCES TB_MBR (MBR_ID),
  PRCS_DTTM       TEXT,
  RJCT_RSN_CN     TEXT,
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 처리 전(PENDING) ⇔ 처리자·처리일시 없음, 반려 ⇔ 반려 사유
  CHECK ((STORE_APRV_STTS = 'PENDING') = (PRCSR_MBR_ID IS NULL)),
  CHECK ((STORE_APRV_STTS = 'PENDING') = (PRCS_DTTM IS NULL)),
  CHECK ((STORE_APRV_STTS = 'REJECTED') = (RJCT_RSN_CN IS NOT NULL))
) STRICT;
-- 가게당 처리 대기 신청은 1건
CREATE UNIQUE INDEX UK_STORE_APRV_PENDING ON TB_STORE_APRV (STORE_ID) WHERE STORE_APRV_STTS = 'PENDING';

-- 신규 메뉴분류
CREATE TABLE TB_MENU_CTGR (
  CTGR_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  CTGR_NM  TEXT    NOT NULL,
  CTGR_SEQ INTEGER NOT NULL,
  REG_DTTM TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN   TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;
CREATE INDEX IX_MENU_CTGR_STORE_SEQ ON TB_MENU_CTGR (STORE_ID, CTGR_SEQ);
-- 같은 가게 안 분류명 중복 금지 (논리 삭제된 분류는 제외). 서버도 DUPLICATE_CATEGORY로 먼저 검사
CREATE UNIQUE INDEX UK_MENU_CTGR_STORE_NM ON TB_MENU_CTGR (STORE_ID, CTGR_NM) WHERE DEL_YN = 'N';

-- 6 메뉴
CREATE TABLE TB_MENU (
  MENU_ID        INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID       INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  CTGR_ID        INTEGER NOT NULL REFERENCES TB_MENU_CTGR (CTGR_ID),
  MENU_NM        TEXT    NOT NULL,
  MENU_AMT       INTEGER NOT NULL CHECK (MENU_AMT >= 0),
  MENU_CN        TEXT,
  MENU_SEQ       INTEGER NOT NULL,
  MENU_SALE_STTS TEXT    NOT NULL DEFAULT 'ON_SALE' CHECK (MENU_SALE_STTS IN ('ON_SALE', 'SOLD_OUT')),
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN         TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;
CREATE INDEX IX_MENU_STORE ON TB_MENU (STORE_ID);
CREATE INDEX IX_MENU_CTGR_SEQ ON TB_MENU (CTGR_ID, MENU_SEQ);

-- 7 메뉴옵션그룹 (순서는 논리 삭제·순서 변경과 충돌하므로 일반 인덱스)
CREATE TABLE TB_MENU_OPT_GRP (
  OPT_GRP_ID   INTEGER PRIMARY KEY AUTOINCREMENT,
  MENU_ID      INTEGER NOT NULL REFERENCES TB_MENU (MENU_ID),
  OPT_GRP_NM   TEXT    NOT NULL,
  RQRD_YN      TEXT    NOT NULL DEFAULT 'N' CHECK (RQRD_YN IN ('Y', 'N')),
  MAX_SLCT_CNT INTEGER NOT NULL DEFAULT 1 CHECK (MAX_SLCT_CNT >= 1),
  OPT_GRP_SEQ  INTEGER NOT NULL,
  REG_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN       TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;
CREATE INDEX IX_OPT_GRP_MENU_SEQ ON TB_MENU_OPT_GRP (MENU_ID, OPT_GRP_SEQ);

-- 8 메뉴옵션
CREATE TABLE TB_MENU_OPT (
  OPT_ID     INTEGER PRIMARY KEY AUTOINCREMENT,
  OPT_GRP_ID INTEGER NOT NULL REFERENCES TB_MENU_OPT_GRP (OPT_GRP_ID),
  OPT_NM     TEXT    NOT NULL,
  OPT_AMT    INTEGER NOT NULL DEFAULT 0 CHECK (OPT_AMT >= 0),
  OPT_SEQ    INTEGER NOT NULL,
  REG_DTTM   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN     TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;
CREATE INDEX IX_OPT_GRP_OPT_SEQ ON TB_MENU_OPT (OPT_GRP_ID, OPT_SEQ);

-- 9 장바구니 (회원당 1개, 한 가게의 메뉴만: 가게 일치는 서버 검사)
CREATE TABLE TB_CART (
  CART_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID   INTEGER NOT NULL UNIQUE REFERENCES TB_MBR (MBR_ID),
  STORE_ID INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  REG_DTTM TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;

-- 10 장바구니항목 (장바구니를 지우면 함께 삭제)
CREATE TABLE TB_CART_DTL (
  CART_DTL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  CART_ID     INTEGER NOT NULL REFERENCES TB_CART (CART_ID) ON DELETE CASCADE,
  MENU_ID     INTEGER NOT NULL REFERENCES TB_MENU (MENU_ID),
  CART_QTY    INTEGER NOT NULL DEFAULT 1 CHECK (CART_QTY >= 1),
  REG_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;
CREATE INDEX IX_CART_DTL_CART ON TB_CART_DTL (CART_ID);

-- 11 장바구니항목옵션
CREATE TABLE TB_CART_DTL_OPT (
  CART_DTL_OPT_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  CART_DTL_ID     INTEGER NOT NULL REFERENCES TB_CART_DTL (CART_DTL_ID) ON DELETE CASCADE,
  OPT_ID          INTEGER NOT NULL REFERENCES TB_MENU_OPT (OPT_ID),
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (CART_DTL_ID, OPT_ID)
) STRICT;

-- 12 주문
CREATE TABLE TB_ORD (
  ORD_ID            INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID            INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  STORE_ID          INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  ORD_DTTM          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- READY = 조리완료·픽업대기 (배차대기 아님)
  ORD_STTS          TEXT    NOT NULL DEFAULT 'WAIT' CHECK (ORD_STTS IN ('WAIT', 'COOKING', 'READY', 'DELIVERING', 'DONE', 'CANCEL')),
  ORD_TOT_AMT       INTEGER NOT NULL CHECK (ORD_TOT_AMT >= 0), -- 메뉴·옵션 합계 (배달팁 제외)
  DLVR_TIP_AMT      INTEGER NOT NULL CHECK (DLVR_TIP_AMT >= 0), -- 주문 시점 배달팁
  STORE_RQST_CN     TEXT,
  RIDER_RQST_CN     TEXT,
  CUTLERY_YN        TEXT    NOT NULL DEFAULT 'N' CHECK (CUTLERY_YN IN ('Y', 'N')),
  DLVR_ADDR         TEXT    NOT NULL,
  DLVR_DADDR        TEXT,
  DLVR_LAT          REAL    NOT NULL CHECK (DLVR_LAT BETWEEN -90 AND 90),
  DLVR_LNG          REAL    NOT NULL CHECK (DLVR_LNG BETWEEN -180 AND 180),
  ORD_RCPT_DTTM     TEXT,
  COOK_EST_MI       INTEGER CHECK (COOK_EST_MI > 0),   -- 이 주문의 조리 예상분
  ORD_CNCL_DTTM     TEXT,
  CNCL_ACTR_CD      TEXT    CHECK (CNCL_ACTR_CD IN ('CUSTOMER', 'OWNER', 'SYSTEM', 'ADMIN')),
  CNCL_RSN_CD       TEXT    CHECK (CNCL_RSN_CD IN ('OUT_OF_STOCK', 'BUSY', 'CLOSING', 'CANNOT_COOK', 'NO_RESPONSE',
                                                   'CUSTOMER_REQUEST', 'STORE_ISSUE', 'DELIVERY_FAIL', 'ETC')),
  ORD_CNCL_RSN_CN   TEXT,                              -- 사유 상세 (ETC일 때 필수)
  CNCL_PRCSR_MBR_ID INTEGER REFERENCES TB_MBR (MBR_ID), -- 고객센터 취소 처리 관리자
  CNSL_MEMO_CN      TEXT,                              -- 고객센터 상담 메모
  REG_DTTM          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 접수일시와 조리예상분은 함께 기록. 접수 이후 상태는 둘 다 필수, WAIT는 둘 다 없음 (CANCEL은 접수 전후 모두 가능)
  CHECK ((ORD_RCPT_DTTM IS NULL) = (COOK_EST_MI IS NULL)),
  CHECK (ORD_STTS NOT IN ('COOKING', 'READY', 'DELIVERING', 'DONE') OR ORD_RCPT_DTTM IS NOT NULL),
  CHECK (ORD_STTS <> 'WAIT' OR ORD_RCPT_DTTM IS NULL),
  -- 취소 상태 ⇔ 취소일시·취소주체
  CHECK ((ORD_STTS = 'CANCEL') = (ORD_CNCL_DTTM IS NOT NULL)),
  CHECK ((ORD_STTS = 'CANCEL') = (CNCL_ACTR_CD IS NOT NULL)),
  -- 취소 주문 ⇔ 취소 사유 코드. 고객 직접 취소는 CUSTOMER_REQUEST, 자동 취소는 NO_RESPONSE. ETC면 상세 필수
  CHECK ((ORD_STTS = 'CANCEL') = (CNCL_RSN_CD IS NOT NULL)),
  CHECK (ORD_STTS = 'CANCEL' OR ORD_CNCL_RSN_CN IS NULL),
  CHECK (CNCL_ACTR_CD IS NOT 'CUSTOMER' OR CNCL_RSN_CD = 'CUSTOMER_REQUEST'),
  CHECK (CNCL_ACTR_CD IS NOT 'SYSTEM' OR CNCL_RSN_CD = 'NO_RESPONSE'),
  CHECK (CNCL_RSN_CD IS NOT 'ETC' OR ORD_CNCL_RSN_CN IS NOT NULL),
  -- 관리자(고객센터) 취소 ⇔ 처리 관리자·상담 메모
  CHECK ((CNCL_ACTR_CD IS 'ADMIN') = (CNCL_PRCSR_MBR_ID IS NOT NULL)),
  CHECK ((CNCL_ACTR_CD IS 'ADMIN') = (CNSL_MEMO_CN IS NOT NULL))
) STRICT;
CREATE INDEX IX_ORD_MBR_DTTM ON TB_ORD (MBR_ID, ORD_DTTM);
CREATE INDEX IX_ORD_STORE_DTTM ON TB_ORD (STORE_ID, ORD_DTTM);
CREATE INDEX IX_ORD_STTS_DTTM ON TB_ORD (ORD_STTS, ORD_DTTM); -- 10분 미접수 자동 취소

-- 13 주문상세 (메뉴명·단가 스냅샷)
CREATE TABLE TB_ORD_DTL (
  ORD_DTL_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID      INTEGER NOT NULL REFERENCES TB_ORD (ORD_ID),
  ORD_DTL_SEQ INTEGER NOT NULL,
  MENU_ID     INTEGER NOT NULL REFERENCES TB_MENU (MENU_ID),
  ORD_MENU_NM TEXT    NOT NULL,
  ORD_QTY     INTEGER NOT NULL CHECK (ORD_QTY >= 1),
  ORD_UPRC    INTEGER NOT NULL CHECK (ORD_UPRC >= 0), -- 옵션 제외 단가
  REG_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (ORD_ID, ORD_DTL_SEQ)
) STRICT;
CREATE INDEX IX_ORD_DTL_MENU ON TB_ORD_DTL (MENU_ID);

-- 14 주문상세옵션 (옵션 그룹명·옵션명·금액 스냅샷)
CREATE TABLE TB_ORD_DTL_OPT (
  ORD_DTL_OPT_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_DTL_ID     INTEGER NOT NULL REFERENCES TB_ORD_DTL (ORD_DTL_ID),
  OPT_ID         INTEGER NOT NULL REFERENCES TB_MENU_OPT (OPT_ID),
  ORD_OPT_GRP_NM TEXT    NOT NULL,
  ORD_OPT_NM     TEXT    NOT NULL,
  ORD_OPT_AMT    INTEGER NOT NULL CHECK (ORD_OPT_AMT >= 0),
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;
CREATE INDEX IX_ORD_DTL_OPT_DTL ON TB_ORD_DTL_OPT (ORD_DTL_ID);

-- 15 결제 (주문당 1건, 단일 결제수단)
CREATE TABLE TB_PAY (
  PAY_ID        INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID        INTEGER NOT NULL UNIQUE REFERENCES TB_ORD (ORD_ID),
  PAY_MTHD_CD   TEXT    NOT NULL CHECK (PAY_MTHD_CD IN ('CARD', 'KAKAO', 'NAVER', 'POINT')),
  PAY_AMT       INTEGER NOT NULL CHECK (PAY_AMT >= 0), -- ORD_TOT_AMT + DLVR_TIP_AMT
  PAY_STTS      TEXT    NOT NULL DEFAULT 'READY' CHECK (PAY_STTS IN ('READY', 'APPROVED', 'CANCELED')),
  PAY_REF_NO    TEXT,
  PAY_APRV_DTTM TEXT,
  PAY_CNCL_DTTM TEXT,
  REG_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (PAY_STTS <> 'APPROVED' OR PAY_APRV_DTTM IS NOT NULL),
  CHECK ((PAY_STTS = 'CANCELED') = (PAY_CNCL_DTTM IS NOT NULL))
) STRICT;

-- 16 포인트거래 (금액은 양수, CHARGE/REFUND 증가, USE/EXPIRE 감소)
CREATE TABLE TB_PNT_TXN (
  PNT_TXN_ID      INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID          INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  ORD_ID          INTEGER REFERENCES TB_ORD (ORD_ID),
  PNT_TXN_TYPE_CD TEXT    NOT NULL CHECK (PNT_TXN_TYPE_CD IN ('CHARGE', 'USE', 'REFUND', 'EXPIRE')),
  PNT_TXN_AMT     INTEGER NOT NULL CHECK (PNT_TXN_AMT > 0),
  PNT_BAL_AMT     INTEGER NOT NULL CHECK (PNT_BAL_AMT >= 0), -- 거래 직후 잔액
  CHRG_MTHD_CD    TEXT    CHECK (CHRG_MTHD_CD IN ('CARD', 'KAKAO', 'NAVER')),
  PNT_TXN_STTS    TEXT    NOT NULL DEFAULT 'COMPLETED' CHECK (PNT_TXN_STTS IN ('READY', 'COMPLETED', 'CANCELED')),
  PNT_TXN_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 충전 ⇔ 충전수단, 사용·환불은 주문 연결, 충전·소멸은 주문 없음
  CHECK ((PNT_TXN_TYPE_CD = 'CHARGE') = (CHRG_MTHD_CD IS NOT NULL)),
  CHECK ((PNT_TXN_TYPE_CD IN ('USE', 'REFUND')) = (ORD_ID IS NOT NULL))
) STRICT;
CREATE INDEX IX_PNT_TXN_MBR_DTTM ON TB_PNT_TXN (MBR_ID, PNT_TXN_DTTM);
-- 주문당 사용·환불은 각 1건 (중복 환불 방지)
CREATE UNIQUE INDEX UK_PNT_TXN_ORD_TYPE ON TB_PNT_TXN (ORD_ID, PNT_TXN_TYPE_CD) WHERE ORD_ID IS NOT NULL;

-- 17 배달 (사장 접수 때 생성, RIDER_MBR_ID NULL = 배차 요청. 상태 컬럼 없이 일시로 판단)
CREATE TABLE TB_DLVR (
  DLVR_ID        INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID         INTEGER NOT NULL UNIQUE REFERENCES TB_ORD (ORD_ID),
  RIDER_MBR_ID   INTEGER REFERENCES TB_RIDER (MBR_ID),
  DSPCH_DTTM     TEXT,
  PKUP_DTTM      TEXT,
  DLVR_CMPL_DTTM TEXT,
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 배차 ⇔ 라이더·배차일시, 배차 → 픽업 → 완료 순서
  CHECK ((RIDER_MBR_ID IS NULL) = (DSPCH_DTTM IS NULL)),
  CHECK (PKUP_DTTM IS NULL OR (DSPCH_DTTM IS NOT NULL AND PKUP_DTTM >= DSPCH_DTTM)),
  CHECK (DLVR_CMPL_DTTM IS NULL OR (PKUP_DTTM IS NOT NULL AND DLVR_CMPL_DTTM >= PKUP_DTTM))
) STRICT;
CREATE INDEX IX_DLVR_RIDER_CMPL ON TB_DLVR (RIDER_MBR_ID, DLVR_CMPL_DTTM);
CREATE INDEX IX_DLVR_RIDER_REG ON TB_DLVR (RIDER_MBR_ID, REG_DTTM);

-- 18 리뷰 (주문당 1건. 작성 조건 DONE+3일·제한 여부는 서버 검사)
CREATE TABLE TB_RVW (
  RVW_ID     INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID     INTEGER NOT NULL UNIQUE REFERENCES TB_ORD (ORD_ID),
  RVW_RTNG   INTEGER NOT NULL CHECK (RVW_RTNG BETWEEN 1 AND 5),
  RVW_CN     TEXT,                                     -- 내용 없으면 NULL
  RVW_HDN_YN TEXT    NOT NULL DEFAULT 'N' CHECK (RVW_HDN_YN IN ('Y', 'N')),
  REG_DTTM   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN     TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

-- 19 리뷰답글 (리뷰당 1건. 다시 달 때는 삭제된 행을 되살림)
CREATE TABLE TB_RVW_REPLY (
  RVW_REPLY_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  RVW_ID       INTEGER NOT NULL UNIQUE REFERENCES TB_RVW (RVW_ID),
  OWNR_MBR_ID  INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  RVW_REPLY_CN TEXT    NOT NULL,
  REG_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN       TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

-- 20 리뷰신고 (같은 회원은 같은 리뷰를 한 번만)
CREATE TABLE TB_RVW_RPT (
  RVW_RPT_ID     INTEGER PRIMARY KEY AUTOINCREMENT,
  RVW_ID         INTEGER NOT NULL REFERENCES TB_RVW (RVW_ID),
  RPTR_MBR_ID    INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  RVW_RPT_RSN_CD TEXT    NOT NULL CHECK (RVW_RPT_RSN_CD IN ('ABUSE', 'FALSE', 'UNRELATED', 'ETC')),
  RVW_RPT_CN     TEXT    NOT NULL,
  RVW_RPT_STTS   TEXT    NOT NULL DEFAULT 'PENDING' CHECK (RVW_RPT_STTS IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  PRCSR_MBR_ID   INTEGER REFERENCES TB_MBR (MBR_ID),
  PRCS_DTTM      TEXT,
  PRCS_CN        TEXT,
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (RVW_ID, RPTR_MBR_ID),
  -- 처리 전(PENDING) ⇔ 처리자·처리일시 없음
  CHECK ((RVW_RPT_STTS = 'PENDING') = (PRCSR_MBR_ID IS NULL)),
  CHECK ((RVW_RPT_STTS = 'PENDING') = (PRCS_DTTM IS NULL))
) STRICT;
CREATE INDEX IX_RVW_RPT_STTS_REG ON TB_RVW_RPT (RVW_RPT_STTS, REG_DTTM);

-- 21 회원제한 (종료일시 NULL = 해제 전까지. 활성 제한 중복은 서버 검사)
CREATE TABLE TB_MBR_RSTR (
  MBR_RSTR_ID    INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID         INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  RVW_RPT_ID     INTEGER REFERENCES TB_RVW_RPT (RVW_RPT_ID),
  RSTR_TYPE_CD   TEXT    NOT NULL CHECK (RSTR_TYPE_CD IN ('REVIEW_WRITE')),
  RSTR_STRT_DTTM TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  RSTR_END_DTTM  TEXT,
  RSTR_RSN_CN    TEXT    NOT NULL,
  PRCSR_MBR_ID   INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (RSTR_END_DTTM IS NULL OR RSTR_END_DTTM >= RSTR_STRT_DTTM)
) STRICT;
CREATE INDEX IX_MBR_RSTR_MBR_TYPE ON TB_MBR_RSTR (MBR_ID, RSTR_TYPE_CD);
```

## 다시 만들기

```sh
# 프로젝트 루트에서. server/delivery.db 는 건드리지 않는다 (메모리 DB 사용)
node docs/erd/gen-dbml.mjs [SQL 폴더] > docs/erd/physical.dbml
node docs/erd/gen-conceptual.mjs > docs/erd/conceptual.drawio
node docs/erd/gen-dictionary.mjs [SQL 폴더] > docs/erd/table-definition.md
```

- SQL 폴더 기본값은 `server/db`다.
- `gen-dbml.mjs`는 `server/node_modules`의 `better-sqlite3`를 쓴다. 먼저 `npm run setup:server`가 필요하다(Node 24).
- 실행하면 표준 오류에 개수를 출력한다. 기대값: `{"tables":23,"fks":38,"indexes":24,"partialUnique":5,"checks":92,"views":3,"triggers":19}`
- `gen-dictionary.mjs`는 Node 24 내장 `node:sqlite`를 쓴다. 기대값: `{"tables":23,"columns":217}`
- `schema.sql`이 바뀌면 위 "DDL" 절도 새 내용으로 바꾼다.
