# 배달 주문 플랫폼 API

고객·사장·라이더·관리자 API를 한 문서로 모았다. 원본은 고객·사장/관리자·라이더 명세서 3개다. 테이블·컬럼 이름은 `db/schema.sql`, `db/views.sql`, `db/triggers.sql`을 따른다.

| 문서 | 범위 |
|---|---|
| [auth.md](auth.md) | A-01~A-07 로그인·가입·탈퇴 (모든 역할 공통) |
| [customer.md](customer.md) | C-01~C-26 고객 |
| [owner.md](owner.md) | S·M·O·R·T 사장 (가게·메뉴·주문·리뷰·매출) |
| [admin.md](admin.md) | X-00~X-14 관리자 |
| [rider.md](rider.md) | D-01~D-09 라이더 |

## 공통 규칙

### 인증·세션
- 로그인(A-01)하면 서버가 HMAC 서명 쿠키를 발급한다(Node `crypto`). 쿠키 이름·수명은 [auth.md](auth.md)에 있다.
- 서버는 요청마다 쿠키 서명을 검증하고 `TB_MBR`을 다시 읽는다. `TB_MBR.MBR_STTS`가 `ACTIVE`가 아니면 401, `TB_MBR.MBR_ROLE_CD`가 경로의 역할과 다르면 403이다.
- 경로별 역할: `/api/customer/*` CUSTOMER, `/api/owner/*` OWNER, `/api/rider/*` RIDER, `/api/admin/*` ADMIN. `/api/auth/*`는 API마다 다르다.
- 사장 경로의 `{storeId}`는 로그인한 사장의 삭제되지 않은 가게여야 한다. 아니면 403.
- 리뷰 작성 제재는 `TB_MBR_RSTR`로 확인한다. 제재 중이어도 리뷰 작성 외 기능은 그대로 쓴다.

### 요청·응답 형식
- 요청 본문은 JSON이다.
- 성공: `{ "success": true, "data": ... }`
- 실패: `{ "success": false, "error": { "code": "...", "message": "...", "fields": { "필드": "사유" } } }` — `fields`는 입력값 오류(400)일 때만 있다. 화면은 `message`를 보여 주고 분기는 `code`로 한다.
- 페이지가 있는 목록: 쿼리 `page`(1부터, 기본 1), `size`(기본 20, 최대 100). 응답 `data = { "items": [...], "page": 1, "size": 20, "totalCount": 57 }`. 페이지가 없는 목록은 `data`가 배열이다.
- 일시 `YYYY-MM-DD HH:mm:ss`(한국 시간), 날짜 `YYYY-MM-DD`, 시각 `HH:mm`, 금액 원 단위 정수, 거리 m 단위 정수.

### HTTP 상태와 공통 오류
| HTTP | 뜻 |
|---|---|
| 200 | 조회·수정·삭제 성공 |
| 201 | 생성 성공 |
| 400 | 입력값 오류 |
| 401 | 로그인 필요 |
| 403 | 권한 없음 |
| 404 | 대상 없음 |
| 409 | 상태 충돌 (이미 처리됨, 중복 등) |

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수 값 없음, 형식·범위 오류. `error.fields`에 필드별 사유 |
| 401 | UNAUTHORIZED | 쿠키 없음, 서명 오류, 만료, 탈퇴 회원 |
| 403 | FORBIDDEN | 역할이 다름, 내 가게·내 주문·내 배달이 아님 |
| 404 | NOT_FOUND | 대상이 없거나 논리 삭제됨 |
| 409 | ORDER_ALREADY_PROCESSED | 주문 상태가 이미 바뀜(동시 처리, 10분 만료 포함) |

API별 오류는 각 문서의 오류 표에 있다.

### 주문 상태 전이
| 현재 | 다음 | 누가 | API |
|---|---|---|---|
| WAIT | COOKING | 사장 접수 | O-03 |
| WAIT | CANCEL | 사장 거절 / 고객 / 시스템(10분) / 관리자 | O-04 / C-22 / 자동 취소 / X-13 |
| COOKING | READY | 사장 조리 완료 | O-05 |
| COOKING | CANCEL | 사장 / 관리자 | O-06 / X-13 |
| READY | DELIVERING | 배차된 라이더 픽업 | D-07 |
| READY, DELIVERING | CANCEL | 관리자 | X-13 |
| DELIVERING | DONE | 배차된 라이더 배달 완료 | D-08 |

- 표에 없는 변경은 모두 409 ORDER_ALREADY_PROCESSED다. 상태 변경은 조건부 UPDATE(`WHERE ORD_STTS = <현재 상태>`)로 하고, 바뀐 행이 0이면 409다.
- 사장이 접수(O-03)할 때 `TB_DLVR` 행을 라이더 없이(`TB_DLVR.RIDER_MBR_ID` NULL) 만든다. 이 행이 배차 요청이다.
- 라이더는 COOKING·READY 주문에 배차를 수락(D-05)할 수 있다. 배차는 주문 상태를 바꾸지 않는다.
- `TB_DLVR`에는 상태 컬럼이 없다. 배차·픽업·완료는 `TB_DLVR.DSPCH_DTTM`, `TB_DLVR.PKUP_DTTM`, `TB_DLVR.DLVR_CMPL_DTTM`으로 판단한다.
- READY는 "조리 완료·픽업 대기"다(배차 대기가 아니다).

### 취소·환불
- 주문당 결제는 1건이다(`TB_PAY.ORD_ID` UNIQUE).
- 취소 API는 `TB_ORD.ORD_STTS`를 `CANCEL`로 UPDATE하면서 `TB_ORD.ORD_CNCL_DTTM`, `TB_ORD.CNCL_ACTR_CD`, `TB_ORD.CNCL_RSN_CD`(와 필요한 경우 `TB_ORD.ORD_CNCL_RSN_CN`, `TB_ORD.CNCL_PRCSR_MBR_ID`, `TB_ORD.CNSL_MEMO_CN`)를 함께 기록한다.
- 그 UPDATE가 트리거 `TRG_ORD_CANCEL`을 실행한다. 트리거가 같은 트랜잭션에서 다음을 한다. API는 이 일을 다시 하지 않는다.
  - 결제: `TB_PAY.PAY_STTS` = `CANCELED`, `TB_PAY.PAY_CNCL_DTTM` = 현재 시각 (결제수단과 관계없이)
  - POINT 결제(승인됨)만: `TB_MBR.PNT_BAL_AMT`를 결제금액만큼 늘리고 `TB_PNT_TXN`에 `REFUND` 거래(주문 연결, 거래 후 잔액)를 기록한다. 그 밖의 결제는 결제 상태만 CANCELED가 된다.
  - 배차된 라이더가 있고 배달이 끝나지 않았으면 `TB_RIDER.RIDER_STTS` = `IDLE`
- 취소 주체·사유 규칙(스키마 CHECK):

| 취소 주체 `TB_ORD.CNCL_ACTR_CD` | 취소 사유 `TB_ORD.CNCL_RSN_CD` | 추가로 필요한 값 |
|---|---|---|
| CUSTOMER (C-22) | CUSTOMER_REQUEST만 | - |
| OWNER (O-04 거절, O-06 조리 중 취소) | 사유 코드 중 하나 | ETC면 `TB_ORD.ORD_CNCL_RSN_CN` |
| SYSTEM (10분 자동 취소) | NO_RESPONSE만 | - |
| ADMIN (X-13) | 사유 코드 중 하나 | `TB_ORD.CNCL_PRCSR_MBR_ID`, `TB_ORD.CNSL_MEMO_CN`, ETC면 `TB_ORD.ORD_CNCL_RSN_CN` |

