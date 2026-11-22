# 테이블 정의서

물리 데이터 모델의 테이블 23개를 컬럼 단위로 정리한 표다. 설계 규칙, 제약조건 요약, 인덱스, DDL 전문은 `physical.md`에 있다.

- 기준: `server/db/schema.sql`. 이 파일은 `gen-dictionary.mjs`가 만든다. 손으로 고치지 말고 생성기를 다시 실행한다.
- 키: `PK` 기본 키, `FK → 테이블` 외래 키, `UK` UNIQUE(복합이면 함께 묶인 컬럼을 적음)
- NULL: `N` = NOT NULL, `Y` = NULL 허용
- 모든 테이블은 `STRICT`다. 일시 컬럼은 `TEXT 'YYYY-MM-DD HH:MM:SS'`, 금액은 원 단위 `INTEGER`다.

## 1. TB_MBR (회원)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `MBR_ID` | 회원ID | INTEGER | N |  | PK |  |  |
| 2 | `MBR_EMAIL` | 회원이메일 | TEXT | N |  |  |  | 활성 회원 사이에서만 UNIQUE (UK_MBR_EMAIL_ACTIVE) |
| 3 | `MBR_PWD` | 회원비밀번호 | TEXT | Y |  |  |  | 탈퇴 시 NULL |
| 4 | `MBR_NM` | 회원이름 | TEXT | N |  |  |  | 탈퇴 시 '탈퇴회원' |
| 5 | `MBR_TELNO` | 회원전화번호 | TEXT | Y |  |  |  | 탈퇴 시 NULL |
| 6 | `MBR_ROLE_CD` | 회원역할코드 | TEXT | N |  |  | `MBR_ROLE_CD IN ('CUSTOMER', 'OWNER', 'RIDER', 'ADMIN')` |  |
| 7 | `MBR_STTS` | 회원상태 | TEXT | N | 'ACTIVE' |  | `MBR_STTS IN ('ACTIVE', 'WITHDRAWN')` |  |
| 8 | `PNT_BAL_AMT` | 포인트잔액 | INTEGER | N | 0 |  | `PNT_BAL_AMT >= 0` |  |
| 9 | `MBR_LOGIN_DTTM` | 최근로그인일시 | TEXT | Y |  |  |  |  |
| 10 | `MBR_WTHDR_DTTM` | 회원탈퇴일시 | TEXT | Y |  |  |  |  |
| 11 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 12 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 13 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

테이블 CHECK:

- 탈퇴 ⇔ 탈퇴일시, 활성 회원은 비밀번호·전화번호 필수, 탈퇴 회원은 비움
  - `CHECK ((MBR_STTS = 'WITHDRAWN') = (MBR_WTHDR_DTTM IS NOT NULL))`
  - `CHECK (MBR_STTS = 'WITHDRAWN' OR (MBR_PWD IS NOT NULL AND MBR_TELNO IS NOT NULL))`
  - `CHECK (MBR_STTS = 'ACTIVE' OR (MBR_PWD IS NULL AND MBR_TELNO IS NULL))`

인덱스:

- `UK_MBR_EMAIL_ACTIVE ON TB_MBR (MBR_EMAIL) WHERE MBR_STTS = 'ACTIVE'` (조건부 UNIQUE)

## 2. TB_MBR_ADDR (회원주소)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `MBR_ADDR_ID` | 회원주소ID | INTEGER | N |  | PK |  |  |
| 2 | `MBR_ID` | 회원ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 3 | `MBR_ADDR_NM` | 주소별칭 | TEXT | N |  |  |  |  |
| 4 | `MBR_ADDR` | 도로명주소 | TEXT | N |  |  |  |  |
| 5 | `MBR_DADDR` | 상세주소 | TEXT | Y |  |  |  |  |
| 6 | `MBR_ZIP` | 회원우편번호 | TEXT | N |  |  | `MBR_ZIP GLOB '[0-9][0-9][0-9][0-9][0-9]'` |  |
| 7 | `MBR_LAT` | 회원위도 | REAL | N |  |  | `MBR_LAT BETWEEN -90 AND 90` |  |
| 8 | `MBR_LNG` | 회원경도 | REAL | N |  |  | `MBR_LNG BETWEEN -180 AND 180` |  |
| 9 | `DFLT_YN` | 기본여부 | TEXT | N | 'N' |  | `DFLT_YN IN ('Y', 'N')` |  |
| 10 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 11 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 12 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

