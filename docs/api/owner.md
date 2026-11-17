# 사장 API

## 공통 규칙

- 기본 경로: `/api/owner/stores/{storeId}`. 권한은 모두 OWNER. HMAC 서명 세션 쿠키를 확인하고 요청마다 `TB_MBR.MBR_STTS='ACTIVE'`, `TB_MBR.MBR_ROLE_CD='OWNER'`를 검사한다.
- 모든 `{storeId}`는 `TB_STORE.DEL_YN='N'`인 로그인 사장의 가게여야 한다(`TB_STORE.OWNR_MBR_ID` = 세션 회원). 하위 분류·메뉴·옵션 그룹·옵션·주문·리뷰도 그 가게 소속인지 서버가 관계를 따라 검사한다. 남의 자원은 403, 없는 자원·논리 삭제된 관리 대상은 404다. 숨김·삭제 리뷰에 대한 변경은 별도로 409다.
- S-01은 승인 전에도 조회 가능하다. 나머지는 `TB_STORE.STORE_APRV_STTS='APPROVED'`가 필요하다.
- 모든 API에 아래 공통 오류가 적용된다. 각 API 오류 표는 추가 오류다.

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 타입·범위·필수값·허용 필드 오류. 필요하면 `error.fields` 제공 |
| 401 | UNAUTHORIZED | 세션 없음·변조·만료 또는 비활성 회원 |
| 403 | FORBIDDEN | OWNER가 아니거나 가게·하위 자원 소유권 불일치 |
| 404 | NOT_FOUND | 대상 없음·삭제됨(리뷰 변경은 해당 API의 409 규칙 우선) |
| 409 | STORE_NOT_APPROVED | S-01 외 API에서 가게가 미승인 |

- 성공은 `{ "success": true, "data": ... }`, 실패는 `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "입력값을 확인해 주세요.", "fields": { "price": "0 이상의 정수" } } }`다. 조회·수정·삭제는 200, 생성은 201이다. 삭제 성공의 `data`는 `null`이다.
- 일시는 한국 시간 `YYYY-MM-DD HH:mm:ss`, 날짜는 `YYYY-MM-DD`. ID는 양의 정수, 금액은 원 단위 정수, 거리도 m 단위 정수다. 페이지는 1부터, size 기본 20·최대 100이다. 페이지 목록 외 목록은 배열이다.
- PATCH는 보낸 필드만 바꾼다. 모든 UPDATE의 `MOD_DTTM`은 해당 테이블의 수정일시 트리거가 기록하며 API가 직접 넣지 않는다.
- `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`의 조회·관리 대상은 `DEL_YN='N'`인 행이다. 논리 삭제의 하위 연쇄는 서버가 처리한다. 기존 주문의 스냅샷은 변경하지 않는다.
- 주문 조회는 응답을 읽기 전에 `WAIT`이고 `TB_ORD.ORD_DTTM + 10분`이 지난 주문을 `SYSTEM`/`NO_RESPONSE` 취소로 전환한다. 예약 작업은 없다. 취소는 `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`한다. 주문당 결제는 1건이며 승인된 POINT 결제만 잔액 환불과 REFUND 거래를 남긴다(0원은 거래 없음). 다른 결제는 결제 상태만 CANCELED다. API가 환불·라이더 복귀를 중복 실행하지 않는다.
- 취소로 배달완료 일시를 만들지 않는다. `TB_DLVR`의 배차·픽업·완료 여부는 각각 `DSPCH_DTTM`, `PKUP_DTTM`, `DLVR_CMPL_DTTM`으로 판단하고, 취소 여부는 주문 상태로 판단한다.

> 미정(Q): M-05·M-06·O-04의 삭제·품절 처리로 마지막 판매중 메뉴가 사라질 때 가게를 자동 PAUSED로 바꿀지는 미확정이다. 각 API의 확정 쓰기 목록에는 이 추가 변경을 넣지 않았으며, 정책 확정 후 적용 범위를 세 API에 통일해야 한다.

## 공통 응답 객체

아래 객체 표는 각 API 응답 표의 일부다. `data` 내부를 기준으로 표기한다.

### 가게 객체 (S-01·S-02·S-04)

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| storeId, storeName | integer, string | `TB_STORE.STORE_ID`, `TB_STORE.STORE_NM` |
| categoryCode, bizNo | string, string | `TB_STORE.STORE_CTGR_CD`, `TB_STORE.BIZ_NO` |
| telNo, address, addressDetail | string, string, string/null | `TB_STORE.STORE_TELNO`, `TB_STORE.STORE_ADDR`, `TB_STORE.STORE_DADDR` |
| lat, lng | number, number | `TB_STORE.STORE_LAT`, `TB_STORE.STORE_LNG` |
| hours | array | `TB_STORE_HOURS`를 요일·시작 시각순 정렬 |
| hours[].dayOfWeek, hours[].open, hours[].close | integer, string, string | `TB_STORE_HOURS.DAY_OF_WEEK`, `TB_STORE_HOURS.OPEN_TM`, `TB_STORE_HOURS.CLOSE_TM` |
| closedDays | integer[] | 0~6 중 영업시간 행이 없는 요일 |
| minOrderAmount, deliveryTip, cookMinutes | integer | `TB_STORE.MIN_ORD_AMT`, `TB_STORE.DLVR_TIP_AMT`, `TB_STORE.COOK_EST_MI` |
| description | string/null | `TB_STORE.STORE_CN` |
| approvalStatus | string | `TB_STORE.STORE_APRV_STTS`: PENDING/APPROVED/REJECTED |
| operStatus | string | 저장값 PAUSED면 PAUSED, 나머지는 현재 시간대 안 OPEN·밖 CLOSED |
| isOpenNow | boolean | 계산한 operStatus가 OPEN인지 |
| onSaleMenuCount | integer | 삭제되지 않은 ON_SALE 메뉴 수(`TB_MENU.MENU_SALE_STTS`) |
| avgRating, reviewCount | number/null, integer | `V_STORE_RATING.AVG_RTNG`, `V_STORE_RATING.RVW_CNT`; 리뷰 0건이면 null·0 |

### 메뉴·옵션·분류 객체

| 객체 | 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|---|
| 메뉴 | menuId, categoryId, categoryName | integer, integer, string | `TB_MENU.MENU_ID`, `TB_MENU.CTGR_ID`, `TB_MENU_CTGR.CTGR_NM` |
| 메뉴 | menuName, price, description | string, integer, string/null | `TB_MENU.MENU_NM`, `TB_MENU.MENU_AMT`, `TB_MENU.MENU_CN` |
| 메뉴 | saleStatus, seq | string, integer | `TB_MENU.MENU_SALE_STTS`, `TB_MENU.MENU_SEQ` |
| 메뉴 상세 | optionGroups | 옵션 그룹[] | 삭제되지 않은 그룹을 `TB_MENU_OPT_GRP.OPT_GRP_SEQ`순 조회 |
| 메뉴 목록 항목 | optionGroupCount | integer | 삭제되지 않은 옵션 그룹 수 |
| 옵션 그룹 | optionGroupId, groupName | integer, string | `TB_MENU_OPT_GRP.OPT_GRP_ID`, `TB_MENU_OPT_GRP.OPT_GRP_NM` |
| 옵션 그룹 | required, maxSelect, seq | boolean, integer, integer | `TB_MENU_OPT_GRP.RQRD_YN='Y'`, `TB_MENU_OPT_GRP.MAX_SLCT_CNT`, `TB_MENU_OPT_GRP.OPT_GRP_SEQ` |
| 옵션 그룹 | options | 옵션[] | 삭제되지 않은 옵션을 `TB_MENU_OPT.OPT_SEQ`순 조회 |
| 옵션 | optionId, optionName, price, seq | integer, string, integer, integer | `TB_MENU_OPT.OPT_ID`, `TB_MENU_OPT.OPT_NM`, `TB_MENU_OPT.OPT_AMT`, `TB_MENU_OPT.OPT_SEQ` |
| 분류 | categoryId, categoryName, seq | integer, string, integer | `TB_MENU_CTGR.CTGR_ID`, `TB_MENU_CTGR.CTGR_NM`, `TB_MENU_CTGR.CTGR_SEQ` |
| 분류 목록 항목 | menuCount | integer | 해당 분류의 삭제되지 않은 메뉴 수 |
| 메뉴 목록 분류 | menus | 메뉴 목록 항목[] | `TB_MENU.MENU_SEQ`순. 빈 분류는 빈 배열 |

## S-01 가게 정보 조회
- method/path: `GET /api/owner/stores/{storeId}`
- 권한: OWNER (미승인 가게도 허용)
- 설명: 가게 기본 정보·영업시간·현재 영업 여부·평점을 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인의 삭제되지 않은 가게 |