### 10분 미접수 자동 취소
- 예약 작업이 아니다.
- 주문을 조회하는 API(C-20, C-21, O-01, O-02, X-11, X-12 등)는 조회 전에 만료된 주문을 한 번의 UPDATE로 취소한다: `ORD_STTS = 'WAIT'`이고 `TB_ORD.ORD_DTTM`에서 10분이 지난 주문을 `CANCEL`, `CNCL_ACTR_CD = 'SYSTEM'`, `CNCL_RSN_CD = 'NO_RESPONSE'`로 바꾼다. `TRG_ORD_CANCEL`이 주문마다 실행되므로 여러 건이어도 건마다 환불된다.
- 접수(O-03)·거절(O-04)·고객 취소(C-22)는 같은 트랜잭션 안에서 만료 여부를 먼저 확인한다. 만료면 자동 취소로 바꾸고 409 ORDER_ALREADY_PROCESSED를 돌려준다.
- 이 처리는 서버 코드 한 곳(`lib/server/orders.js`)에 둔다.

### 수정일시와 트리거
- 모든 UPDATE의 `MOD_DTTM`은 트리거 `TRG_<테이블>_MOD_DTTM`이 기록한다. API는 `MOD_DTTM`을 직접 넣지 않는다.
- 라이더 BUSY 전환(D-05), 배달 완료 시 IDLE(D-08), 입점 승인 상태 동기화(A-05, X-03, X-04)는 트리거가 아니라 API가 같은 트랜잭션에서 처리한다.
- 여러 테이블에 걸친 검사(리뷰 작성 조건, 장바구니 가게 일치, 답글 작성자, 활성 제재 중복, 주문↔배달 상태)는 서버가 한다. 각 API의 "DB 처리"에 적었다.

### VIEW
| VIEW | 내용 | 쓰는 API |
|---|---|---|
| `V_STORE_RATING` | 가게별 `AVG_RTNG`(소수 1자리), `RVW_CNT`. 숨김·삭제 리뷰 제외. 리뷰 0건 가게도 행이 있다(`AVG_RTNG` NULL) | C-08(평점순: NULL은 뒤), C-09, C-12, S-01, R-01 |
| `V_DONE_ORDER` | 배달 완료(DONE) 주문. `SALES_DT` = date(`DLVR_CMPL_DTTM`), `ORD_TOT_AMT`(배달팁 제외), `DLVR_TIP_AMT` | T-01 합계, T-02(`TB_ORD_DTL`·`TB_ORD_DTL_OPT` 조인) |

T-01의 acceptRate는 주문일시 기준이고 취소 주문도 세므로 `V_DONE_ORDER`를 쓰지 않는다.

### 라이더 위치
라이더 위치는 숭실대 좌표 상수(37.4963, 126.9575)다. 상수는 서버 한 곳에만 둔다. D-04는 선택 쿼리 `lat`, `lng`를 받지만 화면은 보내지 않는다.

## 코드값
| 구분 | 컬럼 | 값 |
|---|---|---|
| 회원 역할 | `TB_MBR.MBR_ROLE_CD` | CUSTOMER, OWNER, RIDER, ADMIN |
| 회원 상태 | `TB_MBR.MBR_STTS` | ACTIVE, WITHDRAWN(탈퇴) |
| 라이더 상태 | `TB_RIDER.RIDER_STTS` | IDLE(대기), BUSY(배달 중) |
| 운송수단 | `TB_RIDER.VHCL_TYPE_CD` | WALK, BICYCLE, MOTORCYCLE, CAR |
| 가게 카테고리 | `TB_STORE.STORE_CTGR_CD` | CHICKEN, PIZZA, KOREAN, CHINESE, JAPANESE, SNACK, CAFE, ETC |
| 가게 영업 상태 | `TB_STORE.STORE_OPER_STTS` | OPEN, PAUSED. 응답의 CLOSED(영업시간 외)는 `TB_STORE_HOURS`로 계산한 값 |
| 입점 승인 상태 | `TB_STORE.STORE_APRV_STTS`, `TB_STORE_APRV.STORE_APRV_STTS` | PENDING, APPROVED, REJECTED |
| 메뉴 판매 상태 | `TB_MENU.MENU_SALE_STTS` | ON_SALE, SOLD_OUT |
| 주문 상태 | `TB_ORD.ORD_STTS` | WAIT(대기), COOKING(조리 중), READY(조리 완료·픽업 대기), DELIVERING(배달 중), DONE(배달 완료), CANCEL(취소) |
| 취소 주체 | `TB_ORD.CNCL_ACTR_CD` | CUSTOMER, OWNER, SYSTEM, ADMIN(고객센터) |
| 취소·거절 사유 | `TB_ORD.CNCL_RSN_CD` | OUT_OF_STOCK(재료 소진), BUSY(주문 폭주), CLOSING(영업 마감), CANNOT_COOK(조리 불가), NO_RESPONSE(가게 미응답), CUSTOMER_REQUEST(고객 요청), STORE_ISSUE(가게 사정), DELIVERY_FAIL(배달 불가), ETC(기타) |
| 결제수단 | `TB_PAY.PAY_MTHD_CD` | CARD, KAKAO, NAVER, POINT |
| 결제 상태 | `TB_PAY.PAY_STTS` | READY, APPROVED, CANCELED |
| 포인트 거래 유형 | `TB_PNT_TXN.PNT_TXN_TYPE_CD` | CHARGE(충전), USE(사용), REFUND(환불), EXPIRE(탈퇴 소멸). 금액은 양수, CHARGE·REFUND 증가, USE·EXPIRE 감소 |
| 충전수단 | `TB_PNT_TXN.CHRG_MTHD_CD` | CARD, KAKAO, NAVER |
| 리뷰 신고 사유 | `TB_RVW_RPT.RVW_RPT_RSN_CD` | ABUSE(욕설·비방), FALSE(허위 사실), UNRELATED(무관한 내용), ETC(기타) |
| 리뷰 신고 상태 | `TB_RVW_RPT.RVW_RPT_STTS` | PENDING(대기), ACCEPTED(숨김), REJECTED(기각) |
| 회원 제한 유형 | `TB_MBR_RSTR.RSTR_TYPE_CD` | REVIEW_WRITE |
| 요일 | `TB_STORE_HOURS.DAY_OF_WEEK` | 0(일)~6(토) |

## 전체 API 목록