인덱스:

- `UK_MBR_ADDR_DFLT ON TB_MBR_ADDR (MBR_ID) WHERE DFLT_YN = 'Y' AND DEL_YN = 'N'` (조건부 UNIQUE)
- `IX_MBR_ADDR_MBR ON TB_MBR_ADDR (MBR_ID)`

## 3. TB_RIDER (라이더)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `MBR_ID` | 회원ID | INTEGER | N |  | PK<br>FK → TB_MBR |  |  |
| 2 | `RIDER_STTS` | 라이더상태 | TEXT | N | 'IDLE' |  | `RIDER_STTS IN ('IDLE', 'BUSY')` |  |
| 3 | `VHCL_TYPE_CD` | 운송수단유형코드 | TEXT | N |  |  | `VHCL_TYPE_CD IN ('WALK', 'BICYCLE', 'MOTORCYCLE', 'CAR')` |  |
| 4 | `ACT_RADIUS_M` | 활동반경(m) | INTEGER | N | 3000 |  | `ACT_RADIUS_M BETWEEN 500 AND 5000` |  |
| 5 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 6 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

## 4. TB_STORE (가게)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `STORE_ID` | 가게ID | INTEGER | N |  | PK |  |  |
| 2 | `OWNR_MBR_ID` | 사장회원ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 3 | `STORE_NM` | 가게명 | TEXT | N |  |  |  |  |
| 4 | `STORE_CTGR_CD` | 가게분류코드 | TEXT | N |  |  | `STORE_CTGR_CD IN ('CHICKEN', 'PIZZA', 'KOREAN', 'CHINESE', 'JAPANESE', 'SNACK', 'CAFE', 'ETC')` |  |
| 5 | `BIZ_NO` | 사업자등록번호 | TEXT | N |  | UK | `BIZ_NO GLOB '[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'` |  |
| 6 | `STORE_TELNO` | 가게전화번호 | TEXT | N |  |  |  |  |
| 7 | `STORE_ADDR` | 가게도로명주소 | TEXT | N |  |  |  |  |
| 8 | `STORE_DADDR` | 가게상세주소 | TEXT | Y |  |  |  |  |
| 9 | `STORE_LAT` | 가게위도 | REAL | N |  |  | `STORE_LAT BETWEEN -90 AND 90` |  |
| 10 | `STORE_LNG` | 가게경도 | REAL | N |  |  | `STORE_LNG BETWEEN -180 AND 180` |  |
| 11 | `STORE_CN` | 가게소개 | TEXT | Y |  |  |  | 가게 소개 |
| 12 | `MIN_ORD_AMT` | 최소주문금액 | INTEGER | N |  |  | `MIN_ORD_AMT >= 0` |  |
| 13 | `DLVR_TIP_AMT` | 배달팁금액 | INTEGER | N |  |  | `DLVR_TIP_AMT >= 0` |  |
| 14 | `COOK_EST_MI` | 조리예상시간(분) | INTEGER | N |  |  | `COOK_EST_MI > 0` | 기본 조리시간(분). 11/08 DLVR_EST_MI 대체 |
| 15 | `STORE_OPER_STTS` | 가게운영상태 | TEXT | N | 'PAUSED' |  | `STORE_OPER_STTS IN ('OPEN', 'PAUSED')` | CLOSED는 조회 때 계산 |
| 16 | `STORE_APRV_STTS` | 가게승인상태 | TEXT | N | 'PENDING' |  | `STORE_APRV_STTS IN ('PENDING', 'APPROVED', 'REJECTED')` | TB_STORE_APRV와 같은 트랜잭션에서 갱신 |
| 17 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 18 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 19 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

인덱스:

- `IX_STORE_OWNR ON TB_STORE (OWNR_MBR_ID)`

## 5. TB_STORE_HOURS (가게영업시간)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `STORE_HOURS_ID` | 가게영업시간ID | INTEGER | N |  | PK |  |  |
| 2 | `STORE_ID` | 가게ID | INTEGER | N |  | FK → TB_STORE |  |  |
| 3 | `DAY_OF_WEEK` | 요일 | INTEGER | N |  |  | `DAY_OF_WEEK BETWEEN 0 AND 6` | 0(일)~6(토) |
| 4 | `OPEN_TM` | 시작시각 | TEXT | N |  |  | `OPEN_TM GLOB '[0-2][0-9]:[0-5][0-9]' AND OPEN_TM < '24:00'` |  |
| 5 | `CLOSE_TM` | 종료시각 | TEXT | N |  |  | `CLOSE_TM GLOB '[0-2][0-9]:[0-5][0-9]' AND CLOSE_TM <= '24:00'` | 자정은 24:00 |
| 6 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 7 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- `CHECK (OPEN_TM < CLOSE_TM)`