### 응답
```json
{"success":true,"data":{"storeId":10,"storeName":"대학치킨","categoryCode":"CHICKEN","bizNo":"123-45-67890","telNo":"02-123-4567","address":"서울 동작구 상도로 369","addressDetail":"1층","lat":37.4963,"lng":126.9575,"hours":[{"dayOfWeek":1,"open":"11:00","close":"23:00"}],"closedDays":[0,2,3,4,5,6],"minOrderAmount":15000,"deliveryTip":3000,"cookMinutes":20,"description":"바삭한 치킨","approvalStatus":"APPROVED","operStatus":"PAUSED","isOpenNow":false,"onSaleMenuCount":5,"avgRating":4.6,"reviewCount":32}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 가게 객체 | 위 가게 객체의 전체 필드. `TB_STORE`, `TB_STORE_HOURS`, `TB_MENU`, `V_STORE_RATING` 기준 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 403 | FORBIDDEN | 다른 사장의 가게 |
| 404 | NOT_FOUND | 가게가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_MENU`, `V_STORE_RATING` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 세션·가게 소유권·가게 미삭제 확인. 승인 여부로 조회를 막지 않는다.
- 상태 변경 / VIEW·트리거: `V_STORE_RATING`으로 평점·리뷰 수 조회. CLOSED·closedDays는 계산만 하며 저장하지 않는다.

## S-02 운영 정보 수정
- method/path: `PATCH /api/owner/stores/{storeId}`
- 권한: OWNER
- 설명: 승인 정보는 유지하고 운영에 필요한 필드만 부분 수정한다. 기존 주문의 금액·배달팁·조리시간에는 영향이 없다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| body | minOrderAmount, deliveryTip | integer | X | 각각 0 이상 |
| body | cookMinutes | integer | X | 1 이상 |
| body | telNo | string | X | 가게 전화번호 |
| body | description | string/null | X | 가게 소개 |

가게명·사업자번호·주소·좌표·카테고리는 수정할 수 없으며 보내면 400이다.

### 응답
```json
{"success":true,"data":{"storeId":10,"storeName":"대학치킨","categoryCode":"CHICKEN","bizNo":"123-45-67890","telNo":"02-123-4567","address":"서울 동작구 상도로 369","addressDetail":"1층","lat":37.4963,"lng":126.9575,"hours":[{"dayOfWeek":1,"open":"11:00","close":"23:00"}],"closedDays":[0,2,3,4,5,6],"minOrderAmount":16000,"deliveryTip":3000,"cookMinutes":25,"description":"바삭한 치킨","approvalStatus":"APPROVED","operStatus":"PAUSED","isOpenNow":false,"onSaleMenuCount":5,"avgRating":4.6,"reviewCount":32}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 가게 객체 | S-01과 같은 전체 필드. 변경값은 `TB_STORE.MIN_ORD_AMT`, `TB_STORE.DLVR_TIP_AMT`, `TB_STORE.COOK_EST_MI`, `TB_STORE.STORE_TELNO`, `TB_STORE.STORE_CN` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 음수 금액·잘못된 조리시간 또는 승인 정보 수정 요청 |
| 409 | STORE_NOT_APPROVED | 미승인 가게 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_MENU`, `V_STORE_RATING` / 바꾸는 테이블: `TB_STORE`.
- 트랜잭션: 소유권·승인 확인과 보낸 운영 필드 UPDATE.
- 서버 검사: 본인 미삭제 가게·승인 상태, 수정 허용 필드 검사.
- 상태 변경 / VIEW·트리거: 응답 평점은 `V_STORE_RATING`. 수정일시는 `TRG_STORE_MOD_DTTM` 담당.

## S-03 영업 상태 변경
- method/path: `PATCH /api/owner/stores/{storeId}/oper-status`
- 권한: OWNER
- 설명: 영업을 시작하거나 일시중지한다. 이미 접수한 주문은 계속 진행한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| body | operStatus | string | O | OPEN/PAUSED만 허용. 계산값 CLOSED 입력 불가 |

### 응답
```json
{"success":true,"data":{"operStatus":"PAUSED"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| operStatus | string | 변경한 `TB_STORE.STORE_OPER_STTS`(OPEN/PAUSED). 시간대를 적용한 현재 표시 상태는 S-01 조회 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | CLOSED 등 허용되지 않은 입력 |
| 409 | STORE_NOT_APPROVED | 미승인 가게 |
| 409 | NO_MENU_ON_SALE | OPEN 요청인데 삭제되지 않은 판매중 메뉴가 없음 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU` / 바꾸는 테이블: `TB_STORE`.
- 트랜잭션: 소유권·승인·판매중 메뉴 검사와 영업 상태 UPDATE.
- 서버 검사: 본인 가게·APPROVED, OPEN 전환 시 ON_SALE 메뉴 1개 이상.
- 상태 변경 / VIEW·트리거: `TB_STORE.STORE_OPER_STTS` 변경. `TRG_STORE_MOD_DTTM` 적용. 주문 상태는 변경하지 않는다.

## S-04 영업시간 저장
- method/path: `PUT /api/owner/stores/{storeId}/hours`
- 권한: OWNER
- 설명: 가게의 영업시간 전체를 교체한다. 여러 구간으로 브레이크 타임을 표현하며 기존 주문에는 영향이 없다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| body | hours | array | O | 빈 배열 불가. 기존 시간대 전체 교체 |
| body | hours[].dayOfWeek | integer | O | 0(일)~6(토) |
| body | hours[].open | string | O | HH:mm, 00:00~23:59 |
| body | hours[].close | string | O | HH:mm, open보다 늦어야 함. 자정은 24:00 허용 |

같은 요일의 구간은 겹칠 수 없다. 없는 요일은 휴무다. 자정 넘김은 프론트가 두 요일로 나눠 전송한다. 예: 금 18:00~토 02:00은 `[{"dayOfWeek":5,"open":"18:00","close":"24:00"},{"dayOfWeek":6,"open":"00:00","close":"02:00"}]`다. 24:00은 종료에만 허용한다.

### 응답
```json
{"success":true,"data":{"storeId":10,"storeName":"대학치킨","categoryCode":"CHICKEN","bizNo":"123-45-67890","telNo":"02-123-4567","address":"서울 동작구 상도로 369","addressDetail":"1층","lat":37.4963,"lng":126.9575,"hours":[{"dayOfWeek":5,"open":"18:00","close":"24:00"},{"dayOfWeek":6,"open":"00:00","close":"02:00"}],"closedDays":[0,1,2,3,4],"minOrderAmount":15000,"deliveryTip":3000,"cookMinutes":20,"description":null,"approvalStatus":"APPROVED","operStatus":"PAUSED","isOpenNow":false,"onSaleMenuCount":5,"avgRating":4.6,"reviewCount":32}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 가게 객체 | S-01과 같은 전체 필드. hours는 새 `TB_STORE_HOURS` 행, closedDays는 그 보집합 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | INVALID_HOURS | 빈 배열·요일/시각 오류·같은 요일 구간 겹침·종료 ≤ 시작·나누지 않은 자정 넘김 |
| 409 | STORE_NOT_APPROVED | 미승인 가게 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_MENU`, `V_STORE_RATING` / 바꾸는 테이블: `TB_STORE_HOURS`.
- 트랜잭션: 전체 입력 검증 후 해당 가게의 기존 행 DELETE와 새 시간대 INSERT 전체. 실패 시 기존 시간대 유지.
- 서버 검사: 소유권·승인, 요일·정확한 HH:mm 범위·구간 정합성·최소 1개 영업구간 검사.
- 상태 변경 / VIEW·트리거: 영업시간 교체만 한다. 응답의 현재 영업 여부·휴무일 계산, 평점은 `V_STORE_RATING` 조회.

## M-01 메뉴 목록
- method/path: `GET /api/owner/stores/{storeId}/menus`
- 권한: OWNER
- 설명: 분류순·분류 안 메뉴순으로 조회한다. 빈 분류와 품절 메뉴도 반환한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |

### 응답
```json
{"success":true,"data":[{"categoryId":1,"categoryName":"대표 메뉴","seq":1,"menus":[{"menuId":101,"menuName":"후라이드치킨","price":18000,"description":"기본 치킨","saleStatus":"ON_SALE","seq":1,"optionGroupCount":2}]},{"categoryId":2,"categoryName":"음료","seq":2,"menus":[]}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | 메뉴 목록 분류 | 공통 객체 표의 categoryId·categoryName·seq·menus. `TB_MENU_CTGR.CTGR_SEQ`순 |
| data[].menus[] | 메뉴 목록 항목 | menuId·menuName·price·description·saleStatus·seq·optionGroupCount. `TB_MENU.MENU_SEQ`순 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | STORE_NOT_APPROVED | 미승인 가게 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 본인 미삭제 가게·승인, 분류·메뉴·그룹의 가게 관계와 미삭제 여부.
- 상태 변경 / VIEW·트리거: 없음. 그룹 수는 삭제되지 않은 행만 집계한다.

## M-02 메뉴 상세 (옵션 포함)
- method/path: `GET /api/owner/stores/{storeId}/menus/{menuId}`
- 권한: OWNER
- 설명: 메뉴와 옵션 그룹·옵션을 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, menuId | integer | O | 본인 가게와 그 가게의 미삭제 메뉴 |

### 응답
```json
{"success":true,"data":{"menuId":101,"categoryId":1,"categoryName":"대표 메뉴","menuName":"후라이드치킨","price":18000,"description":"기본 치킨","saleStatus":"ON_SALE","seq":1,"optionGroups":[{"optionGroupId":501,"groupName":"부위 선택","required":true,"maxSelect":1,"seq":1,"options":[{"optionId":9001,"optionName":"뼈","price":0,"seq":1}]}]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 메뉴 상세 | 공통 객체 표의 메뉴 전체 필드와 optionGroups. `TB_MENU`, `TB_MENU_CTGR` 기준 |
| optionGroups[], optionGroups[].options[] | 옵션 그룹, 옵션 | 공통 객체 표의 전체 필드. `TB_MENU_OPT_GRP`, `TB_MENU_OPT` 기준 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 403 | FORBIDDEN | 메뉴의 가게 불일치 |
| 404 | NOT_FOUND | 메뉴가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 가게 소유권·승인, 메뉴·분류·옵션 관계 및 미삭제 여부.
- 상태 변경 / VIEW·트리거: 없음. 그룹·옵션은 각각 저장 순서로 정렬한다.

## M-03 메뉴 등록
- method/path: `POST /api/owner/stores/{storeId}/menus`
- 권한: OWNER
- 설명: 기존 분류에 판매중 메뉴를 등록한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| body | categoryId | integer | O | 이 가게의 미삭제 `TB_MENU_CTGR.CTGR_ID` |
| body | menuName | string | O | 1~50자 |
| body | price | integer | O | 0 이상 |
| body | description | string/null | X | 최대 300자 |
| body | seq | integer | X | 분류 안 순서. 생략 시 해당 분류의 마지막 순서 + 1 |

### 응답
201
```json
{"success":true,"data":{"menuId":101,"categoryId":1,"categoryName":"대표 메뉴","menuName":"후라이드치킨","price":18000,"description":null,"saleStatus":"ON_SALE","seq":1,"optionGroups":[]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 메뉴 상세 | M-02의 전체 필드. 생성한 `TB_MENU` 행, `TB_MENU_CTGR.CTGR_NM`; optionGroups는 빈 배열 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 다른 가게·삭제된 분류, 잘못된 이름·가격·순서 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU` / 바꾸는 테이블: `TB_MENU`.
- 트랜잭션: 분류·순서 검사와 메뉴 INSERT.
- 서버 검사: 소유권·승인, categoryId가 해당 가게의 미삭제 분류인지 검사.
- 상태 변경 / VIEW·트리거: `TB_MENU.MENU_SALE_STTS='ON_SALE'`, `TB_MENU.CTGR_ID`로 분류 연결. 옵션은 별도 API로 등록.

## M-04 메뉴 수정
- method/path: `PATCH /api/owner/stores/{storeId}/menus/{menuId}`
- 권한: OWNER
- 설명: 메뉴를 부분 수정하거나 같은 가게의 다른 분류로 옮긴다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, menuId | integer | O | 본인 가게·미삭제 메뉴 |
| body | categoryId | integer | X | 같은 가게의 미삭제 분류 |
| body | menuName | string | X | 1~50자 |
| body | price | integer | X | 0 이상 |
| body | description | string/null | X | 최대 300자 |
| body | seq | integer | X | 메뉴 순서 |

### 응답
```json
{"success":true,"data":{"menuId":101,"categoryId":2,"categoryName":"추천 메뉴","menuName":"후라이드치킨","price":19000,"description":null,"saleStatus":"ON_SALE","seq":1,"optionGroups":[]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 메뉴 상세 | M-02의 전체 필드. 수정한 `TB_MENU`와 연결 분류·미삭제 그룹·옵션 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 이동할 분류가 다른 가게 소속·삭제됨 또는 필드 제약 위반 |
| 403 | FORBIDDEN | 수정 대상 메뉴가 다른 가게 소속 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU`.
- 트랜잭션: 메뉴·대상 분류 검사와 보낸 필드 UPDATE.
- 서버 검사: 가게 소유권·승인, 메뉴와 새 분류가 같은 가게의 미삭제 자원인지 검사.
- 상태 변경 / VIEW·트리거: 수정일시는 `TRG_MENU_MOD_DTTM`. 주문 당시 메뉴명·단가 스냅샷은 유지.

## M-05 메뉴 삭제
- method/path: `DELETE /api/owner/stores/{storeId}/menus/{menuId}`
- 권한: OWNER
- 설명: 메뉴와 하위 옵션 그룹·옵션을 함께 논리 삭제한다. 주문 이력은 유지한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, menuId | integer | O | 본인 가게·미삭제 메뉴 |

### 응답
```json
{"success":true,"data":null}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | null | 삭제 완료. 반환 객체 없음 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 403 | FORBIDDEN | 메뉴 소속 가게 불일치 |
| 404 | NOT_FOUND | 메뉴가 없거나 이미 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`.
- 트랜잭션: 메뉴와 그 하위 그룹·옵션의 `DEL_YN='Y'` UPDATE 전체.
- 서버 검사: 소유권·승인, 메뉴 소속과 하위 관계 확인. 논리 삭제 연쇄는 FK가 아니라 서버가 수행.
- 상태 변경 / VIEW·트리거: `TRG_MENU_MOD_DTTM`, `TRG_MENU_OPT_GRP_MOD_DTTM`, `TRG_MENU_OPT_MOD_DTTM` 적용. 장바구니 실물 행은 유지하되 고객 조회·주문 시 판매 불가 검사.

> 미정(Q): 마지막 판매중 메뉴 삭제 후 가게를 자동 PAUSED로 전환할지는 원본에서 미확정이다. 아래 M-06 품절 처리에도 같은 질문이 적용된다.

## M-06 판매 상태 변경 (품절·판매 재개)
- method/path: `PATCH /api/owner/stores/{storeId}/menus/{menuId}/sale-status`
- 권한: OWNER
- 설명: 메뉴의 품절·판매 재개 상태를 바꾼다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, menuId | integer | O | 본인 가게·미삭제 메뉴 |
| body | saleStatus | string | O | ON_SALE/SOLD_OUT |

### 응답
```json
{"success":true,"data":{"menuId":101,"saleStatus":"SOLD_OUT"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| menuId, saleStatus | integer, string | `TB_MENU.MENU_ID`, `TB_MENU.MENU_SALE_STTS` |


### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 허용되지 않은 판매 상태 |
| 404 | NOT_FOUND | 메뉴가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU` / 바꾸는 테이블: `TB_MENU` (자동 영업중지 여부는 미정).
- 트랜잭션: 소유권·승인·메뉴 검사와 판매 상태 UPDATE.
- 서버 검사: 같은 가게의 미삭제 메뉴만 허용. 장바구니·신규 주문의 판매 가능 여부는 고객 API에서 재검사.
- 상태 변경 / VIEW·트리거: `TB_MENU.MENU_SALE_STTS` 변경, `TRG_MENU_MOD_DTTM` 적용. 기존 주문은 변경하지 않는다.

## M-07 옵션 그룹 등록
- method/path: `POST /api/owner/stores/{storeId}/menus/{menuId}/option-groups`
- 권한: OWNER
- 설명: 옵션 그룹과 초기 옵션을 한 번에 등록한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, menuId | integer | O | 본인 가게·미삭제 메뉴 |
| body | groupName | string | O | 그룹명 |
| body | required | boolean | O | 필수 선택 여부. 저장 시 Y/N 변환 |
| body | maxSelect | integer | O | 1 이상. 옵션 수보다 커도 허용 |
| body | seq | integer | X | 생략 시 메뉴 내 마지막 그룹 순서 + 1 |
| body | options | array | X | 함께 생성할 옵션. 생략 시 빈 배열 |
| body | options[].optionName | string | O | 옵션명 |
| body | options[].price | integer | O | 0 이상. 배열 순서대로 옵션 순서 지정 |

### 응답
201
```json
{"success":true,"data":{"optionGroupId":501,"groupName":"부위 선택","required":true,"maxSelect":1,"seq":1,"options":[{"optionId":9001,"optionName":"뼈","price":0,"seq":1}]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 옵션 그룹 | 공통 객체 표의 전체 그룹 필드. 생성한 `TB_MENU_OPT_GRP` 행과 `TB_MENU_OPT` 행 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | maxSelect < 1, 잘못된 옵션명·금액 |
| 404 | NOT_FOUND | 상위 메뉴가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP` / 바꾸는 테이블: `TB_MENU_OPT_GRP`, `TB_MENU_OPT`.
- 트랜잭션: 부모 메뉴 검사, 그룹 INSERT와 모든 초기 옵션 INSERT. 하나라도 실패하면 전체 취소.
- 서버 검사: 가게 소유권·승인, 메뉴 소속·미삭제, 각 옵션 입력 검사. maxSelect가 옵션 수보다 크다는 이유로 거절하지 않는다.
- 상태 변경 / VIEW·트리거: required를 `TB_MENU_OPT_GRP.RQRD_YN`으로 변환. 그룹·옵션은 `DEL_YN='N'`으로 생성.

## M-08 옵션 그룹 수정
- method/path: `PATCH /api/owner/stores/{storeId}/option-groups/{groupId}`
- 권한: OWNER
- 설명: 그룹 속성만 부분 수정한다. 옵션은 별도 API로 관리한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, groupId | integer | O | 본인 가게·미삭제 메뉴 아래 그룹. groupId는 옵션 그룹 ID |
| body | groupName | string | X | 그룹명 |
| body | required | boolean | X | 필수 여부 |
| body | maxSelect | integer | X | 1 이상. 옵션 수보다 커도 허용 |
| body | seq | integer | X | 메뉴 내 그룹 순서 |

### 응답
```json
{"success":true,"data":{"optionGroupId":501,"groupName":"부위 선택","required":false,"maxSelect":1,"seq":1,"options":[{"optionId":9001,"optionName":"뼈","price":0,"seq":1}]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | 옵션 그룹 | 공통 객체 표의 전체 필드. 수정한 `TB_MENU_OPT_GRP`와 미삭제 `TB_MENU_OPT` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | maxSelect < 1 또는 타입·필드 오류 |
| 403 | FORBIDDEN | 그룹 → 메뉴 → 가게 소속 불일치 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU_OPT_GRP`.
- 트랜잭션: 소속·미삭제 검사와 보낸 그룹 필드 UPDATE.
- 서버 검사: 그룹과 상위 메뉴가 본인 가게의 미삭제 자원인지 확인.
- 상태 변경 / VIEW·트리거: `TRG_MENU_OPT_GRP_MOD_DTTM` 적용. 옵션 행은 바꾸지 않는다.

## M-09 옵션 그룹 삭제
- method/path: `DELETE /api/owner/stores/{storeId}/option-groups/{groupId}`
- 권한: OWNER
- 설명: 필수 여부와 관계없이 그룹 전체와 하위 옵션을 논리 삭제한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, groupId | integer | O | 본인 가게·미삭제 그룹 |

### 응답
```json
{"success":true,"data":null}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | null | 그룹·하위 옵션 삭제 완료 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 403 | FORBIDDEN | 그룹의 메뉴가 다른 가게 소속 |
| 404 | NOT_FOUND | 그룹·상위 메뉴가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU_OPT_GRP`, `TB_MENU_OPT`.
- 트랜잭션: 소유권 검사와 그룹·하위 옵션 `DEL_YN='Y'` UPDATE 전체.
- 서버 검사: 가게 소유권·승인, 부모 관계 검사. M-12의 마지막 옵션 제한은 그룹 전체 삭제에는 적용하지 않는다.
- 상태 변경 / VIEW·트리거: 하위 논리 삭제는 서버 담당. `TRG_MENU_OPT_GRP_MOD_DTTM`, `TRG_MENU_OPT_MOD_DTTM` 적용. 주문 스냅샷 유지.

## M-10 옵션 등록
- method/path: `POST /api/owner/stores/{storeId}/option-groups/{groupId}/options`
- 권한: OWNER
- 설명: 옵션 그룹에 옵션 하나를 추가한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, groupId | integer | O | 본인 가게·미삭제 그룹 |
| body | optionName | string | O | 옵션명 |
| body | price | integer | O | 0 이상 |
| body | seq | integer | X | 생략 시 그룹 내 마지막 옵션 순서 + 1 |

### 응답
201
```json
{"success":true,"data":{"optionId":9002,"optionName":"순살","price":2000,"seq":2}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| optionId, optionName, price, seq | integer, string, integer, integer | 생성한 `TB_MENU_OPT.OPT_ID`, `TB_MENU_OPT.OPT_NM`, `TB_MENU_OPT.OPT_AMT`, `TB_MENU_OPT.OPT_SEQ` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 옵션명·금액·순서 오류 |
| 404 | NOT_FOUND | 그룹·상위 메뉴가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU_OPT`.
- 트랜잭션: 그룹·메뉴 소속 검사, 기본 순서 계산과 옵션 INSERT.
- 서버 검사: 그룹 → 메뉴 → 본인 가게 관계와 미삭제·승인 확인.
- 상태 변경 / VIEW·트리거: `TB_MENU_OPT.DEL_YN='N'`으로 생성. 주문 이력은 유지.

## M-11 옵션 수정
- method/path: `PATCH /api/owner/stores/{storeId}/options/{optionId}`
- 권한: OWNER
- 설명: 옵션명·가격·순서를 부분 수정한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, optionId | integer | O | 본인 가게·미삭제 옵션 |
| body | optionName | string | X | 옵션명 |
| body | price | integer | X | 0 이상 |
| body | seq | integer | X | 그룹 내 순서 |

### 응답
```json
{"success":true,"data":{"optionId":9002,"optionName":"순살","price":2500,"seq":2}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| optionId, optionName, price, seq | integer, string, integer, integer | 수정한 `TB_MENU_OPT.OPT_ID`, `TB_MENU_OPT.OPT_NM`, `TB_MENU_OPT.OPT_AMT`, `TB_MENU_OPT.OPT_SEQ` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 옵션명·금액·순서 오류 |
| 403 | FORBIDDEN | 옵션의 상위 메뉴가 다른 가게 소속 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU_OPT`.
- 트랜잭션: 상위 관계 확인과 보낸 옵션 필드 UPDATE.
- 서버 검사: 옵션 → 그룹 → 메뉴 → 본인 가게 관계, 각 행 미삭제·가게 승인 확인.
- 상태 변경 / VIEW·트리거: `TRG_MENU_OPT_MOD_DTTM` 적용. 주문 당시 옵션명·금액은 변경하지 않는다.

## M-12 옵션 삭제
- method/path: `DELETE /api/owner/stores/{storeId}/options/{optionId}`
- 권한: OWNER
- 설명: 옵션을 논리 삭제한다. 필수 그룹의 마지막 미삭제 옵션은 삭제할 수 없다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, optionId | integer | O | 본인 가게·미삭제 옵션 |

### 응답
```json
{"success":true,"data":null}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | null | 옵션 삭제 완료 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | REQUIRED_GROUP_EMPTY | `TB_MENU_OPT_GRP.RQRD_YN='Y'`인 그룹의 마지막 미삭제 옵션 |
| 404 | NOT_FOUND | 옵션·상위 자원이 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_MENU_OPT`.
- 트랜잭션: 상위 소속·필수 여부·남은 옵션 수 검사와 옵션 논리 삭제.
- 서버 검사: 본인 가게·승인·미삭제 관계 확인, 같은 그룹의 남은 옵션 수를 트랜잭션 안에서 검사.
- 상태 변경 / VIEW·트리거: `TB_MENU_OPT.DEL_YN='Y'`, `TRG_MENU_OPT_MOD_DTTM` 적용. 그룹 전체 삭제는 M-09 사용.

## M-13 메뉴 순서·분류 일괄 변경
- method/path: `PATCH /api/owner/stores/{storeId}/menus/order`
- 권한: OWNER
- 설명: 분류 순서와 메뉴 분류·순서를 한 번에 저장한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| body | categories | array | X | 분류 순서 변경 목록 |
| body | categories[].categoryId, categories[].seq | integer | O | 본인 가게의 미삭제 분류 ID·순서 |
| body | items | array | O | 변경할 메뉴 목록 |
| body | items[].menuId, items[].categoryId, items[].seq | integer | O | 본인 가게의 미삭제 메뉴 ID·이동할 분류 ID·순서 |

예: `{"categories":[{"categoryId":3,"seq":1},{"categoryId":1,"seq":2}],"items":[{"menuId":101,"categoryId":1,"seq":1}]}`.

### 응답
```json
{"success":true,"data":[{"categoryId":3,"categoryName":"음료","seq":1,"menus":[]},{"categoryId":1,"categoryName":"대표 메뉴","seq":2,"menus":[{"menuId":101,"menuName":"후라이드치킨","price":18000,"description":null,"saleStatus":"ON_SALE","seq":1,"optionGroupCount":0}]}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | 메뉴 목록 분류 | M-01의 전체 필드. 변경 후 `TB_MENU_CTGR.CTGR_SEQ`, `TB_MENU.CTGR_ID`, `TB_MENU.MENU_SEQ` 반영 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·순서 형식 오류 |
| 403 | FORBIDDEN | 메뉴 또는 분류가 다른 가게 소속 |
| 404 | NOT_FOUND | 변경 대상이 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP` / 바꾸는 테이블: `TB_MENU_CTGR`, `TB_MENU`.
- 트랜잭션: 전체 목록의 소속·미삭제 검사 후 분류 순서와 메뉴 분류·순서 UPDATE 전체. 일부 실패 시 전체 롤백.
- 서버 검사: 모든 메뉴·분류와 이동 대상 분류가 해당 가게 소속인지 검사.
- 상태 변경 / VIEW·트리거: `TRG_MENU_CTGR_MOD_DTTM`, `TRG_MENU_MOD_DTTM` 적용. 옵션 순서는 변경하지 않는다.

## M-14 메뉴 분류 목록
- method/path: `GET /api/owner/stores/{storeId}/menu-categories`
- 권한: OWNER
- 설명: 미삭제 분류와 각 분류의 미삭제 메뉴 수를 순서대로 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |

### 응답
```json
{"success":true,"data":[{"categoryId":1,"categoryName":"대표 메뉴","seq":1,"menuCount":2},{"categoryId":3,"categoryName":"음료","seq":2,"menuCount":0}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | 분류 목록 항목 | 공통 객체 표의 categoryId·categoryName·seq·menuCount. `TB_MENU_CTGR`와 미삭제 `TB_MENU` 집계 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | STORE_NOT_APPROVED | 미승인 가게 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 본인 가게·승인·미삭제, 해당 가게의 미삭제 분류만 조회.
- 상태 변경 / VIEW·트리거: 없음. `TB_MENU_CTGR.CTGR_SEQ`순, 빈 분류도 포함.

## M-15 메뉴 분류 등록
- method/path: `POST /api/owner/stores/{storeId}/menu-categories`
- 권한: OWNER
- 설명: 가게 안에서 이름이 중복되지 않는 분류를 등록한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| body | categoryName | string | O | 1~50자. 미삭제 분류끼리 같은 가게 안 이름 중복 불가 |
| body | seq | integer | X | 생략 시 마지막 분류 순서 + 1 |

### 응답
201
```json
{"success":true,"data":[{"categoryId":1,"categoryName":"대표 메뉴","seq":1,"menuCount":2},{"categoryId":3,"categoryName":"음료","seq":2,"menuCount":0}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | 분류 목록 항목 | M-14의 전체 목록·필드. 새 `TB_MENU_CTGR` 행 포함 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | DUPLICATE_CATEGORY | 같은 가게의 미삭제 분류명 중복 |
| 400 | VALIDATION_ERROR | 분류명·순서 오류 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU` / 바꾸는 테이블: `TB_MENU_CTGR`.
- 트랜잭션: 중복 검사·기본 순서 계산과 분류 INSERT.
- 서버 검사: 소유권·승인, 같은 가게의 미삭제 분류 이름 중복 검사.
- 상태 변경 / VIEW·트리거: `TB_MENU_CTGR.CTGR_NM`, `TB_MENU_CTGR.CTGR_SEQ` 저장. 부분 UNIQUE 인덱스도 중복 방어.

## M-16 메뉴 분류 수정
- method/path: `PATCH /api/owner/stores/{storeId}/menu-categories/{categoryId}`
- 권한: OWNER
- 설명: 분류명·순서를 부분 수정한다. 연결 메뉴는 분류 ID를 유지한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, categoryId | integer | O | 본인 가게·미삭제 분류 |
| body | categoryName | string | X | 1~50자, 같은 가게의 다른 미삭제 분류명과 중복 불가 |
| body | seq | integer | X | 분류 순서. 여러 분류 변경은 M-13 |

### 응답
```json
{"success":true,"data":[{"categoryId":1,"categoryName":"추천 메뉴","seq":1,"menuCount":2}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | 분류 목록 항목 | M-14의 전체 목록·필드. 수정한 `TB_MENU_CTGR` 값 반영 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | DUPLICATE_CATEGORY | 같은 가게의 다른 미삭제 분류명과 중복 |
| 403 | FORBIDDEN | 분류의 가게 소속 불일치 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU` / 바꾸는 테이블: `TB_MENU_CTGR`.
- 트랜잭션: 대상 소속·중복 검사와 보낸 필드 UPDATE.
- 서버 검사: 소유권·승인·분류 미삭제, 중복 검사에서 자기 분류 제외.
- 상태 변경 / VIEW·트리거: 분류 행만 수정하며 메뉴 행은 그대로. `TRG_MENU_CTGR_MOD_DTTM` 적용.

## M-17 메뉴 분류 삭제
- method/path: `DELETE /api/owner/stores/{storeId}/menu-categories/{categoryId}`
- 권한: OWNER
- 설명: 미삭제 메뉴가 없는 분류만 논리 삭제한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, categoryId | integer | O | 본인 가게·미삭제 분류 |

### 응답
```json
{"success":true,"data":null}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | null | 분류 삭제 완료 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | CATEGORY_NOT_EMPTY | 분류에 삭제되지 않은 메뉴가 남아 있음 |
| 404 | NOT_FOUND | 분류가 없거나 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU` / 바꾸는 테이블: `TB_MENU_CTGR`.
- 트랜잭션: 분류 소속·남은 미삭제 메뉴 검사와 논리 삭제 UPDATE.
- 서버 검사: 소유권·승인, 같은 `TB_MENU.CTGR_ID`의 미삭제 메뉴가 0건인지 검사. 먼저 메뉴를 이동하거나 삭제해야 한다.
- 상태 변경 / VIEW·트리거: `TB_MENU_CTGR.DEL_YN='Y'`, `TRG_MENU_CTGR_MOD_DTTM` 적용. 주문 스냅샷 유지.

## O-01 주문 목록
- method/path: `GET /api/owner/stores/{storeId}/orders`
- 권한: OWNER
- 설명: 주문 상태별 목록을 조회한다. 화면은 5초마다 폴링한다. 조회 전에 만료된 WAIT 주문 자동 취소를 실행한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| query | status | string | O | WAIT/COOKING/READY/DELIVERING/DONE/CANCEL. 쉼표로 복수 지정(예: READY,DELIVERING) |
| query | date | string | X | YYYY-MM-DD, 기본 오늘. DONE·CANCEL의 주문일 기준 필터. 진행중 상태는 날짜와 무관하게 조회 |

### 응답
```json
{"success":true,"data":[{"orderId":3021,"orderedAt":"2026-11-18 18:02:11","status":"WAIT","elapsedMinutes":3,"autoCancelAt":"2026-11-18 18:12:11","summary":"후라이드치킨 외 1건","itemCount":2,"orderTotal":21000,"deliveryTip":3000,"payAmount":24000,"deliveryAddress":"서울 동작구 상도로 300","distance":1200,"riderName":null}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | object | 페이지 없는 주문 배열. WAIT은 오래된 순, 그 외 최신순 |
| orderId, orderedAt, status | integer, string, string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_DTTM`, `TB_ORD.ORD_STTS` |
| elapsedMinutes, autoCancelAt | integer, string/null | 주문 후 경과 분, WAIT이면 `TB_ORD.ORD_DTTM + 10분`·그 외 null |
| summary, itemCount | string, integer | `TB_ORD_DTL.ORD_DTL_SEQ` 첫 메뉴명 + 나머지 상세 건수, 상세 행 수 |
| orderTotal, deliveryTip, payAmount | integer | `TB_ORD.ORD_TOT_AMT`, `TB_ORD.DLVR_TIP_AMT`, `TB_PAY.PAY_AMT` |
| deliveryAddress, distance | string, integer | `TB_ORD.DLVR_ADDR`, 가게 좌표와 주문 배송 좌표 사이 거리(m)를 서버 계산 |
| riderName | string/null | `TB_DLVR.RIDER_MBR_ID`로 연결한 `TB_MBR.MBR_NM`. 미배차면 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 상태 코드·날짜 오류 |
| 409 | STORE_NOT_APPROVED | 미승인 가게 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(주문 외 변경은 취소 트리거).
- 트랜잭션: 권한 검사 후 만료 WAIT의 자동 취소를 먼저 커밋하고 결과 목록을 조회한다.
- 서버 검사: 본인 가게·승인, 상태·날짜 필터. 자동 취소 조건은 `WAIT`와 주문일시 + 10분 경과이며 현재 상태를 조건으로 UPDATE한다.
- 상태 변경 / VIEW·트리거: 자동 취소는 `TB_ORD.CNCL_ACTR_CD='SYSTEM'`, `TB_ORD.CNCL_RSN_CD='NO_RESPONSE'`, `TB_ORD.ORD_CNCL_DTTM=현재 일시` 기록. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 수정일시는 각 수정일시 트리거 담당.

## O-02 주문 상세 (주문서)
- method/path: `GET /api/owner/stores/{storeId}/orders/{orderId}`
- 권한: OWNER
- 설명: 주문 당시 스냅샷으로 주문서를 조회한다. 고객 이름·전화번호는 제공하지 않는다. 조회 전에 만료 WAIT 자동 취소를 실행한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, orderId | integer | O | 본인 가게·그 가게 주문 |

### 응답
```json
{"success":true,"data":{"orderId":3021,"orderedAt":"2026-11-18 18:02:11","status":"WAIT","items":[{"menuName":"후라이드치킨","quantity":1,"unitPrice":18000,"options":[{"groupName":"부위 선택","optionName":"순살","price":2000}],"lineTotal":20000}],"storeRequest":"맵게 해주세요","riderRequest":"문 앞에 두고 벨","cutlery":false,"deliveryAddress":"서울 동작구 상도로 300","deliveryAddressDetail":"101호","distance":1200,"orderTotal":20000,"deliveryTip":3000,"payAmount":23000,"payMethod":"CARD","acceptedAt":null,"cookMinutes":null,"canceledAt":null,"cancelActor":null,"cancelReason":null,"cancelReasonDetail":null,"rider":null}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, orderedAt, status | integer, string, string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_DTTM`, `TB_ORD.ORD_STTS` |
| items | array | `TB_ORD_DTL.ORD_DTL_SEQ`순 |
| items[].menuName, items[].quantity, items[].unitPrice | string, integer, integer | `TB_ORD_DTL.ORD_MENU_NM`, `TB_ORD_DTL.ORD_QTY`, `TB_ORD_DTL.ORD_UPRC` |
| items[].options[].groupName, items[].options[].optionName, items[].options[].price | string, string, integer | `TB_ORD_DTL_OPT.ORD_OPT_GRP_NM`, `TB_ORD_DTL_OPT.ORD_OPT_NM`, `TB_ORD_DTL_OPT.ORD_OPT_AMT` |
| items[].lineTotal | integer | `(TB_ORD_DTL.ORD_UPRC + 해당 상세 옵션금액 합) × TB_ORD_DTL.ORD_QTY` |
| storeRequest, riderRequest, cutlery | string/null, string/null, boolean | `TB_ORD.STORE_RQST_CN`, `TB_ORD.RIDER_RQST_CN`, `TB_ORD.CUTLERY_YN='Y'` |
| deliveryAddress, deliveryAddressDetail, distance | string, string/null, integer | `TB_ORD.DLVR_ADDR`, `TB_ORD.DLVR_DADDR`, 가게 좌표와 `TB_ORD.DLVR_LAT`·`TB_ORD.DLVR_LNG` 사이 거리(m) |
| orderTotal, deliveryTip, payAmount, payMethod | integer, integer, integer, string | `TB_ORD.ORD_TOT_AMT`, `TB_ORD.DLVR_TIP_AMT`, `TB_PAY.PAY_AMT`, `TB_PAY.PAY_MTHD_CD` |
| acceptedAt, cookMinutes | string/null, integer/null | `TB_ORD.ORD_RCPT_DTTM`, `TB_ORD.COOK_EST_MI` |
| canceledAt, cancelActor, cancelReason, cancelReasonDetail | string/null | `TB_ORD.ORD_CNCL_DTTM`, `TB_ORD.CNCL_ACTR_CD`, `TB_ORD.CNCL_RSN_CD`, `TB_ORD.ORD_CNCL_RSN_CN` |
| rider | object/null | 미배차면 null |
| rider.name, rider.vehicle | string, string | 라이더 `TB_MBR.MBR_NM`, `TB_RIDER.VHCL_TYPE_CD` |
| rider.dispatchedAt, rider.pickedUpAt | string, string/null | `TB_DLVR.DSPCH_DTTM`, `TB_DLVR.PKUP_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 403 | FORBIDDEN | 주문의 가게 소속 불일치 |
| 404 | NOT_FOUND | 주문 없음 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_RIDER`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_ORD_DTL_OPT`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(주문 외 변경은 취소 트리거).
- 트랜잭션: 가게·주문 권한 검사 후 만료 WAIT 자동 취소를 먼저 커밋하고 상세 조회.
- 서버 검사: 본인 미삭제 가게·승인, 주문이 해당 가게 소속인지 확인. 라이더는 배달 행의 배차 회원으로만 연결.
- 상태 변경 / VIEW·트리거: 만료 주문은 SYSTEM/NO_RESPONSE와 취소일시 기록. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 현재 메뉴를 조회해 주문 스냅샷을 덮어쓰지 않는다.

## O-03 주문 접수
- method/path: `POST /api/owner/stores/{storeId}/orders/{orderId}/accept`
- 권한: OWNER
- 설명: 만료되지 않은 WAIT 주문을 접수하고 라이더 배차 요청용 배달 행을 생성한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, orderId | integer | O | 본인 가게·주문 |
| body | cookMinutes | integer | O | 1 이상. 이 주문의 조리 예상분. 화면 기본값은 가게 기본 조리시간 |

### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"COOKING","acceptedAt":"2026-11-18 18:05:40","cookMinutes":25}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, status, acceptedAt, cookMinutes | integer, string, string, integer | `TB_ORD.ORD_ID`, `TB_ORD.ORD_STTS`, `TB_ORD.ORD_RCPT_DTTM`, `TB_ORD.COOK_EST_MI` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | cookMinutes가 양의 정수가 아님 |
| 409 | ORDER_ALREADY_PROCESSED | WAIT가 아니거나 주문일시 + 10분 경과, 조건부 UPDATE 결과 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`, `TB_DLVR`; 만료 시 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(취소 트리거).
- 트랜잭션: 소유권·승인·만료 검사, 조건부 `WAIT → COOKING` UPDATE와 `TB_DLVR` INSERT를 하나로 처리. INSERT 실패 시 접수도 롤백한다.
- 서버 검사: 해당 가게 주문·현재 WAIT, 트랜잭션 안 현재 시각으로 10분 만료 검사. 만료라면 SYSTEM/NO_RESPONSE 취소를 커밋한 뒤 409를 반환하며 오류 때문에 자동 취소를 롤백하지 않는다.
- 상태 변경 / VIEW·트리거: 미만료 WAIT에만 `TB_ORD.ORD_STTS='COOKING'`, `TB_ORD.ORD_RCPT_DTTM=현재 일시`, `TB_ORD.COOK_EST_MI=cookMinutes` 기록. `TB_DLVR.ORD_ID`를 연결하고 `TB_DLVR.RIDER_MBR_ID`, 배차·픽업·완료 일시는 NULL로 생성. 이때부터 라이더 배차 목록에 노출된다. 만료 취소는 `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 수정일시는 `TRG_ORD_MOD_DTTM` 담당.

## O-04 주문 거절
- method/path: `POST /api/owner/stores/{storeId}/orders/{orderId}/reject`
- 권한: OWNER
- 설명: 만료되지 않은 WAIT 주문을 사장 사유로 거절한다. 선택한 메뉴를 함께 품절 처리할 수 있다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, orderId | integer | O | 본인 가게·주문 |
| body | reason | string | O | OUT_OF_STOCK/BUSY/CLOSING/ETC |
| body | reasonDetail | string | ETC일 때 O | 기타 사유 상세. ETC이면 공백만 입력 불가 |
| body | soldOutMenuIds | integer[] | X | 재료 소진 시 함께 SOLD_OUT으로 바꿀 본인 가게의 미삭제 메뉴 ID |

### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"CANCEL","canceledAt":"2026-11-18 18:05:40"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, status, canceledAt | integer, string, string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_STTS`, `TB_ORD.ORD_CNCL_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 허용되지 않은 사유·ETC 상세 누락·품절 목록 형식 오류 |
| 403 | FORBIDDEN | 주문 또는 품절 대상 메뉴가 다른 가게 소속 |
| 409 | ORDER_ALREADY_PROCESSED | WAIT가 아님·10분 만료·조건부 UPDATE 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_MENU`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`, `TB_MENU`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(주문·메뉴 외 변경은 취소 트리거).
- 트랜잭션: 소유권·승인·만료 검사 후 미만료 WAIT 조건부 취소와 품절 메뉴 UPDATE 전체. 실패 시 전체 롤백. 만료는 SYSTEM/NO_RESPONSE 취소만 커밋하고 409 반환(메뉴 품절 변경 없음).
- 서버 검사: 주문과 soldOutMenuIds가 해당 가게 소속인지, 각 메뉴 미삭제 여부 검사. 만료 여부와 현재 상태를 같은 트랜잭션 안에서 확인.
- 상태 변경 / VIEW·트리거: `WAIT → CANCEL`, `TB_ORD.CNCL_ACTR_CD='OWNER'`, 사유·상세·취소일시 기록. 접수일시·조리 예상분은 NULL 유지. 선택 메뉴는 `TB_MENU.MENU_SALE_STTS='SOLD_OUT'`. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 수정일시는 각 수정일시 트리거 담당.

## O-05 조리 완료
- method/path: `POST /api/owner/stores/{storeId}/orders/{orderId}/cooked`
- 권한: OWNER
- 설명: COOKING 주문을 READY(조리완료·픽업대기)로 바꾼다. 배차된 라이더는 이후 픽업할 수 있다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, orderId | integer | O | 본인 가게·주문. 본문 없음 |

### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"READY"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, status | integer, string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_STTS` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | ORDER_ALREADY_PROCESSED | 현재 COOKING이 아니거나 조건부 UPDATE 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`.
- 트랜잭션: 소유권·승인·주문↔배달 관계 검사와 COOKING 조건부 UPDATE.
- 서버 검사: 본인 가게 주문·COOKING, 접수 때 생성한 배달 행이 있고 아직 픽업·완료되지 않았는지 확인. 라이더 배차 전에도 가능.
- 상태 변경 / VIEW·트리거: `COOKING → READY`, `TRG_ORD_MOD_DTTM` 적용. 배달 행을 새로 만들거나 배차·픽업 일시를 기록하지 않는다. 미배차면 기존 배차 대기 유지.

## O-06 조리중 취소
- method/path: `POST /api/owner/stores/{storeId}/orders/{orderId}/cancel`
- 권한: OWNER
- 설명: COOKING 주문만 취소한다. READY 이후는 사장이 취소할 수 없다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, orderId | integer | O | 본인 가게·주문 |
| body | reason | string | O | OUT_OF_STOCK/CANNOT_COOK/ETC |
| body | reasonDetail | string | ETC일 때 O | 사유 상세. ETC이면 공백만 입력 불가 |

### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"CANCEL","canceledAt":"2026-11-18 18:15:40"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, status, canceledAt | integer, string, string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_STTS`, `TB_ORD.ORD_CNCL_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 허용되지 않은 사유·ETC 상세 누락 |
| 409 | ORDER_ALREADY_PROCESSED | COOKING이 아님(READY 포함) 또는 조건부 UPDATE 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(주문 외 변경은 취소 트리거).
- 트랜잭션: 소유권·승인·COOKING·배달 관계 검사와 조건부 취소 UPDATE, 트리거의 연쇄 처리 전체.
- 서버 검사: 해당 가게 주문·현재 COOKING, 배달 행 존재·미픽업·미완료 확인. 조건부 UPDATE 결과가 0행이면 409.
- 상태 변경 / VIEW·트리거: `COOKING → CANCEL`, `TB_ORD.CNCL_ACTR_CD='OWNER'`, 사유·상세·취소일시 기록. 접수일시·조리 예상분 유지. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 배달 행·이력은 보존하며 가짜 완료일시를 기록하지 않는다.

## R-01 리뷰 목록
- method/path: `GET /api/owner/stores/{storeId}/reviews`
- 권한: OWNER
- 설명: 내 가게 주문의 미삭제 리뷰를 최신순으로 조회한다. 숨김 리뷰는 사장에게 표시하되 답글·신고 변경은 불가하다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| query | noReply | boolean | X | true면 미삭제 답글 없는 리뷰만 |
| query | page, size | integer | X | 기본 1·20, size 최대 100 |

### 응답
```json
{"success":true,"data":{"avgRating":4.6,"reviewCount":32,"items":[{"reviewId":701,"orderId":2990,"writerName":"김**","rating":5,"content":"맛있어요","createdAt":"2026-11-17 20:11:03","orderedMenus":"후라이드치킨, 콜라","hidden":false,"reply":{"replyId":55,"content":"감사합니다!","createdAt":"2026-11-17 21:00:00"},"report":null}],"page":1,"size":20,"totalCount":32}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| avgRating, reviewCount | number/null, integer | `V_STORE_RATING.AVG_RTNG`, `V_STORE_RATING.RVW_CNT`. 숨김·삭제 제외, noReply 필터와 무관한 가게 전체 평점 |
| items | array | 최신순 페이지 리뷰. 숨김 포함·삭제 제외 |
| items[].reviewId, items[].orderId | integer | `TB_RVW.RVW_ID`, `TB_RVW.ORD_ID` |
| items[].writerName | string | 주문 작성자 `TB_MBR.MBR_NM` 첫 글자 + ** |
| items[].rating, items[].content, items[].createdAt | integer, string/null, string | `TB_RVW.RVW_RTNG`, `TB_RVW.RVW_CN`, `TB_RVW.REG_DTTM` |
| items[].orderedMenus, items[].hidden | string, boolean | `TB_ORD_DTL.ORD_MENU_NM`을 상세순 연결, `TB_RVW.RVW_HDN_YN='Y'` |
| items[].reply | object/null | 미삭제 답글만 반환. 없거나 삭제됐으면 null |
| items[].reply.replyId, items[].reply.content, items[].reply.createdAt | integer, string, string | `TB_RVW_REPLY.RVW_REPLY_ID`, `TB_RVW_REPLY.RVW_REPLY_CN`, `TB_RVW_REPLY.REG_DTTM` |
| items[].report | object/null | 세션 회원이 신고했으면 `{status}`, 아니면 null. status는 `TB_RVW_RPT.RVW_RPT_STTS` |
| page, size, totalCount | integer | 요청 페이지·크기, noReply 적용 후 미삭제 리뷰 전체 수(숨김 포함) |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | noReply·page·size 오류 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_RVW`, `TB_RVW_REPLY`, `TB_RVW_RPT`, `V_STORE_RATING` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 가게 소유권·승인, 리뷰 → 주문 → 가게 관계, 답글·신고의 해당 리뷰 연결 및 신고자 일치.
- 상태 변경 / VIEW·트리거: 없음. `V_STORE_RATING` 사용. 숨김 포함 목록 건수와 숨김 제외 reviewCount는 다를 수 있다.

## R-02 답글 등록
- method/path: `POST /api/owner/stores/{storeId}/reviews/{reviewId}/reply`
- 권한: OWNER
- 설명: 리뷰당 답글 1개를 등록한다. 과거 삭제한 답글이 있으면 같은 행을 되살린다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, reviewId | integer | O | 본인 가게 주문의 리뷰 |
| body | content | string | O | 공백만 입력 불가, 최대 1000자 |

### 응답
201
```json
{"success":true,"data":{"replyId":55,"content":"감사합니다!","createdAt":"2026-11-17 21:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| replyId, content, createdAt | integer, string, string | `TB_RVW_REPLY.RVW_REPLY_ID`, `TB_RVW_REPLY.RVW_REPLY_CN`, `TB_RVW_REPLY.REG_DTTM`. 부활 시 같은 ID·최초 생성일시 유지 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | REPLY_EXISTS | 미삭제 답글이 이미 있음 |
| 409 | REVIEW_UNAVAILABLE | 리뷰가 숨김 또는 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_RVW`, `TB_RVW_REPLY` / 바꾸는 테이블: `TB_RVW_REPLY`.
- 트랜잭션: 리뷰 소속·사용 가능 여부·기존 답글 검사 후 INSERT 또는 삭제 행 UPDATE.
- 서버 검사: 리뷰 → 주문 → 본인 가게, 답글 작성자 = 현재 가게 사장. 숨김·삭제 리뷰에 등록 불가. 기존 미삭제 답글은 409.
- 상태 변경 / VIEW·트리거: 기존 행이 없으면 INSERT. `TB_RVW_REPLY.RVW_ID` UNIQUE이므로 삭제 행이 있으면 `TB_RVW_REPLY.DEL_YN='N'`과 새 내용·현재 `TB_RVW_REPLY.OWNR_MBR_ID`로 UPDATE하며 새 행을 만들지 않는다. 부활 수정일시는 `TRG_RVW_REPLY_MOD_DTTM` 담당.

## R-03 답글 수정
- method/path: `PATCH /api/owner/stores/{storeId}/reviews/{reviewId}/reply`
- 권한: OWNER
- 설명: 현재 미삭제 답글의 내용을 수정한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, reviewId | integer | O | 본인 가게 주문의 리뷰 |
| body | content | string | O | 공백만 입력 불가, 최대 1000자 |

### 응답
```json
{"success":true,"data":{"replyId":55,"content":"다음에도 맛있게 준비하겠습니다!","createdAt":"2026-11-17 21:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| replyId, content, createdAt | integer, string, string | `TB_RVW_REPLY.RVW_REPLY_ID`, `TB_RVW_REPLY.RVW_REPLY_CN`, `TB_RVW_REPLY.REG_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | REVIEW_UNAVAILABLE | 리뷰가 숨김 또는 삭제됨 |
| 404 | NOT_FOUND | 미삭제 답글이 없음 |
| 403 | FORBIDDEN | 답글 작성자 또는 리뷰 가게 불일치 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_RVW`, `TB_RVW_REPLY` / 바꾸는 테이블: `TB_RVW_REPLY`.
- 트랜잭션: 리뷰·답글 소속과 사용 가능 여부 확인 후 내용 UPDATE.
- 서버 검사: 리뷰 → 주문 → 본인 가게, 답글의 `TB_RVW_REPLY.OWNR_MBR_ID` = 세션 회원 = 가게 사장, 답글 미삭제 확인.
- 상태 변경 / VIEW·트리거: `TB_RVW_REPLY.RVW_REPLY_CN` 수정. `TRG_RVW_REPLY_MOD_DTTM` 적용. 최초 생성일시는 유지.

## R-04 답글 삭제
- method/path: `DELETE /api/owner/stores/{storeId}/reviews/{reviewId}/reply`
- 권한: OWNER
- 설명: 미삭제 답글을 논리 삭제한다. 재등록 시 R-02로 같은 행을 되살린다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, reviewId | integer | O | 본인 가게 주문의 리뷰. 본문 없음 |

### 응답
```json
{"success":true,"data":null}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | null | 답글 논리 삭제 완료 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | REVIEW_UNAVAILABLE | 리뷰가 숨김 또는 삭제됨 |
| 404 | NOT_FOUND | 미삭제 답글이 없음 |
| 403 | FORBIDDEN | 답글 작성자 또는 리뷰 가게 불일치 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_RVW`, `TB_RVW_REPLY` / 바꾸는 테이블: `TB_RVW_REPLY`.
- 트랜잭션: 소속·작성자·리뷰 상태 확인 후 논리 삭제 UPDATE.
- 서버 검사: 리뷰 → 주문 → 본인 가게, 답글 작성자 = 현재 가게 사장 = 세션 회원. 숨김·삭제 리뷰 변경 불가.
- 상태 변경 / VIEW·트리거: `TB_RVW_REPLY.DEL_YN='Y'`, `TRG_RVW_REPLY_MOD_DTTM` 적용. 행 자체는 삭제하지 않는다.

## R-05 리뷰 신고
- method/path: `POST /api/owner/stores/{storeId}/reviews/{reviewId}/report`
- 권한: OWNER
- 설명: 내 가게 리뷰를 신고한다. 신고만으로 숨김 처리하지 않는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId, reviewId | integer | O | 본인 가게 주문의 리뷰 |
| body | reason | string | O | ABUSE/FALSE/UNRELATED/ETC |
| body | content | string | O | 신고 내용, 공백만 입력 불가·최대 300자. ETC 외 사유도 필수 |

### 응답
201
```json
{"success":true,"data":{"reportId":80,"status":"PENDING"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| reportId, status | integer, string | `TB_RVW_RPT.RVW_RPT_ID`, `TB_RVW_RPT.RVW_RPT_STTS` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 사유 코드·내용 오류 |
| 409 | ALREADY_REPORTED | 같은 회원이 같은 리뷰를 이미 신고함(처리 상태와 무관) |
| 409 | REVIEW_UNAVAILABLE | 리뷰가 숨김 또는 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_RVW`, `TB_RVW_RPT` / 바꾸는 테이블: `TB_RVW_RPT`.
- 트랜잭션: 리뷰 소속·상태·기존 신고 검사와 신고 INSERT.
- 서버 검사: 리뷰 → 주문 → 본인 가게 관계, 숨김·삭제 여부, `(리뷰, 세션 회원)` 기존 신고 검사. DB UNIQUE도 중복 방어.
- 상태 변경 / VIEW·트리거: `TB_RVW_RPT.RPTR_MBR_ID`는 세션 회원, 사유·내용 기록, `TB_RVW_RPT.RVW_RPT_STTS='PENDING'`, 처리자·처리일시·처리내용은 NULL. 리뷰 행은 변경하지 않는다.

## R-06 내 신고 목록
- method/path: `GET /api/owner/stores/{storeId}/reports`
- 권한: OWNER
- 설명: 해당 가게 리뷰에 대해 내가 제출한 신고를 최신순으로 조회한다. 숨김·삭제된 리뷰의 신고 처리 이력도 유지한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게. 정의된 쿼리 없음 |

### 응답
```json
{"success":true,"data":[{"reportId":80,"reviewId":702,"reviewContent":"음식이 오지 않았어요","reason":"FALSE","status":"ACCEPTED","reportedAt":"2026-11-17 22:00:00","processedAt":"2026-11-18 10:00:00","processNote":"허위 사실 확인"}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | object | 페이지 없는 최신순 신고 배열 |
| reportId, reviewId, reviewContent | integer, integer, string/null | `TB_RVW_RPT.RVW_RPT_ID`, `TB_RVW_RPT.RVW_ID`, `TB_RVW.RVW_CN` |
| reason, status, reportedAt | string | `TB_RVW_RPT.RVW_RPT_RSN_CD`, `TB_RVW_RPT.RVW_RPT_STTS`, `TB_RVW_RPT.REG_DTTM` |
| processedAt, processNote | string/null | `TB_RVW_RPT.PRCS_DTTM`, `TB_RVW_RPT.PRCS_CN`. 대기 상태에서는 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 409 | STORE_NOT_APPROVED | 미승인 가게 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_RVW`, `TB_RVW_RPT` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 본인 가게·승인, 신고 → 리뷰 → 주문의 가게 일치, `TB_RVW_RPT.RPTR_MBR_ID` = 세션 회원인 신고만 반환.
- 상태 변경 / VIEW·트리거: 없음. `TB_RVW_RPT.REG_DTTM` 최신순. PENDING/ACCEPTED/REJECTED 결과를 그대로 표시한다.

## T-01 기간별 매출
- method/path: `GET /api/owner/stores/{storeId}/sales`
- 권한: OWNER
- 설명: 매출은 DONE 주문만 배달완료일 기준으로 계산한다. 접수율은 별도로 주문일시 기준이며 취소 주문도 포함한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| query | unit | string | O | day/month |
| query | from, to | string | O | YYYY-MM-DD, 양쪽 포함, from ≤ to. 최대 1년 |

### 응답
```json
{"success":true,"data":{"summary":{"orderCount":120,"salesAmount":2580000,"deliveryTipTotal":360000,"avgOrderAmount":21500,"acceptRate":0.9411764705882353,"acceptedCount":128,"rejectedCount":5,"autoCanceledCount":3},"rows":[{"period":"2026-11-01","orderCount":8,"salesAmount":172000,"deliveryTipTotal":24000,"avgOrderAmount":21500}]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| summary.orderCount | integer | 기간 내 해당 가게 `V_DONE_ORDER` 행 수 |
| summary.salesAmount | integer | `SUM(V_DONE_ORDER.ORD_TOT_AMT)`, 배달팁 제외. 없으면 0 |
| summary.deliveryTipTotal | integer | `SUM(V_DONE_ORDER.DLVR_TIP_AMT)`, 없으면 0 |
| summary.avgOrderAmount | integer | salesAmount ÷ orderCount를 원 단위 반올림, 주문 0건이면 0 |
| summary.acceptedCount | integer | 주문일시가 기간 내인 접수 주문 수: `TB_ORD.ORD_RCPT_DTTM IS NOT NULL`. CUSTOMER/ADMIN 취소는 제외 |
| summary.rejectedCount | integer | 주문일시가 기간 내이고 `TB_ORD.CNCL_ACTR_CD='OWNER' AND TB_ORD.ORD_RCPT_DTTM IS NULL`인 주문 수 |
| summary.autoCanceledCount | integer | 주문일시가 기간 내이고 `TB_ORD.CNCL_ACTR_CD='SYSTEM'`인 주문 수 |
| summary.acceptRate | number/null | 접수 ÷ (접수 + 거절 + 자동 취소). 분모 0이면 null. CUSTOMER/ADMIN 취소 제외 |
| rows | array | 기간을 일별/월별로 분할. 매출 없는 구간도 0으로 채우며 period 오름차순 |
| rows[].period | string | day는 YYYY-MM-DD, month는 YYYY-MM. `V_DONE_ORDER.SALES_DT` 기준 묶음 |
| rows[].orderCount, rows[].salesAmount, rows[].deliveryTipTotal, rows[].avgOrderAmount | integer | 해당 구간의 같은 매출 계산식. rows에는 접수율 관련 필드 없음 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | unit·날짜 오류, 역전된 기간·최대 기간 초과 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_DLVR`, `V_DONE_ORDER` / 바꾸는 테이블: `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(조회 전 자동 취소 및 취소 트리거).
- 트랜잭션: 권한 검사 후 만료 WAIT 자동 취소를 먼저 커밋하고 두 기준의 통계를 조회한다.
- 서버 검사: 소유권·승인, 날짜 범위·단위. 가게 필터를 매출·접수율에 각각 적용한다.
- 상태 변경 / VIEW·트리거: 매출 합계는 `V_DONE_ORDER.SALES_DT`가 from~to인 DONE 행만 사용. month도 입력 날짜 범위 안의 행을 월별 집계한다. 접수율은 `V_DONE_ORDER`를 쓰지 않고 `TB_ORD.ORD_DTTM`으로 기간 필터하며 CUSTOMER/ADMIN 취소를 제외한다. 자동 취소는 SYSTEM/NO_RESPONSE·취소일시 기록 후 `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`.

## T-02 메뉴별 매출
- method/path: `GET /api/owner/stores/{storeId}/sales/menus`
- 권한: OWNER
- 설명: 배달완료일 기준 DONE 주문을 주문 당시 메뉴명으로 묶어 매출 내림차순 집계한다. 메뉴 수정·삭제에도 과거 이름은 유지된다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 본인 가게 |
| query | from, to | string | O | YYYY-MM-DD, 양쪽 포함, from ≤ to. T-01과 같은 기간 기준 |

### 응답
```json
{"success":true,"data":[{"rank":1,"menuName":"후라이드치킨","quantity":70,"salesAmount":1400000,"ratio":0.5426356589147286}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data[] | object | 페이지 없는 매출 내림차순 배열 |
| rank | integer | 매출 내림차순 표시 순위 |
| menuName | string | 그룹 기준 `TB_ORD_DTL.ORD_MENU_NM`(현재 메뉴명이 아님) |
| quantity | integer | 해당 메뉴명 `SUM(TB_ORD_DTL.ORD_QTY)` |
| salesAmount | integer | 상세별 `(TB_ORD_DTL.ORD_UPRC + 해당 상세의 SUM(TB_ORD_DTL_OPT.ORD_OPT_AMT)) × TB_ORD_DTL.ORD_QTY`의 합 |
| ratio | number | 해당 메뉴 salesAmount ÷ 기간 전체 salesAmount. 기간 전체 매출이 0이면 0 |


### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 날짜 오류·역전된 기간·최대 기간 초과 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_DLVR`, `TB_ORD_DTL`, `TB_ORD_DTL_OPT`, `V_DONE_ORDER` / 바꾸는 테이블: `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(조회 전 자동 취소 및 취소 트리거).
- 트랜잭션: 권한 검사 후 만료 WAIT 자동 취소를 먼저 커밋하고 메뉴 매출 조회.
- 서버 검사: 소유권·승인, T-01과 같은 날짜 범위. 옵션 금액을 상세별로 먼저 합쳐 옵션 개수만큼 수량·기본 금액이 중복 집계되지 않게 한다.
- 상태 변경 / VIEW·트리거: `V_DONE_ORDER.ORD_ID`로 상세·상세옵션을 조인하고 `V_DONE_ORDER.SALES_DT`로 기간 필터. 배달팁 제외, 동일 기간 메뉴 매출 합계는 T-01 salesAmount와 같아야 한다. 현재 메뉴·분류 삭제 여부로 과거 매출을 제외하지 않는다. 자동 취소는 SYSTEM/NO_RESPONSE·취소일시 기록 후 `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`.