| ID | 이름 | method | path | 권한 | 읽는 테이블 | 바꾸는 테이블 |
|---|---|---|---|---|---|---|
| A-01 | 로그인 | POST | /api/auth/login | 누구나 | TB_MBR | TB_MBR |
| A-02 | 로그아웃 | POST | /api/auth/logout | 로그인한 회원 | TB_MBR | 없음(쿠키 삭제) |
| A-03 | 내 정보 | GET | /api/auth/me | 로그인한 회원 | TB_MBR | 없음 |
| A-04 | 내 가게 목록 | GET | /api/owner/stores | OWNER | TB_MBR, TB_STORE, TB_STORE_APRV, TB_STORE_HOURS, TB_ORD, TB_PAY, TB_DLVR | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER(만료 자동 취소) |
| A-05 | 가게 추가 등록 | POST | /api/owner/stores | OWNER | TB_MBR, TB_STORE, TB_STORE_APRV | TB_STORE, TB_STORE_APRV, TB_STORE_HOURS |
| A-05 | 가게 재신청 | PUT | /api/owner/stores/{storeId}/application | OWNER | TB_MBR, TB_STORE, TB_STORE_APRV | TB_STORE, TB_STORE_APRV, TB_STORE_HOURS |
| A-06 | 회원가입(CUSTOMER·OWNER) | POST | /api/auth/signup | 누구나 | TB_MBR, TB_STORE(OWNER) | TB_MBR, TB_STORE·TB_STORE_APRV·TB_STORE_HOURS(OWNER) |
| A-07 | 회원 탈퇴 | DELETE | /api/auth/me | CUSTOMER, OWNER, RIDER | TB_MBR, TB_STORE, TB_ORD, TB_DLVR, TB_PAY | TB_MBR, TB_MBR_ADDR, TB_PNT_TXN, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT; TB_ORD·TB_PAY·TB_RIDER(만료 자동 취소); TB_STORE 후처리 미정 |
| C-01 | 배달 주소 목록 조회 | GET | /api/customer/addresses | CUSTOMER | TB_MBR, TB_MBR_ADDR | 없음 |
| C-02 | 배달 주소 등록 | POST | /api/customer/addresses | CUSTOMER | TB_MBR, TB_MBR_ADDR | TB_MBR_ADDR |
| C-03 | 배달 주소 수정 | PATCH | /api/customer/addresses/{addressId} | CUSTOMER | TB_MBR, TB_MBR_ADDR | TB_MBR_ADDR |
| C-04 | 배달 주소 삭제 | DELETE | /api/customer/addresses/{addressId} | CUSTOMER | TB_MBR, TB_MBR_ADDR | TB_MBR_ADDR |
| C-05 | 기본 배달 주소 지정 | PATCH | /api/customer/addresses/{addressId}/default | CUSTOMER | TB_MBR, TB_MBR_ADDR | TB_MBR_ADDR |
| C-06 | 포인트 잔액·내역 조회 | GET | /api/customer/points | CUSTOMER | TB_MBR, TB_PNT_TXN | 없음 |
| C-07 | 포인트 충전(가상 결제) | POST | /api/customer/points/charges | CUSTOMER | TB_MBR, TB_PNT_TXN | TB_MBR, TB_PNT_TXN |
| C-08 | 가게 목록·검색 | GET | /api/customer/stores | CUSTOMER | TB_MBR, TB_MBR_ADDR, TB_STORE, TB_STORE_HOURS, TB_ORD, TB_RVW (V_STORE_RATING) | 없음 |
| C-09 | 고객 가게 상세 조회 | GET | /api/customer/stores/{storeId} | CUSTOMER | TB_MBR, TB_MBR_ADDR, TB_STORE, TB_STORE_HOURS, TB_ORD, TB_RVW (V_STORE_RATING) | 없음 |
| C-10 | 가게 메뉴 목록 | GET | /api/customer/stores/{storeId}/menus | CUSTOMER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP | 없음 |
| C-11 | 메뉴 상세·옵션 조회 | GET | /api/customer/stores/{storeId}/menus/{menuId} | CUSTOMER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | 없음 |
| C-12 | 가게 공개 리뷰 목록 | GET | /api/customer/stores/{storeId}/reviews | CUSTOMER | TB_MBR, TB_STORE, TB_ORD, TB_ORD_DTL, TB_RVW, TB_RVW_REPLY (V_STORE_RATING) | 없음 |
| C-13 | 장바구니 조회 | GET | /api/customer/cart | CUSTOMER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT | 없음 |
| C-14 | 장바구니 메뉴 담기 | POST | /api/customer/cart/items | CUSTOMER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT | TB_CART, TB_CART_DTL, TB_CART_DTL_OPT |
| C-15 | 장바구니 수량 변경 | PATCH | /api/customer/cart/items/{cartItemId} | CUSTOMER | TB_MBR, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT, TB_MENU, TB_MENU_OPT | TB_CART_DTL |
| C-16 | 장바구니 항목 삭제 | DELETE | /api/customer/cart/items/{cartItemId} | CUSTOMER | TB_MBR, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT | TB_CART, TB_CART_DTL, TB_CART_DTL_OPT |
| C-17 | 장바구니 전체 비우기 | DELETE | /api/customer/cart | CUSTOMER | TB_MBR, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT | TB_CART, TB_CART_DTL, TB_CART_DTL_OPT |
| C-18 | 주문서 미리보기 (선택) | POST | /api/customer/orders/preview | CUSTOMER | TB_MBR, TB_MBR_ADDR, TB_STORE, TB_STORE_HOURS, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT | 없음 |
| C-19 | 주문 생성·가상 결제 | POST | /api/customer/orders | CUSTOMER | TB_MBR, TB_MBR_ADDR, TB_STORE, TB_STORE_HOURS, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT | TB_ORD, TB_ORD_DTL, TB_ORD_DTL_OPT, TB_PAY, TB_MBR, TB_PNT_TXN, TB_CART, TB_CART_DTL, TB_CART_DTL_OPT |
| C-20 | 고객 주문 내역 목록 | GET | /api/customer/orders | CUSTOMER | TB_MBR, TB_STORE, TB_ORD, TB_ORD_DTL, TB_PAY, TB_DLVR, TB_RVW, TB_MBR_RSTR | TB_ORD; 트리거 경유 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| C-21 | 고객 주문 상세·상태 조회 | GET | /api/customer/orders/{orderId} | CUSTOMER | TB_MBR, TB_RIDER, TB_STORE, TB_ORD, TB_ORD_DTL, TB_ORD_DTL_OPT, TB_PAY, TB_DLVR, TB_RVW, TB_MBR_RSTR | TB_ORD; 트리거 경유 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| C-22 | 고객 주문 취소 | POST | /api/customer/orders/{orderId}/cancel | CUSTOMER | TB_MBR, TB_ORD, TB_PAY, TB_PNT_TXN, TB_DLVR | TB_ORD; 트리거 경유 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| C-23 | 내 리뷰 목록 (선택) | GET | /api/customer/reviews | CUSTOMER | TB_MBR, TB_STORE, TB_ORD, TB_DLVR, TB_RVW, TB_RVW_REPLY | 없음 |
| C-24 | 리뷰 작성 | POST | /api/customer/orders/{orderId}/review | CUSTOMER | TB_MBR, TB_ORD, TB_DLVR, TB_RVW, TB_MBR_RSTR | TB_RVW |
| C-25 | 리뷰 수정 | PATCH | /api/customer/reviews/{reviewId} | CUSTOMER | TB_MBR, TB_ORD, TB_DLVR, TB_RVW | TB_RVW |
| C-26 | 리뷰 삭제 | DELETE | /api/customer/reviews/{reviewId} | CUSTOMER | TB_MBR, TB_ORD, TB_RVW | TB_RVW |
| S-01 | 가게 정보 조회 | GET | /api/owner/stores/{storeId} | OWNER | TB_MBR, TB_STORE, TB_STORE_HOURS, TB_MENU, V_STORE_RATING | 없음 |
| S-02 | 운영 정보 수정 | PATCH | /api/owner/stores/{storeId} | OWNER | TB_MBR, TB_STORE, TB_STORE_HOURS, TB_MENU, V_STORE_RATING | TB_STORE |
| S-03 | 영업 상태 변경 | PATCH | /api/owner/stores/{storeId}/oper-status | OWNER | TB_MBR, TB_STORE, TB_MENU | TB_STORE |
| S-04 | 영업시간 저장 | PUT | /api/owner/stores/{storeId}/hours | OWNER | TB_MBR, TB_STORE, TB_STORE_HOURS, TB_MENU, V_STORE_RATING | TB_STORE_HOURS |
| M-01 | 메뉴 목록 | GET | /api/owner/stores/{storeId}/menus | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP | 없음 |
| M-02 | 메뉴 상세 (옵션 포함) | GET | /api/owner/stores/{storeId}/menus/{menuId} | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | 없음 |
| M-03 | 메뉴 등록 | POST | /api/owner/stores/{storeId}/menus | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU | TB_MENU |
| M-04 | 메뉴 수정 | PATCH | /api/owner/stores/{storeId}/menus/{menuId} | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU |
| M-05 | 메뉴 삭제 | DELETE | /api/owner/stores/{storeId}/menus/{menuId} | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT |
| M-06 | 판매 상태 변경 | PATCH | /api/owner/stores/{storeId}/menus/{menuId}/sale-status | OWNER | TB_MBR, TB_STORE, TB_MENU | TB_MENU (자동 PAUSED 여부 미정) |
| M-07 | 옵션 그룹 등록 | POST | /api/owner/stores/{storeId}/menus/{menuId}/option-groups | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP | TB_MENU_OPT_GRP, TB_MENU_OPT |
| M-08 | 옵션 그룹 수정 | PATCH | /api/owner/stores/{storeId}/option-groups/{groupId} | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU_OPT_GRP |
| M-09 | 옵션 그룹 삭제 | DELETE | /api/owner/stores/{storeId}/option-groups/{groupId} | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU_OPT_GRP, TB_MENU_OPT |
| M-10 | 옵션 등록 | POST | /api/owner/stores/{storeId}/option-groups/{groupId}/options | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU_OPT |
| M-11 | 옵션 수정 | PATCH | /api/owner/stores/{storeId}/options/{optionId} | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU_OPT |
| M-12 | 옵션 삭제 | DELETE | /api/owner/stores/{storeId}/options/{optionId} | OWNER | TB_MBR, TB_STORE, TB_MENU, TB_MENU_OPT_GRP, TB_MENU_OPT | TB_MENU_OPT |
| M-13 | 메뉴 순서·분류 일괄 변경 | PATCH | /api/owner/stores/{storeId}/menus/order | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU, TB_MENU_OPT_GRP | TB_MENU_CTGR, TB_MENU |
| M-14 | 메뉴 분류 목록 | GET | /api/owner/stores/{storeId}/menu-categories | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU | 없음 |
| M-15 | 메뉴 분류 등록 | POST | /api/owner/stores/{storeId}/menu-categories | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU | TB_MENU_CTGR |
| M-16 | 메뉴 분류 수정 | PATCH | /api/owner/stores/{storeId}/menu-categories/{categoryId} | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU | TB_MENU_CTGR |
| M-17 | 메뉴 분류 삭제 | DELETE | /api/owner/stores/{storeId}/menu-categories/{categoryId} | OWNER | TB_MBR, TB_STORE, TB_MENU_CTGR, TB_MENU | TB_MENU_CTGR |
| O-01 | 주문 목록 | GET | /api/owner/stores/{storeId}/orders | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_ORD_DTL, TB_PAY, TB_DLVR | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (자동 취소·트리거) |
| O-02 | 주문 상세 (주문서) | GET | /api/owner/stores/{storeId}/orders/{orderId} | OWNER | TB_MBR, TB_RIDER, TB_STORE, TB_ORD, TB_ORD_DTL, TB_ORD_DTL_OPT, TB_PAY, TB_DLVR | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (자동 취소·트리거) |
| O-03 | 주문 접수 | POST | /api/owner/stores/{storeId}/orders/{orderId}/accept | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_DLVR | TB_ORD, TB_DLVR; 만료 시 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (트리거) |
| O-04 | 주문 거절 | POST | /api/owner/stores/{storeId}/orders/{orderId}/reject | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_MENU, TB_PAY, TB_DLVR | TB_ORD, TB_MENU, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (취소 트리거 포함) |
| O-05 | 조리 완료 | POST | /api/owner/stores/{storeId}/orders/{orderId}/cooked | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_DLVR | TB_ORD |
| O-06 | 조리중 취소 | POST | /api/owner/stores/{storeId}/orders/{orderId}/cancel | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_PAY, TB_DLVR | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (취소 트리거 포함) |
| R-01 | 리뷰 목록 | GET | /api/owner/stores/{storeId}/reviews | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_ORD_DTL, TB_RVW, TB_RVW_REPLY, TB_RVW_RPT, V_STORE_RATING | 없음 |
| R-02 | 답글 등록 | POST | /api/owner/stores/{storeId}/reviews/{reviewId}/reply | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_RVW, TB_RVW_REPLY | TB_RVW_REPLY |
| R-03 | 답글 수정 | PATCH | /api/owner/stores/{storeId}/reviews/{reviewId}/reply | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_RVW, TB_RVW_REPLY | TB_RVW_REPLY |
| R-04 | 답글 삭제 | DELETE | /api/owner/stores/{storeId}/reviews/{reviewId}/reply | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_RVW, TB_RVW_REPLY | TB_RVW_REPLY |
| R-05 | 리뷰 신고 | POST | /api/owner/stores/{storeId}/reviews/{reviewId}/report | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_RVW, TB_RVW_RPT | TB_RVW_RPT |
| R-06 | 내 신고 목록 | GET | /api/owner/stores/{storeId}/reports | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_RVW, TB_RVW_RPT | 없음 |
| T-01 | 기간별 매출 | GET | /api/owner/stores/{storeId}/sales | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_DLVR, V_DONE_ORDER | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (자동 취소·트리거) |
| T-02 | 메뉴별 매출 | GET | /api/owner/stores/{storeId}/sales/menus | OWNER | TB_MBR, TB_STORE, TB_ORD, TB_DLVR, TB_ORD_DTL, TB_ORD_DTL_OPT, V_DONE_ORDER | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER (자동 취소·트리거) |
| X-00 | 관리자 요약 | GET | /api/admin/summary | ADMIN | TB_MBR, TB_STORE_APRV, TB_RVW_RPT, TB_MBR_RSTR | 없음 |
| X-01 | 입점 신청 목록 | GET | /api/admin/store-applications | ADMIN | TB_MBR, TB_STORE, TB_STORE_APRV | 없음 |
| X-02 | 입점 신청 상세 | GET | /api/admin/store-applications/{applicationId} | ADMIN | TB_MBR, TB_STORE, TB_STORE_APRV, TB_STORE_HOURS, TB_MENU | 없음 |
| X-03 | 입점 승인 | POST | /api/admin/store-applications/{applicationId}/approve | ADMIN | TB_MBR, TB_STORE_APRV, TB_STORE | TB_STORE_APRV, TB_STORE |
| X-04 | 입점 반려 | POST | /api/admin/store-applications/{applicationId}/reject | ADMIN | TB_MBR, TB_STORE_APRV, TB_STORE | TB_STORE_APRV, TB_STORE |
| X-05 | 리뷰 신고 목록 | GET | /api/admin/review-reports | ADMIN | TB_MBR, TB_STORE, TB_ORD, TB_RVW, TB_RVW_RPT | 없음 |
| X-06 | 리뷰 신고 상세 | GET | /api/admin/review-reports/{reportId} | ADMIN | TB_MBR, TB_ORD, TB_ORD_DTL, TB_DLVR, TB_RVW, TB_RVW_RPT, TB_MBR_RSTR | 만료 WAIT 시 TB_ORD; 트리거 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| X-07 | 리뷰 신고 처리 | POST | /api/admin/review-reports/{reportId}/process | ADMIN | TB_MBR, TB_ORD, TB_RVW, TB_RVW_RPT, TB_MBR_RSTR | TB_RVW_RPT, TB_RVW, TB_MBR_RSTR(선택) |
| X-08 | 리뷰 작성 제한 목록 | GET | /api/admin/restrictions | ADMIN | TB_MBR, TB_MBR_RSTR | 없음 |
| X-09 | 리뷰 작성 제한 | POST | /api/admin/restrictions | ADMIN | TB_MBR, TB_MBR_RSTR, TB_RVW_RPT·TB_RVW·TB_ORD(근거 신고 지정 시) | TB_MBR_RSTR |
| X-10 | 리뷰 작성 제한 해제 | POST | /api/admin/restrictions/{restrictionId}/release | ADMIN | TB_MBR, TB_MBR_RSTR | TB_MBR_RSTR |
| X-11 | 주문 검색(고객센터) | GET | /api/admin/orders | ADMIN | TB_MBR, TB_STORE, TB_ORD, TB_PAY, TB_DLVR(자동 취소) | 만료 WAIT 시 TB_ORD; 트리거 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| X-12 | 주문 상세(고객센터) | GET | /api/admin/orders/{orderId} | ADMIN | TB_MBR, TB_RIDER, TB_STORE, TB_ORD, TB_ORD_DTL, TB_ORD_DTL_OPT, TB_PAY, TB_DLVR | 만료 WAIT 시 TB_ORD; 트리거 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| X-13 | 주문 취소(고객센터) | POST | /api/admin/orders/{orderId}/cancel | ADMIN | TB_MBR, TB_ORD, TB_PAY, TB_DLVR | TB_ORD; 트리거 TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| X-14 | 회원 검색 | GET | /api/admin/members | ADMIN | TB_MBR, TB_ORD, TB_RVW, TB_MBR_RSTR | 없음 |
| D-01 | 라이더 회원가입 | POST | /api/auth/signup | 누구나 | TB_MBR | TB_MBR, TB_RIDER |
| D-02 | 내 라이더 정보 | GET | /api/rider/me | RIDER | TB_MBR, TB_RIDER, TB_DLVR, TB_ORD | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| D-03 | 활동 정보 수정 | PATCH | /api/rider/me | RIDER | TB_MBR, TB_RIDER | TB_RIDER |
| D-04 | 배차 대기 목록 | GET | /api/rider/dispatch-requests | RIDER | TB_MBR, TB_RIDER, TB_DLVR, TB_ORD, TB_STORE | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| D-05 | 배차 수락 | POST | /api/rider/deliveries/{deliveryId}/accept | RIDER | TB_MBR, TB_RIDER, TB_DLVR, TB_ORD, TB_STORE, TB_ORD_DTL | TB_DLVR, TB_RIDER |
| D-06 | 현재 배달 | GET | /api/rider/deliveries/current | RIDER | TB_MBR, TB_DLVR, TB_ORD, TB_ORD_DTL, TB_STORE | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |
| D-07 | 픽업 완료 | POST | /api/rider/deliveries/{deliveryId}/pickup | RIDER | TB_MBR, TB_DLVR, TB_ORD, TB_STORE, TB_ORD_DTL | TB_ORD, TB_DLVR |
| D-08 | 배달 완료 | POST | /api/rider/deliveries/{deliveryId}/complete | RIDER | TB_MBR, TB_DLVR, TB_ORD, TB_RIDER | TB_ORD, TB_DLVR, TB_RIDER |
| D-09 | 배달 내역 | GET | /api/rider/deliveries/history | RIDER | TB_MBR, TB_DLVR, TB_ORD, TB_STORE | TB_ORD, TB_PAY, TB_MBR, TB_PNT_TXN, TB_RIDER |