인덱스:

- `IX_STORE_HOURS_STORE_DAY ON TB_STORE_HOURS (STORE_ID, DAY_OF_WEEK)`

## 6. TB_STORE_APRV (입점신청)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `STORE_APRV_ID` | 가게승인ID | INTEGER | N |  | PK |  |  |
| 2 | `STORE_ID` | 가게ID | INTEGER | N |  | FK → TB_STORE |  |  |
| 3 | `STORE_APRV_STTS` | 가게승인상태 | TEXT | N | 'PENDING' |  | `STORE_APRV_STTS IN ('PENDING', 'APPROVED', 'REJECTED')` |  |
| 4 | `APLY_DTTM` | 신청일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 5 | `PRCSR_MBR_ID` | 처리관리자ID | INTEGER | Y |  | FK → TB_MBR |  |  |
| 6 | `PRCS_DTTM` | 처리일시 | TEXT | Y |  |  |  |  |
| 7 | `RJCT_RSN_CN` | 반려사유 | TEXT | Y |  |  |  |  |
| 8 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 9 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- 처리 전(PENDING) ⇔ 처리자·처리일시 없음, 반려 ⇔ 반려 사유
  - `CHECK ((STORE_APRV_STTS = 'PENDING') = (PRCSR_MBR_ID IS NULL))`
  - `CHECK ((STORE_APRV_STTS = 'PENDING') = (PRCS_DTTM IS NULL))`
  - `CHECK ((STORE_APRV_STTS = 'REJECTED') = (RJCT_RSN_CN IS NOT NULL))`

인덱스:

- `UK_STORE_APRV_PENDING ON TB_STORE_APRV (STORE_ID) WHERE STORE_APRV_STTS = 'PENDING'` (조건부 UNIQUE)

## 7. TB_MENU_CTGR (메뉴분류)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `CTGR_ID` | 분류ID | INTEGER | N |  | PK |  |  |
| 2 | `STORE_ID` | 가게ID | INTEGER | N |  | FK → TB_STORE |  |  |
| 3 | `CTGR_NM` | 분류명 | TEXT | N |  |  |  |  |
| 4 | `CTGR_SEQ` | 분류순서 | INTEGER | N |  |  |  |  |
| 5 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 6 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 7 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

인덱스:

- `UK_MENU_CTGR_STORE_NM ON TB_MENU_CTGR (STORE_ID, CTGR_NM) WHERE DEL_YN = 'N'` (조건부 UNIQUE)
- `IX_MENU_CTGR_STORE_SEQ ON TB_MENU_CTGR (STORE_ID, CTGR_SEQ)`

## 8. TB_MENU (메뉴)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `MENU_ID` | 메뉴ID | INTEGER | N |  | PK |  |  |
| 2 | `STORE_ID` | 가게ID | INTEGER | N |  | FK → TB_STORE |  |  |
| 3 | `CTGR_ID` | 분류ID | INTEGER | N |  | FK → TB_MENU_CTGR |  |  |
| 4 | `MENU_NM` | 메뉴명 | TEXT | N |  |  |  |  |
| 5 | `MENU_AMT` | 메뉴금액 | INTEGER | N |  |  | `MENU_AMT >= 0` |  |
| 6 | `MENU_CN` | 메뉴설명 | TEXT | Y |  |  |  |  |
| 7 | `MENU_SEQ` | 메뉴순서 | INTEGER | N |  |  |  |  |
| 8 | `MENU_SALE_STTS` | 메뉴판매상태 | TEXT | N | 'ON_SALE' |  | `MENU_SALE_STTS IN ('ON_SALE', 'SOLD_OUT')` |  |
| 9 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 10 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 11 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

인덱스:

- `IX_MENU_CTGR_SEQ ON TB_MENU (CTGR_ID, MENU_SEQ)`
- `IX_MENU_STORE ON TB_MENU (STORE_ID)`

## 9. TB_MENU_OPT_GRP (메뉴옵션그룹)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `OPT_GRP_ID` | 옵션그룹ID | INTEGER | N |  | PK |  |  |
| 2 | `MENU_ID` | 메뉴ID | INTEGER | N |  | FK → TB_MENU |  |  |
| 3 | `OPT_GRP_NM` | 옵션그룹명 | TEXT | N |  |  |  |  |
| 4 | `RQRD_YN` | 필수여부 | TEXT | N | 'N' |  | `RQRD_YN IN ('Y', 'N')` |  |
| 5 | `MAX_SLCT_CNT` | 최대선택수 | INTEGER | N | 1 |  | `MAX_SLCT_CNT >= 1` |  |
| 6 | `OPT_GRP_SEQ` | 옵션그룹순서 | INTEGER | N |  |  |  |  |
| 7 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 8 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 9 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

인덱스:

- `IX_OPT_GRP_MENU_SEQ ON TB_MENU_OPT_GRP (MENU_ID, OPT_GRP_SEQ)`

## 10. TB_MENU_OPT (메뉴옵션)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `OPT_ID` | 옵션ID | INTEGER | N |  | PK |  |  |
| 2 | `OPT_GRP_ID` | 옵션그룹ID | INTEGER | N |  | FK → TB_MENU_OPT_GRP |  |  |
| 3 | `OPT_NM` | 옵션명 | TEXT | N |  |  |  |  |
| 4 | `OPT_AMT` | 옵션금액 | INTEGER | N | 0 |  | `OPT_AMT >= 0` |  |
| 5 | `OPT_SEQ` | 옵션순서 | INTEGER | N |  |  |  |  |
| 6 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 7 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 8 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

인덱스:

- `IX_OPT_GRP_OPT_SEQ ON TB_MENU_OPT (OPT_GRP_ID, OPT_SEQ)`

## 11. TB_CART (장바구니)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `CART_ID` | 장바구니ID | INTEGER | N |  | PK |  |  |
| 2 | `MBR_ID` | 회원ID | INTEGER | N |  | FK → TB_MBR<br>UK |  |  |
| 3 | `STORE_ID` | 가게ID | INTEGER | N |  | FK → TB_STORE |  |  |
| 4 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 5 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

## 12. TB_CART_DTL (장바구니항목)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `CART_DTL_ID` | 장바구니상세ID | INTEGER | N |  | PK |  |  |
| 2 | `CART_ID` | 장바구니ID | INTEGER | N |  | FK → TB_CART (CASCADE) |  |  |
| 3 | `MENU_ID` | 메뉴ID | INTEGER | N |  | FK → TB_MENU |  |  |
| 4 | `CART_QTY` | 장바구니수량 | INTEGER | N | 1 |  | `CART_QTY >= 1` |  |
| 5 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 6 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

인덱스:

- `IX_CART_DTL_CART ON TB_CART_DTL (CART_ID)`

## 13. TB_CART_DTL_OPT (장바구니항목옵션)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `CART_DTL_OPT_ID` | 장바구니상세옵션ID | INTEGER | N |  | PK |  |  |
| 2 | `CART_DTL_ID` | 장바구니상세ID | INTEGER | N |  | FK → TB_CART_DTL (CASCADE)<br>UK (CART_DTL_ID, OPT_ID) |  |  |
| 3 | `OPT_ID` | 옵션ID | INTEGER | N |  | FK → TB_MENU_OPT<br>UK (CART_DTL_ID, OPT_ID) |  |  |
| 4 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