## 원본 명세서 대비 변경

원본 명세서 3개(고객, 사장·관리자, 라이더)와 다른 점이다. 공통 규칙의 결정(응답 형식, 10분 자동 취소, 취소·환불, 탈퇴 회원 재가입 등)은 위 공통 규칙에 있다.

### 인증 (auth.md)

- A-01: ACTIVE 회원만 조회하도록 결정 16 반영, HMAC-SHA256 서명 쿠키·발급/만료 검증 명시, 성공 시 `TB_MBR.MBR_LOGIN_DTTM` 갱신과 수정 시각 트리거 책임 명시. 쿠키의 사소한 선택값은 `delivery_session`, HttpOnly, SameSite=Lax, Path=/, 운영 HTTPS Secure, 24시간 고정(`Max-Age=86400`), 호스트 전용으로 정했다. 비밀번호는 계획의 Node crypto.scrypt 해시를 따른다.
- A-02: 원본 `{success:true}`를 통일 응답 `{success:true,data:null}`로 보완. 현재 브라우저 쿠키만 만료하며 무상태 서명 쿠키에 서버측 개별 폐기 기능이 없음을 명시.
- A-03: 원본대로 GET·`memberId/name/role` 세 필드만 반환. 라이더 D-03의 ‘공통 내 정보 수정(A-03)’ 안내와 조회 전용 정의의 충돌을 질문으로 남김.
- A-04: 원본 숫자 테이블 참조를 실명으로 변경, 가게 현재 승인 상태와 최신 반려 사유 출처 구분, CLOSED 계산을 영업시간 테이블로 정렬. 주문 조회 전 10분 WAIT 자동 취소 및 트리거 연쇄 변경을 결정 4·9에 맞게 추가.
- A-05: 화면 함수와 일치하는 추가 POST·재신청 PUT 경로 유지. 확정 카테고리 8개·필수 좌표·영업시간 저장/교체 명시. 가게 현재 승인 상태와 새 신청 상태를 같은 트랜잭션에 PENDING으로 동기화하고 수정 시각 직접 대입 제거. 추가 201·재신청 200으로 응답 상태를 구분.
- A-06: 고객 요약을 합쳐 CUSTOMER/OWNER 분기, OWNER의 필수 첫 가게·PENDING 입점 신청을 유지. RIDER는 D-01 교차 참조만 제공. 활성 이메일만 중복 검사하고 탈퇴 행 재활성화 없이 새 회원을 생성하도록 결정 16 반영. ADMIN 가입 금지·가입 후 자동 로그인 없음 명시. CUSTOMER가 store를 보내는 요청은 잘못된 역할별 입력으로 분류.
- A-07: 원본 이메일 치환을 폐기하고 결정 16의 이메일 유지·이름 ‘탈퇴회원’·전화/비밀번호 NULL·WITHDRAWN 전환 반영. 양수 잔액만 EXPIRE 거래 후 0원, 잔액 0은 거래 없음, 장바구니 CASCADE 삭제 명시. OWNER는 소유 가게 진행 주문·저장값 OPEN 시 차단. RIDER는 부모 확인에 따라 D-06와 같은 ‘배달완료일시 NULL + 주문 CANCEL 아님’일 때만 차단. Q-AUTH-3은 본인 `TB_MBR_ADDR.DEL_YN='Y'` 논리 삭제를 탈퇴 트랜잭션에 포함하는 것으로 확정했다. 원문 파손으로 복원 불가한 가게 후처리만 미정으로 남김. 만료 WAIT 자동 취소와 탈퇴 변경의 트랜잭션을 구분.