## 14. TB_ORD (주문)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `ORD_ID` | 주문ID | INTEGER | N |  | PK |  |  |
| 2 | `MBR_ID` | 회원ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 3 | `STORE_ID` | 가게ID | INTEGER | N |  | FK → TB_STORE |  |  |
| 4 | `ORD_DTTM` | 주문일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 5 | `ORD_STTS` | 주문상태 | TEXT | N | 'WAIT' |  | `ORD_STTS IN ('WAIT', 'COOKING', 'READY', 'DELIVERING', 'DONE', 'CANCEL')` | READY = 조리완료·픽업대기 (배차대기 아님) |
| 6 | `ORD_TOT_AMT` | 주문합계금액 | INTEGER | N |  |  | `ORD_TOT_AMT >= 0` | 메뉴·옵션 합계 (배달팁 제외) |
| 7 | `DLVR_TIP_AMT` | 배달팁금액 | INTEGER | N |  |  | `DLVR_TIP_AMT >= 0` | 주문 시점 배달팁 |
| 8 | `STORE_RQST_CN` | 가게요청사항 | TEXT | Y |  |  |  |  |
| 9 | `RIDER_RQST_CN` | 라이더요청사항 | TEXT | Y |  |  |  |  |
| 10 | `CUTLERY_YN` | 수저포크요청여부 | TEXT | N | 'N' |  | `CUTLERY_YN IN ('Y', 'N')` |  |
| 11 | `DLVR_ADDR` | 배달도로명주소 | TEXT | N |  |  |  |  |
| 12 | `DLVR_DADDR` | 배달상세주소 | TEXT | Y |  |  |  |  |
| 13 | `DLVR_LAT` | 배달위도 | REAL | N |  |  | `DLVR_LAT BETWEEN -90 AND 90` |  |
| 14 | `DLVR_LNG` | 배달경도 | REAL | N |  |  | `DLVR_LNG BETWEEN -180 AND 180` |  |
| 15 | `ORD_RCPT_DTTM` | 주문접수일시 | TEXT | Y |  |  |  |  |
| 16 | `COOK_EST_MI` | 조리예상시간(분) | INTEGER | Y |  |  | `COOK_EST_MI > 0` | 이 주문의 조리 예상분 |
| 17 | `ORD_CNCL_DTTM` | 주문취소일시 | TEXT | Y |  |  |  |  |
| 18 | `CNCL_ACTR_CD` | 취소주체코드 | TEXT | Y |  |  | `CNCL_ACTR_CD IN ('CUSTOMER', 'OWNER', 'SYSTEM', 'ADMIN')` |  |
| 19 | `CNCL_RSN_CD` | 취소사유코드 | TEXT | Y |  |  | `CNCL_RSN_CD IN ('OUT_OF_STOCK', 'BUSY', 'CLOSING', 'CANNOT_COOK', 'NO_RESPONSE', 'CUSTOMER_REQUEST', 'STORE_ISSUE', 'DELIVERY_FAIL', 'ETC')` |  |
| 20 | `ORD_CNCL_RSN_CN` | 취소사유상세 | TEXT | Y |  |  |  | 사유 상세 (ETC일 때 필수) |
| 21 | `CNCL_PRCSR_MBR_ID` | 취소처리관리자ID | INTEGER | Y |  | FK → TB_MBR |  | 고객센터 취소 처리 관리자 |
| 22 | `CNSL_MEMO_CN` | 상담메모 | TEXT | Y |  |  |  | 고객센터 상담 메모 |
| 23 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 24 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- 접수일시와 조리예상분은 함께 기록. 접수 이후 상태는 둘 다 필수, WAIT는 둘 다 없음 (CANCEL은 접수 전후 모두 가능)
  - `CHECK ((ORD_RCPT_DTTM IS NULL) = (COOK_EST_MI IS NULL))`
  - `CHECK (ORD_STTS NOT IN ('COOKING', 'READY', 'DELIVERING', 'DONE') OR ORD_RCPT_DTTM IS NOT NULL)`
  - `CHECK (ORD_STTS <> 'WAIT' OR ORD_RCPT_DTTM IS NULL)`
- 취소 상태 ⇔ 취소일시·취소주체
  - `CHECK ((ORD_STTS = 'CANCEL') = (ORD_CNCL_DTTM IS NOT NULL))`
  - `CHECK ((ORD_STTS = 'CANCEL') = (CNCL_ACTR_CD IS NOT NULL))`
- 취소 주문 ⇔ 취소 사유 코드. 고객 직접 취소는 CUSTOMER_REQUEST, 자동 취소는 NO_RESPONSE. ETC면 상세 필수
  - `CHECK ((ORD_STTS = 'CANCEL') = (CNCL_RSN_CD IS NOT NULL))`
  - `CHECK (ORD_STTS = 'CANCEL' OR ORD_CNCL_RSN_CN IS NULL)`
  - `CHECK (CNCL_ACTR_CD IS NOT 'CUSTOMER' OR CNCL_RSN_CD = 'CUSTOMER_REQUEST')`
  - `CHECK (CNCL_ACTR_CD IS NOT 'SYSTEM' OR CNCL_RSN_CD = 'NO_RESPONSE')`
  - `CHECK (CNCL_RSN_CD IS NOT 'ETC' OR ORD_CNCL_RSN_CN IS NOT NULL)`
- 관리자(고객센터) 취소 ⇔ 처리 관리자·상담 메모
  - `CHECK ((CNCL_ACTR_CD IS 'ADMIN') = (CNCL_PRCSR_MBR_ID IS NOT NULL))`
  - `CHECK ((CNCL_ACTR_CD IS 'ADMIN') = (CNSL_MEMO_CN IS NOT NULL))`

인덱스:

- `IX_ORD_STTS_DTTM ON TB_ORD (ORD_STTS, ORD_DTTM)`
- `IX_ORD_STORE_DTTM ON TB_ORD (STORE_ID, ORD_DTTM)`
- `IX_ORD_MBR_DTTM ON TB_ORD (MBR_ID, ORD_DTTM)`

## 15. TB_ORD_DTL (주문상세)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `ORD_DTL_ID` | 주문상세ID | INTEGER | N |  | PK |  |  |
| 2 | `ORD_ID` | 주문ID | INTEGER | N |  | FK → TB_ORD<br>UK (ORD_ID, ORD_DTL_SEQ) |  |  |
| 3 | `ORD_DTL_SEQ` | 주문상세순서 | INTEGER | N |  | UK (ORD_ID, ORD_DTL_SEQ) |  |  |
| 4 | `MENU_ID` | 메뉴ID | INTEGER | N |  | FK → TB_MENU |  |  |
| 5 | `ORD_MENU_NM` | 주문당시메뉴명 | TEXT | N |  |  |  |  |
| 6 | `ORD_QTY` | 주문수량 | INTEGER | N |  |  | `ORD_QTY >= 1` |  |
| 7 | `ORD_UPRC` | 주문단가 | INTEGER | N |  |  | `ORD_UPRC >= 0` | 옵션 제외 단가 |
| 8 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

인덱스:

- `IX_ORD_DTL_MENU ON TB_ORD_DTL (MENU_ID)`

## 16. TB_ORD_DTL_OPT (주문상세옵션)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `ORD_DTL_OPT_ID` | 주문상세옵션ID | INTEGER | N |  | PK |  |  |
| 2 | `ORD_DTL_ID` | 주문상세ID | INTEGER | N |  | FK → TB_ORD_DTL |  |  |
| 3 | `OPT_ID` | 옵션ID | INTEGER | N |  | FK → TB_MENU_OPT |  |  |
| 4 | `ORD_OPT_GRP_NM` | 주문당시옵션그룹명 | TEXT | N |  |  |  |  |
| 5 | `ORD_OPT_NM` | 주문당시옵션명 | TEXT | N |  |  |  |  |
| 6 | `ORD_OPT_AMT` | 주문당시옵션금액 | INTEGER | N |  |  | `ORD_OPT_AMT >= 0` |  |
| 7 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

인덱스:

- `IX_ORD_DTL_OPT_DTL ON TB_ORD_DTL_OPT (ORD_DTL_ID)`

## 17. TB_PAY (결제)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `PAY_ID` | 결제ID | INTEGER | N |  | PK |  |  |
| 2 | `ORD_ID` | 주문ID | INTEGER | N |  | FK → TB_ORD<br>UK |  |  |
| 3 | `PAY_MTHD_CD` | 결제수단코드 | TEXT | N |  |  | `PAY_MTHD_CD IN ('CARD', 'KAKAO', 'NAVER', 'POINT')` |  |
| 4 | `PAY_AMT` | 결제금액 | INTEGER | N |  |  | `PAY_AMT >= 0` | ORD_TOT_AMT + DLVR_TIP_AMT |
| 5 | `PAY_STTS` | 결제상태 | TEXT | N | 'READY' |  | `PAY_STTS IN ('READY', 'APPROVED', 'CANCELED')` |  |
| 6 | `PAY_REF_NO` | 결제참조번호 | TEXT | Y |  |  |  |  |
| 7 | `PAY_APRV_DTTM` | 결제승인일시 | TEXT | Y |  |  |  |  |
| 8 | `PAY_CNCL_DTTM` | 결제취소일시 | TEXT | Y |  |  |  |  |
| 9 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 10 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- `CHECK (PAY_STTS <> 'APPROVED' OR PAY_APRV_DTTM IS NOT NULL)`
- `CHECK ((PAY_STTS = 'CANCELED') = (PAY_CNCL_DTTM IS NOT NULL))`