### 고객 (customer.md)

| API ID | 변경 내용·이유 |
|---|---|
| C-01 | OCR의 Id·JSON 깨짐 복구, 실제 주소 컬럼 매핑 및 기본 주소·최신순 정렬 명시. |
| C-02 | zipCode·lng 등 OCR 교정. 좌표는 최종 스키마의 NOT NULL·범위 조건 반영, 첫 주소 기본 지정·기존 기본 해제를 한 트랜잭션으로 명시. |
| C-03 | path·addressDetail 오타 교정. 주소 변경 시 좌표 필수, 주문 스냅샷 불변, 수정일시 트리거 명시. |
| C-04 | 논리 삭제·기본 주소 재지정의 트랜잭션과 주문 스냅샷 불변 명시. |
| C-05 | 기본 주소 Y/N 오타 복구, 부분 UNIQUE에 맞춰 기존 기본 해제 후 지정. |
| C-06 | 미확정 잔액 컬럼을 확정 TB_MBR.PNT_BAL_AMT로 대체, 거래 컬럼·페이지 응답 매핑. |
| C-07 | 10,000원 단위 확정 반영, 1회 상한은 미정(Q). 잔액·CHARGE 동시 기록 및 수정일시 트리거 명시. |
| C-08 | 카테고리 8개 확정, 승인·미삭제·주소→가게 실제 직선거리 ≤3000m 필터, 영업시간 계산, V_STORE_RATING 및 리뷰 0건 후순위 명시. 원본 sort 코드와 DEFAULT 순서·시간/거리 정수화도 코디네이터 결정 반영. |
| C-09 | minOrderAmount·reviewCount 등 OCR 교정. TB_STORE_HOURS 기반 영업시간·휴무, V_STORE_RATING 매핑. 반경 밖도 200 상세·canOrder=false로 확정. |
| C-10 | 최종 TB_MENU_CTGR 참조·분류/메뉴 미삭제·품절 표시 조건 명시. |
| C-11 | 손상된 path·옵션 JSON 복구, 옵션그룹·옵션 실제 컬럼 및 메뉴/가게/분류 소속 검사 명시. |
| C-12 | 잘못된 리뷰 숨김 컬럼 표기를 TB_RVW.RVW_HDN_YN으로 교정, V_STORE_RATING 사용, 비공개 리뷰·삭제 답글 제외. |
| C-13 | cartItemId 등 OCR 교정. 최신 가격·옵션 유효성·최소금액 계산 및 빈 장바구니 응답 명시. |
| C-14 | INVALID_OPTION_SELECTION 오류명 OCR 복구. 장바구니 가게 일치·옵션 소속·필수/최대선택 검사와 트랜잭션 명시. 원본의 교체·합산·수량 상한 제안은 미정(Q). |
| C-15 | cartItemId path·응답 오타 교정, 본인 소유 검사·현재 가격 계산·수정일시 트리거 명시. 수량 상한은 C-14와 함께 질문. |
| C-16 | 항목 DELETE의 FK CASCADE로 옵션 삭제, 마지막 항목이면 헤더 삭제를 한 트랜잭션으로 명시. |
| C-17 | 헤더 DELETE의 FK CASCADE로 전체 삭제, 빈 장바구니의 멱등 성공 유지. |
| C-18 | 선택 API도 전체 틀로 포함. C-19와 같은 독립 최종 검증이 필요함을 명시하고 누락된 입력·주소·메뉴·옵션 오류를 보완. |
| C-19 | 스키마 추가 요청 문구를 확정 컬럼 매핑으로 대체. 주문·상세·옵션그룹명 포함 스냅샷·배달 주소/좌표·결제·POINT 조건부 UPDATE/USE·장바구니 삭제를 단일 트랜잭션으로 명시. TB_DLVR은 O-03에서만 생성. 0원 POINT는 승인·잔액 불변·USE 생략으로 확정. |
| C-20 | 조회 전 10분 미접수 SYSTEM/NO_RESPONSE 취소를 반영해 변경 테이블·트리거 부작용 수정. canReview에 완료일시·제재·삭제 포함 기존 리뷰 검사를 명시. |
| C-21 | 조회 전 만료 처리와 변경 테이블 반영, 옵션그룹명·요청사항·취소·배달 일시의 확정 컬럼 매핑. 배달 상태 컬럼 없이 일시 사용, 원본 예상시간 계산 규칙은 유지하되 없는 응답 필드는 추가하지 않음. |
| C-22 | CUSTOMER_REQUEST 확정, 트랜잭션 내 만료 검사·조건부 WAIT 취소 명시. 직접 결제/환불/라이더 처리를 제거하고 TRG_ORD_CANCEL로 통일. POINT만 잔액/REFUND, 그 밖에는 결제 취소만 처리. refunded는 모든 결제수단의 결제 취소 완료 여부로 확정. |
| C-23 | 선택 API를 누락 없이 포함. 숨김 본인 리뷰·미삭제 답글·DONE/완료일시 기준 수정 가능 여부 명시. |
| C-24 | 내용 생략 시 빈 문자열 저장·NOT NULL 전제를 삭제하고 NULL 저장으로 수정. DONE·TB_DLVR 완료일부터 72시간·활성 제재·주문당 1건·삭제 후 재작성 금지를 트랜잭션 안 서버 검사로 명시. |
| C-25 | OCR 오류 복구. 수정일시를 API가 넣지 않고 트리거 처리 후 조회. 공통 규칙에 따라 삭제 자원 404, 숨김 409로 오류 중복 문구 정리. 신규 작성 제재를 수정에 확대하지 않음. |
| C-26 | 논리 삭제·기존 주문 UNIQUE 유지·재작성 금지·V_STORE_RATING 제외·수정일시 트리거 명시. |
| C-08 | 질문 2 확정: 원본 sort 코드 DEFAULT, RATING, REVIEW-COUNT, DELIVERY_TIP 유지. DEFAULT는 영업중 우선·실제 거리 오름차순·가게 ID 오름차순, 각 정렬 동률은 가게 ID 오름차순. |
| C-08·C-09 | 질문 3 확정: 조리분+실제 직선거리(km)×3을 합한 뒤 분 단위 올림으로 예상배달시간 통일. |
| C-08·C-09·C-18 | 질문 4 확정: distance는 m 단위 반올림 표시, 3000m 판정은 변환 전 실제 거리 사용. |
| C-09 | 질문 5 확정: 반경 밖 상세도 200 제공·canOrder=false, 주문은 OUT_OF_DELIVERY_RANGE. |
| C-19 | 질문 9 확정: 0원 POINT 결제는 승인·잔액 불변·USE 생략, 현 스키마 유지. |
| C-22 | 질문 10 확정: refunded는 결제 취소 완료를 의미하며 모든 결제수단에서 성공 시 true. |

### 사장 (owner.md)

| API ID | 변경·근거 |
|---|---|
| S-01 | 깨진 표를 복원하고 가게·영업시간·메뉴·평점의 실제 컬럼을 연결했다. 평점은 결정 11에 따라 V_STORE_RATING 사용, CLOSED·closedDays는 계산값으로 명시했다. |
| S-02 | 운영 필드만 부분 수정하고 승인 정보 입력은 400으로 정리했다. 응답을 S-01과 통일하고 수정일시는 트리거가 기록하도록 했다. |
| S-03 | OPEN/PAUSED만 저장하고 OPEN 전 판매중 메뉴 존재 검사를 서버 트랜잭션에 명시했다. 기존 주문은 유지한다. |
| S-04 | TB_STORE_HOURS 전체 교체, 정확한 HH:mm·종료 24:00·요일별 겹침 금지·빈 배열 금지·자정 넘김 두 요일 분할을 명시했다. |
| M-01 | 분류는 TB_MENU_CTGR와 CTGR_ID를 사용하고 빈 분류·품절 메뉴를 포함하며 삭제된 행은 제외하도록 정리했다. |
| M-02 | 메뉴→분류·그룹·옵션 실제 관계와 응답 필드를 복원하고 각 미삭제 행만 조회하도록 명시했다. |
| M-03 | categoryId를 TB_MENU_CTGR.CTGR_ID에 연결하고 다른 가게·삭제된 분류는 400, 최초 ON_SALE·기본 순서 계산을 명시했다. |
| M-04 | 같은 가게 미삭제 분류 이동 검사와 부분 수정을 명시하고 주문 스냅샷은 유지하도록 했다. |
| M-05 | 메뉴·그룹·옵션 논리 삭제를 서버의 한 트랜잭션으로 명시했다. 마지막 판매중 메뉴 삭제 후 자동 PAUSED 여부는 질문으로 남겼다. |
| M-06 | 판매 상태는 TB_MENU.MENU_SALE_STTS로 연결하고 성공 응답은 `{menuId, saleStatus}`로 확정했다. 마지막 메뉴 품절 시 자동 PAUSED 여부만 미정으로 유지했다. |
| M-07 | 그룹·초기 옵션 INSERT를 한 트랜잭션으로 명시하고 boolean required↔Y/N, maxSelect 1 이상·옵션 수보다 큰 값 허용을 반영했다. |
| M-08 | 경로 자리표시자는 front_owner_api.js의 groupId를 사용하고 수정 필드·상위 소속·미삭제 검사를 명시했다(실제 URL 구조는 동일). |
| M-09 | front_owner_api.js의 groupId를 사용했다. 필수 그룹 전체 삭제는 가능하고 하위 옵션 논리 삭제는 서버가 처리하도록 했다. |
| M-10 | front_owner_api.js의 groupId를 사용했다. 그룹→메뉴→가게 검사, 옵션 기본 순서와 실제 컬럼을 명시했다. |
| M-11 | 옵션→그룹→메뉴→가게 검사와 부분 수정을 명시하고 기존 주문 옵션 스냅샷은 유지했다. |
| M-12 | 필수 그룹의 마지막 미삭제 옵션 삭제 금지를 검사·UPDATE와 같은 트랜잭션으로 명시했다. |
| M-13 | 분류 순서는 TB_MENU_CTGR.CTGR_SEQ, 메뉴 이동·순서는 TB_MENU.CTGR_ID·MENU_SEQ로 분리하고 모든 소속 검사·갱신을 한 트랜잭션으로 명시했다. |
| M-14 | TB_MENU_CTGR 기준 목록·순서와 미삭제 메뉴 집계로 정리했다. |
| M-15 | 같은 가게 미삭제 분류명 중복을 서버 검사와 부분 UNIQUE 인덱스로 방어하고 생성 후 M-14 전체 목록을 반환하도록 복원했다. |
| M-16 | 분류 행만 수정하고 메뉴의 CTGR_ID는 유지함을 명시했다. 중복 검사에서 자기 분류는 제외한다. |
| M-17 | 남은 미삭제 메뉴 검사 후 분류만 논리 삭제하며 메뉴 이동·삭제를 선행하도록 정리했다. |
| O-01 | 결정 4에 따라 조회 전 만료 WAIT 자동 취소를 먼저 커밋하도록 추가했다. 라이더 이름·날짜 필터·폴링·정렬·배열 응답을 복원하고 트리거 간접 쓰기 테이블을 반영했다. |
| O-02 | 조회 전 자동 취소·주문 상세 스냅샷·요청사항 분리·수저 여부·라이더 정보를 실제 스키마로 연결했다. 고객 이름·전화번호 미노출을 유지했다. |
| O-03 | 만료 검사와 WAIT 조건부 UPDATE, ORD_RCPT_DTTM·COOK_EST_MI 기록, RIDER_MBR_ID NULL인 TB_DLVR INSERT를 한 트랜잭션으로 명시했다. 만료 취소는 커밋한 뒤 409를 반환한다. |
| O-04 | WAIT·OWNER 거절, 사유 코드·ETC 상세 필수·선택 메뉴 SOLD_OUT을 명시했다. 결정 9에 따라 ORD_STTS='CANCEL' UPDATE 뒤 결제·환불·라이더 복귀는 TRG_ORD_CANCEL에 맡기며 API가 중복 처리하지 않는다. |
| O-05 | READY를 조리완료·픽업대기로 통일하고 COOKING 조건부 UPDATE만 수행하며 배달 행을 다시 만들지 않도록 했다. |
| O-06 | COOKING만 취소 가능하고 접수 정보·배달 이력은 보존하도록 했다. 원본의 배달 종료 문구를 가짜 완료일시 기록이 아닌 주문 CANCEL로 해석해 확정 스키마·TRG_ORD_CANCEL에 맞췄다. |
| R-01 | V_STORE_RATING 적용, 숨김 포함 사장 목록과 숨김 제외 평점 차이·noReply·페이지 응답·작성자 마스킹을 명시했다. 리뷰 내용은 NULL 허용이다. |
| R-02 | 결정된 답글 부활 규칙을 반영했다. RVW_ID UNIQUE이므로 삭제된 기존 행을 UPDATE하며 새 행을 INSERT하지 않는다. 가게 사장 일치 검사를 명시했다. |
| R-03 | 현재 사장·답글 작성자·리뷰 소속 검사, 숨김·삭제 409, 미삭제 답글 없음 404와 수정일시 트리거를 명시했다. |
| R-04 | 답글 논리 삭제와 재등록 시 같은 행 부활을 명시하고 숨김·삭제 리뷰 변경 금지를 유지했다. 삭제 성공도 success/data 봉투로 통일했다. |
| R-05 | ABUSE/FALSE/UNRELATED/ETC를 실제 CHECK와 맞추고 모든 사유에 신고 내용 필수, ALREADY_REPORTED·숨김/삭제 REVIEW_UNAVAILABLE 409를 명시했다. 신고만으로 리뷰를 숨기지 않는다. |
| R-06 | 세션 신고자와 해당 가게 리뷰만 조회하며 처리 이력을 보존하는 배열 응답으로 복원했다. front 함수의 params 인자는 정의된 쿼리가 있다는 근거로 삼지 않았다. |
| T-01 | 매출 합계는 V_DONE_ORDER의 배달완료일 기준, 접수율은 TB_ORD의 주문일시 기준으로 분리했다. 접수÷(접수+거절+자동 취소), OWNER·접수일시 NULL 거절, SYSTEM 자동 취소, CUSTOMER/ADMIN 취소 제외·분모 0 null을 명시했다. |
| T-02 | V_DONE_ORDER를 상세·상세옵션과 조인하고 옵션을 상세별 선합산해 중복 집계를 막도록 명시했다. 주문 당시 메뉴명별 매출 합계가 T-01과 같아야 하며 전체 매출이 0이면 ratio=0으로 확정했다. |