## 18. TB_PNT_TXN (포인트거래)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `PNT_TXN_ID` | 포인트거래ID | INTEGER | N |  | PK |  |  |
| 2 | `MBR_ID` | 회원ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 3 | `ORD_ID` | 주문ID | INTEGER | Y |  | FK → TB_ORD |  |  |
| 4 | `PNT_TXN_TYPE_CD` | 포인트거래유형코드 | TEXT | N |  |  | `PNT_TXN_TYPE_CD IN ('CHARGE', 'USE', 'REFUND', 'EXPIRE')` |  |
| 5 | `PNT_TXN_AMT` | 포인트거래금액 | INTEGER | N |  |  | `PNT_TXN_AMT > 0` |  |
| 6 | `PNT_BAL_AMT` | 포인트잔액 | INTEGER | N |  |  | `PNT_BAL_AMT >= 0` | 거래 직후 잔액 |
| 7 | `CHRG_MTHD_CD` | 충전수단코드 | TEXT | Y |  |  | `CHRG_MTHD_CD IN ('CARD', 'KAKAO', 'NAVER')` |  |
| 8 | `PNT_TXN_STTS` | 포인트거래상태 | TEXT | N | 'COMPLETED' |  | `PNT_TXN_STTS IN ('READY', 'COMPLETED', 'CANCELED')` |  |
| 9 | `PNT_TXN_DTTM` | 포인트거래일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 10 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- 충전 ⇔ 충전수단, 사용·환불은 주문 연결, 충전·소멸은 주문 없음
  - `CHECK ((PNT_TXN_TYPE_CD = 'CHARGE') = (CHRG_MTHD_CD IS NOT NULL))`
  - `CHECK ((PNT_TXN_TYPE_CD IN ('USE', 'REFUND')) = (ORD_ID IS NOT NULL))`

인덱스:

- `UK_PNT_TXN_ORD_TYPE ON TB_PNT_TXN (ORD_ID, PNT_TXN_TYPE_CD) WHERE ORD_ID IS NOT NULL` (조건부 UNIQUE)
- `IX_PNT_TXN_MBR_DTTM ON TB_PNT_TXN (MBR_ID, PNT_TXN_DTTM)`

## 19. TB_DLVR (배달)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `DLVR_ID` | 배달ID | INTEGER | N |  | PK |  |  |
| 2 | `ORD_ID` | 주문ID | INTEGER | N |  | FK → TB_ORD<br>UK |  |  |
| 3 | `RIDER_MBR_ID` | 라이더회원ID | INTEGER | Y |  | FK → TB_RIDER |  |  |
| 4 | `DSPCH_DTTM` | 배차일시 | TEXT | Y |  |  |  |  |
| 5 | `PKUP_DTTM` | 픽업일시 | TEXT | Y |  |  |  |  |
| 6 | `DLVR_CMPL_DTTM` | 배달완료일시 | TEXT | Y |  |  |  |  |
| 7 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 8 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- 배차 ⇔ 라이더·배차일시, 배차 → 픽업 → 완료 순서
  - `CHECK ((RIDER_MBR_ID IS NULL) = (DSPCH_DTTM IS NULL))`
  - `CHECK (PKUP_DTTM IS NULL OR (DSPCH_DTTM IS NOT NULL AND PKUP_DTTM >= DSPCH_DTTM))`
  - `CHECK (DLVR_CMPL_DTTM IS NULL OR (PKUP_DTTM IS NOT NULL AND DLVR_CMPL_DTTM >= PKUP_DTTM))`

인덱스:

- `IX_DLVR_RIDER_REG ON TB_DLVR (RIDER_MBR_ID, REG_DTTM)`
- `IX_DLVR_RIDER_CMPL ON TB_DLVR (RIDER_MBR_ID, DLVR_CMPL_DTTM)`

## 20. TB_RVW (리뷰)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `RVW_ID` | 리뷰ID | INTEGER | N |  | PK |  |  |
| 2 | `ORD_ID` | 주문ID | INTEGER | N |  | FK → TB_ORD<br>UK |  |  |
| 3 | `RVW_RTNG` | 리뷰평점 | INTEGER | N |  |  | `RVW_RTNG BETWEEN 1 AND 5` |  |
| 4 | `RVW_CN` | 리뷰내용 | TEXT | Y |  |  |  | 내용 없으면 NULL |
| 5 | `RVW_HDN_YN` | 숨김여부 | TEXT | N | 'N' |  | `RVW_HDN_YN IN ('Y', 'N')` |  |
| 6 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 7 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 8 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