모든 API는 본인 미삭제 가게·OWNER 활성 세션·하위 자원 소속을 서버가 검사한다. S-01 외 미승인 가게는 409다. method/path는 front_owner_api.js와 대조했으며 URL 구조 변경은 없다. 성공·실패 봉투, 페이지 형식, 시간·금액 단위, 수정일시·취소 트리거의 책임은 계약 결정 1~17에 맞췄다.

### 관리자 (admin.md)

- X-00: 원본의 관리자 요약 API를 누락 없이 복원했다. 대기 입점 신청·대기 리뷰 신고·활성 리뷰 작성 제한 건수를 조회하며, 활성 제한은 종료일시 NULL 또는 미래 조건으로 통일했다.
- X-01: 원본의 배열·필드·상태별 정렬을 유지하고 입점 신청·가게·사장 조인 및 재신청 계산 출처를 실제 스키마로 명시했다.
- X-02: S-01 기반 가게·영업시간·판매중 메뉴 수, 사장 연락처, 이전 신청 이력을 펼쳐 적었다. 실제 조회에 필요한 TB_STORE_HOURS·TB_MENU를 읽기 목록에 추가했고 평점 VIEW는 제외했다.
- X-03: 결정 10에 따라 TB_STORE_APRV 승인 처리와 TB_STORE.STORE_APRV_STTS 동기화를 같은 트랜잭션으로 명시했다. 처리자·처리일시, PENDING 조건부 UPDATE, 영업상태 유지도 적었다.
- X-04: 결정 10에 따라 신청 반려와 가게 현재 승인 상태 동기화를 같은 트랜잭션으로 명시했다. 공백 불가·300자 이내 필수 반려 사유와 PENDING 조건부 UPDATE를 적었다.
- X-05: 원본 목록 필드를 유지하고 실제 리뷰→주문→가게 조인을 표기했다. 리뷰 내용은 스키마상 NULL 가능하므로 미리보기도 null 가능으로 정리했다.
- X-06: 원본에 빠진 배달완료일시 출처 TB_DLVR를 추가했다. 주문 상태 조회 전 자동 취소 규칙, 작성자별 숨김 리뷰·활성 제한 집계를 명시했다.
- X-07: 신고 조건부 처리·ACCEPTED 리뷰 숨김·선택적 제한 생성을 같은 트랜잭션으로 명시했다. 작성자는 리뷰→주문으로 확인하고 제한에 RVW_RPT_ID를 연결한다. 이미 활성 제한 중이면 새 행 없이 writerRestricted=true인 원본 예외를 유지했다.
- X-08: active=true의 NULL·미래 종료일시 판정을 명시했다. 코디네이터 결정 Q1 ①에 따라 active 생략 시 기본값은 true로 확정했다.
- X-09: 활성 제한 중복을 트랜잭션 안 서버 검사로 판정하여 409 ALREADY_RESTRICTED를 반환하도록 명시했다. 선택한 근거 신고와 대상 작성자 일치 검사를 적었다.
- X-10: 삭제가 아니라 RSTR_END_DTTM=현재로 해제하며, 조건부 UPDATE로 ALREADY_RELEASED를 판정하도록 명시했다.
- X-09·X-10: 코디네이터 결정 Q2 ①에 따라 성공 응답은 각각 `{restrictionId, memberId, startedAt, endedAt}`, `{restrictionId, endedAt}`으로 확정했다.
- X-11: 원본 keyword 분기·최신순·최대 50건·취소 가능 상태를 유지했다. 조회 전 만료 WAIT 자동 취소와 트리거 간접 변경 테이블을 추가했다.
- X-12: O-02 스냅샷 주문서 전체와 고객·가게·타임라인·취소 상담 정보를 명시했다. 배달 상태 컬럼 대신 일시 컬럼을 사용하고 조회 전 자동 취소를 추가했다. 코디네이터 결정 Q3 ①에 따라 관리자 취소의 cancelProcessor는 `{memberId, name}` 객체로 확정했다.
- X-13: 허용 4개 상태의 조건부 UPDATE, ADMIN·세션 관리자·취소 사유·상담 메모를 명시했다. API의 중복 환불·가짜 배달 종료 처리를 제거하고 TRG_ORD_CANCEL 연쇄 처리로 통일했다. POINT만 포인트 환불이며, 원본 refunded=true는 취소 처리 완료 표시로 설명했다. ETC의 필수 상세 사유와 원본 요청 필드 불일치는 미정으로 남겼다.
- X-14: 원본 부분검색·역할 필터·ADMIN 제외·최대 50건을 유지했다. 주문·숨김 리뷰의 독립 집계와 활성 제한 계산을 명시했다. 코디네이터 결정 Q5 ①에 따라 ACTIVE·WITHDRAWN 회원 모두 검색하도록 확정했다.

모든 method/path는 front_admin_api.js의 X-00~X-14 호출과 일치한다. 모든 API의 읽는 테이블에는 요청별 인증용 TB_MBR를 포함했다. 수정일시는 API 직접 대입 대신 해당 트리거가 기록한다.

### 라이더 (rider.md)

- D-01: 확정 스키마의 운송수단 4개·반경 500~5000(기본 3000)·IDLE 초기값과 회원·라이더 원자적 생성을 명시. 결정 16에 따라 이메일 중복은 ACTIVE 회원만 검사하고 탈퇴 이메일 재사용을 허용.
- D-02: 현재 배달 번호 판정에 실제 `TB_ORD` 조인과 미완료·비취소 조건을 명시. 조회 전 미접수 만료 취소와 트리거 연쇄 쓰기까지 DB 처리에 반영.
- D-03: 보낸 필드만 수정하고 IDLE 조건부 UPDATE로 배차 경합 중 수정을 차단. 응답에 쓰이는 `TB_MBR` 읽기와 자동 수정 일시 트리거를 명시.
- D-04: 추출 과정에서 갈라진 경로를 화면 호출 `/api/rider/dispatch-requests`로 복원. 숭실대 단일 상수·선택 좌표, Node 하버사인 반경 필터와 두 거리 계산, 주문별 접수 시각+조리 예상분 정렬, 배열 응답을 구체화.
- D-05: 원본의 BUSY 우선 처리 순서를 결정 13의 주문 상태 → 이미 배차 → BUSY로 교정. 같은 트랜잭션의 배달 선점·BUSY 조건부 UPDATE와 결과 행 수 판정·전체 롤백을 명시. 원본의 잘못된 라이더 행 키는 실제 `TB_RIDER.MBR_ID`로 교정.
- D-06: 내 배달·미완료·주문 비취소 조건과 null 반환을 명시하고 취소 트리거가 배차 기록을 지우지 않는 점을 설명. 탈퇴 고객 연락처 null 가능성을 반영.
- D-07: READY 조건부 전이와 픽업 일시를 한 트랜잭션으로 명시. COOKING은 NOT_READY, 취소·재픽업·완료는 ORDER_ALREADY_PROCESSED로 구분. 전체 응답 필드와 읽는 고객 테이블을 복원.
- D-08: DELIVERING 조건부 전이·완료 일시·라이더 IDLE을 API가 같은 트랜잭션에서 처리한다고 명시. 재완료도 ORDER_ALREADY_PROCESSED이며 완료 시 IDLE 처리 트리거는 없음을 명시.
- D-09: 페이지 목록과 별개의 오늘 전체 DONE 배달 건수·팁 합계를 필수 응답으로 보존. 취소 배달 제외·한국 날짜 기준·0 기본값과 조회 전 미접수 만료 취소를 명시.
- D-05·D-06·D-07: 고객 연락처는 해당 배달에 배차된 라이더에게만 실제 `TB_MBR.MBR_TELNO`를 제공하고 탈퇴 고객은 null로 확정하여 원본 응답 계약을 유지.

## 미정 항목

아래 항목은 팀 결정이 필요하다. 각 문서에 `미정(Q)`로 표시했다.

### 인증

1. **Q-AUTH-1 — 공통 회원정보 수정 API**: 라이더 원문 135행은 이름·연락처·비밀번호 수정을 A-03으로 안내하지만 관리자·사장 원문 236~241행과 화면 getMe는 GET 조회만 정의한다. ① 공통 수정 API를 별도 정의하고 요청·비밀번호 재확인·응답을 확정한 뒤 문서화(추천: 라이더가 안내받은 기능 보존), ② 공통 수정 기능은 제공하지 않고 라이더의 잘못된 안내를 제거. 현재 A-03은 GET만 정의했으며 임의 PATCH 규격을 추가하지 않았다.
2. **Q-AUTH-2 — OWNER 탈퇴 후 가게 처리**: 원본 83행의 바꾸는 테이블에 가게가 있으나 `4 (�� �� ��)`로 깨져 있고 305행 본문도 복원 불가. ① 비삭제 소유 가게 모두 `TB_STORE.DEL_YN='Y'` + `TB_STORE.STORE_OPER_STTS='PAUSED'`를 탈퇴 트랜잭션에 포함(추천), ② 가게 유지. 진행 주문·저장값 OPEN 가게가 있으면 먼저 탈퇴 차단하는 규칙은 확정이다.

### 고객

1. **C-07 1회 충전 상한** — 단위 10,000원은 확정이다.
   - 선택지 1: 100,000원(추천: 과제용 가상충전에 작은 상한을 명시).
   - 선택지 2: 1,000,000원.
   - 선택지 3: 별도 업무 상한 없음(표현 가능한 안전한 정수 범위만 검사).
6. **C-14·C-15 항목 수량 상한**
   - 선택지 1: 항목당 99개(추천: 입력 실수 방지, 화면에서도 동일 제한).
   - 선택지 2: 항목당 999개.
   - 선택지 3: 별도 업무 상한 없음(안전한 정수·금액 연산 범위는 검사).
7. **C-14 replaceCart=true 교체 기능** — 원본에 논의 필요라고 명시되어 있다.
   - 선택지 1: true이면 기존 장바구니 전체 삭제·새 가게 항목 생성을 한 트랜잭션으로 처리(추천: 원본 제안 수용).
   - 선택지 2: 자동 교체 미지원, 가게 충돌은 항상 409 후 C-17 호출. 이 경우 replaceCart 필드 제거 여부도 함께 승인 필요.
8. **C-14 동일 메뉴·옵션 구성 추가**
   - 선택지 1: 옵션 ID 집합이 같은 항목의 수량 합산(추천: 원본 제안 수용).
   - 선택지 2: 매 요청 별도 항목 생성.
   - 옵션 순서는 동일 구성 판정에서 무시할 것을 추천한다. 합산 시 수량 상한도 합산 결과에 적용한다.

### 사장

1. **M-05·M-06: 마지막 판매중 메뉴가 사라질 때 영업 상태를 자동 PAUSED로 바꿀까?** 원본 M-05에서 백엔드 확인 항목으로 남겼고 확정 결정에는 없다. O-04의 soldOutMenuIds로 판매중 메뉴가 0개 되는 경우도 같은 정책이 필요하다.
   - 선택 1 (**추천**): 저장 영업 상태는 유지한다. 신규 주문은 고객 주문 API의 메뉴 판매 가능 여부 검사로 차단하고 사장이 S-03으로 영업 상태를 결정한다.
   - 선택 2: 해당 메뉴 삭제·품절 처리와 같은 트랜잭션에서 TB_STORE.STORE_OPER_STTS='PAUSED'로 바꾼다. 적용 범위는 M-05·M-06·O-04로 통일한다.

### 관리자

4. **X-13 ETC 상세 사유 저장**: 원본 body는 reason·counselNote뿐이나 스키마는 ETC일 때 TB_ORD.ORD_CNCL_RSN_CN이 필수다.
   - ① `reasonDetail`을 ETC일 때 필수인 body 필드로 추가하여 ORD_CNCL_RSN_CN에 저장(추천: 상담 메모와 취소 상세 사유를 구분; 화면도 같은 필드 추가 필요).
   - ② ETC이면 counselNote를 ORD_CNCL_RSN_CN과 CNSL_MEMO_CN에 함께 저장(현재 요청 필드 유지).