## 21. TB_RVW_REPLY (리뷰답글)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `RVW_REPLY_ID` | 리뷰답글ID | INTEGER | N |  | PK |  |  |
| 2 | `RVW_ID` | 리뷰ID | INTEGER | N |  | FK → TB_RVW<br>UK |  |  |
| 3 | `OWNR_MBR_ID` | 사장회원ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 4 | `RVW_REPLY_CN` | 답글내용 | TEXT | N |  |  |  |  |
| 5 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 6 | `MOD_DTTM` | 수정일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 7 | `DEL_YN` | 삭제여부 | TEXT | N | 'N' |  | `DEL_YN IN ('Y', 'N')` |  |

## 22. TB_RVW_RPT (리뷰신고)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `RVW_RPT_ID` | 리뷰신고ID | INTEGER | N |  | PK |  |  |
| 2 | `RVW_ID` | 리뷰ID | INTEGER | N |  | FK → TB_RVW<br>UK (RVW_ID, RPTR_MBR_ID) |  |  |
| 3 | `RPTR_MBR_ID` | 신고자회원ID | INTEGER | N |  | FK → TB_MBR<br>UK (RVW_ID, RPTR_MBR_ID) |  |  |
| 4 | `RVW_RPT_RSN_CD` | 리뷰신고사유코드 | TEXT | N |  |  | `RVW_RPT_RSN_CD IN ('ABUSE', 'FALSE', 'UNRELATED', 'ETC')` |  |
| 5 | `RVW_RPT_CN` | 신고내용 | TEXT | N |  |  |  |  |
| 6 | `RVW_RPT_STTS` | 리뷰신고상태 | TEXT | N | 'PENDING' |  | `RVW_RPT_STTS IN ('PENDING', 'ACCEPTED', 'REJECTED')` |  |
| 7 | `PRCSR_MBR_ID` | 처리관리자ID | INTEGER | Y |  | FK → TB_MBR |  |  |
| 8 | `PRCS_DTTM` | 처리일시 | TEXT | Y |  |  |  |  |
| 9 | `PRCS_CN` | 처리내용 | TEXT | Y |  |  |  |  |
| 10 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- 처리 전(PENDING) ⇔ 처리자·처리일시 없음
  - `CHECK ((RVW_RPT_STTS = 'PENDING') = (PRCSR_MBR_ID IS NULL))`
  - `CHECK ((RVW_RPT_STTS = 'PENDING') = (PRCS_DTTM IS NULL))`

인덱스:

- `IX_RVW_RPT_STTS_REG ON TB_RVW_RPT (RVW_RPT_STTS, REG_DTTM)`

## 23. TB_MBR_RSTR (회원제한)

| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |
|---|---|---|---|---|---|---|---|---|
| 1 | `MBR_RSTR_ID` | 회원제한ID | INTEGER | N |  | PK |  |  |
| 2 | `MBR_ID` | 회원ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 3 | `RVW_RPT_ID` | 리뷰신고ID | INTEGER | Y |  | FK → TB_RVW_RPT |  |  |
| 4 | `RSTR_TYPE_CD` | 제한유형코드 | TEXT | N |  |  | `RSTR_TYPE_CD IN ('REVIEW_WRITE')` |  |
| 5 | `RSTR_STRT_DTTM` | 제한시작일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |
| 6 | `RSTR_END_DTTM` | 제한종료일시 | TEXT | Y |  |  |  |  |
| 7 | `RSTR_RSN_CN` | 제한사유 | TEXT | N |  |  |  |  |
| 8 | `PRCSR_MBR_ID` | 처리관리자ID | INTEGER | N |  | FK → TB_MBR |  |  |
| 9 | `REG_DTTM` | 등록일시 | TEXT | N | datetime('now', 'localtime') |  |  |  |

테이블 CHECK:

- `CHECK (RSTR_END_DTTM IS NULL OR RSTR_END_DTTM >= RSTR_STRT_DTTM)`

인덱스:

- `IX_MBR_RSTR_MBR_TYPE ON TB_MBR_RSTR (MBR_ID, RSTR_TYPE_CD)`
