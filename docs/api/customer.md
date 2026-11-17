# 고객 API

## 공통 규칙

| 항목 | 규칙 |
|---|---|
| 권한 | 전 API CUSTOMER. HMAC 서명 세션 쿠키에서 회원을 식별하고 매 요청 `TB_MBR.MBR_STTS='ACTIVE'`, `TB_MBR.MBR_ROLE_CD='CUSTOMER'` 확인. 요청으로 회원 ID를 받지 않는다. |
| 성공·실패 | 조회·수정·삭제 200, 생성 201. 성공 `{ "success": true, "data": ... }`, 실패 `{ "success": false, "error": { "code": "...", "message": "...", "fields": {} } }`; `fields`는 선택. |
| 소유권 | 타인 소유 자원 403 FORBIDDEN, 없거나 삭제된 자원 404 NOT_FOUND. |
| 입력 | 본문 JSON. 모든 ID는 양의 정수. page는 1 이상·기본 1, size는 1~100·기본 20. 페이지 응답은 `{ items, page, size, totalCount }`, 그 밖의 목록은 배열. |
| 단위 | 일시 `YYYY-MM-DD HH:mm:ss` 한국 시간, 날짜 `YYYY-MM-DD`, 금액 원 단위 정수, 거리 m 정수. |
| 거리·예상시간 표시 | distance는 실제 거리(m)를 반올림한 정수로 표시하되 3000m 판정은 반올림 전 실제 거리 사용. 예상배달시간은 조리분+실제 직선거리(km)×3을 합한 뒤 분 단위 올림. |
| 주소·거리 | 주소와 가게의 필수 좌표로 서버에서 직선거리를 계산. 배달 가능 조건은 계산한 거리 ≤ 3000m이며 표시용 정수 변환 전 값으로 판정. |
| 영업 | `TB_STORE.STORE_OPER_STTS='OPEN'`이면서 현재 한국 요일·시각이 `TB_STORE_HOURS.DAY_OF_WEEK`, `OPEN_TM` 이상·`CLOSE_TM` 미만인 구간에 포함되면 `isOpenNow=true`. 구간 여러 개는 브레이크타임, 행 없는 요일은 휴무. 표시 상태는 영업시간 밖 CLOSED, 시간 안 PAUSED 또는 OPEN. |
| 주문 상태 | WAIT → COOKING → READY(조리완료·픽업대기) → DELIVERING → DONE. CANCEL은 종료 상태. 배달 행은 사장 접수 O-03에서 생성하며 배차·픽업·완료는 `TB_DLVR.DSPCH_DTTM`, `PKUP_DTTM`, `DLVR_CMPL_DTTM`으로 판단. |
| 미접수 만료 | 예약 작업 없음. 주문 조회 C-20·C-21은 조회 전에 `TB_ORD.ORD_DTTM + 10분`이 지난 WAIT를 SYSTEM/NO_RESPONSE로 취소. C-22는 같은 트랜잭션에서 만료 검사 후 만료면 자동 취소를 반영하고 409 ORDER_ALREADY_PROCESSED. 오류 반환 때문에 확정한 자동 취소를 롤백하지 않는다. |
| 취소 연쇄 | `TB_ORD.ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 주문당 `TB_PAY` 1건. 승인된 POINT 결제만 잔액 환불·REFUND 거래(결제금액 0원은 거래 없음); 다른 결제는 결제 상태만 CANCELED. API에서 중복 처리하지 않는다. |
| 수정일시 | UPDATE 시 API는 수정일시를 직접 넣지 않는다. 각 테이블의 수정일시 트리거가 기록한다. |
| 리뷰 신규 조건 | 본인 주문 DONE, `TB_DLVR.DLVR_CMPL_DTTM`부터 72시간 이내, 기존 `TB_RVW` 행 없음(삭제 포함), 활성 REVIEW_WRITE 제재 없음. 활성 제재는 `TB_MBR_RSTR.RSTR_STRT_DTTM ≤ now`이고 종료일시가 NULL 또는 now보다 미래인 행. |
| 리뷰 수정 조건 | DONE·배달완료부터 72시간 이내·본인 리뷰·미삭제·미숨김. REVIEW_WRITE 제재는 신규 작성만 막는다. 삭제는 기간·숨김 여부와 무관하게 가능하며 삭제 후 재작성 불가. |

## C-01 배달 주소 목록 조회
- method/path: `GET /api/customer/addresses`
- 권한: CUSTOMER
- 설명: 본인의 미삭제 주소를 기본 주소 우선, 그 밖에는 최근 등록순으로 반환한다. 주소가 없으면 빈 배열이다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 요청 없음 |

### 응답
```json
{"success":true,"data":[{"addressId":11,"addressName":"우리 집","address":"서울 서대문구 신촌로 25","addressDetail":"101호","zipCode":"03789","lat":37.554,"lng":126.945,"isDefault":true}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].addressId / addressName / address | integer / string / string | `TB_MBR_ADDR.MBR_ADDR_ID` / `MBR_ADDR_NM` / `MBR_ADDR` |
| [].addressDetail / zipCode | string 또는 null / string | `TB_MBR_ADDR.MBR_DADDR` / `MBR_ZIP` |
| [].lat / lng / isDefault | number / number / boolean | `TB_MBR_ADDR.MBR_LAT` / `MBR_LNG` / `DFLT_YN='Y'` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 세션 회원으로 소유권 범위를 제한하고 `TB_MBR_ADDR.DEL_YN='N'`만 조회.
- 상태 변경 / VIEW·트리거: 없음.

## C-02 배달 주소 등록
- method/path: `POST /api/customer/addresses`
- 권한: CUSTOMER
- 설명: 주소를 등록한다. 첫 미삭제 주소는 요청과 관계없이 기본 주소로 지정한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | addressName | string | O | 비어 있지 않음, 최대 30자 |
| body | address | string | O | 도로명 주소, 최대 200자 |
| body | addressDetail | string | X | 최대 100자 |
| body | zipCode | string | O | 숫자 5자리 |
| body | lat / lng | number | O | 위도 -90~90, 경도 -180~180. 둘 다 필수 |
| body | isDefault | boolean | X | 기본 false, 첫 주소는 true |

### 응답
```json
{"success":true,"data":{"addressId":12,"isDefault":false}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| addressId / isDefault | integer / boolean | 생성한 `TB_MBR_ADDR.MBR_ADDR_ID` / `DFLT_YN='Y'` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수값·길이·우편번호·좌표·타입 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR` / 바꾸는 테이블: `TB_MBR_ADDR`.
- 트랜잭션: 기존 기본 주소 해제와 새 주소 INSERT 전체.
- 서버 검사: 세션 회원의 미삭제 주소 수 확인. 주소 검색 결과 등 주소 입력 방식으로 주소 문자열·좌표의 정합성을 확인한다.
- 상태 변경 / VIEW·트리거: 기본 지정이면 기존 `TB_MBR_ADDR.DFLT_YN='N'` 후 새 행에 Y. `TRG_MBR_ADDR_MOD_DTTM`이 기존 행 수정일시 기록.

## C-03 배달 주소 수정
- method/path: `PATCH /api/customer/addresses/{addressId}`
- 권한: CUSTOMER
- 설명: 본인 주소의 전달된 필드만 수정하며 기존 주문의 배달지 스냅샷은 유지한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | addressId | integer | O | 수정할 주소 ID |
| body | addressName / address | string | X | 최대 30자 / 200자, 비어 있지 않음 |
| body | addressDetail | string | X | 최대 100자, 빈 문자열로 초기화 가능 |
| body | zipCode | string | X | 숫자 5자리 |
| body | lat / lng | number | X | 위도 -90~90, 경도 -180~180. address 변경 시 둘 다 필수 |
| body | — | — | — | 위 수정 필드 최소 1개. 기본 주소 변경은 C-05 |

### 응답
```json
{"success":true,"data":{"addressId":12,"addressName":"학교","addressDetail":"중앙도서관"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| addressId / addressName / addressDetail | integer / string / string 또는 null | `TB_MBR_ADDR.MBR_ADDR_ID` / `MBR_ADDR_NM` / `MBR_DADDR` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 수정값 없음·형식 오류·주소 변경 시 좌표 누락 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소 없음·삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR` / 바꾸는 테이블: `TB_MBR_ADDR`.
- 트랜잭션: 소유권·삭제 여부 확인 후 주소 UPDATE.
- 서버 검사: 본인 미삭제 주소, 주소 변경 시 새 좌표와의 정합성 확인.
- 상태 변경 / VIEW·트리거: `TRG_MBR_ADDR_MOD_DTTM`이 수정일시 기록. `TB_ORD` 변경 없음.

## C-04 배달 주소 삭제
- method/path: `DELETE /api/customer/addresses/{addressId}`
- 권한: CUSTOMER
- 설명: 논리 삭제하며 기본 주소 삭제 시 남은 주소 중 가장 최근 등록 주소를 기본으로 지정한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | addressId | integer | O | 삭제할 주소 ID, 본문 없음 |

### 응답
```json
{"success":true,"data":{"deletedAddressId":11,"newDefaultAddressId":12}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| deletedAddressId | integer | 삭제한 `TB_MBR_ADDR.MBR_ADDR_ID` |
| newDefaultAddressId | integer 또는 null | 처리 후 기본 주소의 `TB_MBR_ADDR.MBR_ADDR_ID`, 남은 주소가 없으면 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소 없음·삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR` / 바꾸는 테이블: `TB_MBR_ADDR`.
- 트랜잭션: 논리 삭제와 필요한 기본 주소 재지정 전체.
- 서버 검사: 본인 미삭제 주소인지 확인. 대체 주소는 본인 미삭제 주소의 `TB_MBR_ADDR.REG_DTTM` 내림차순으로 선택.
- 상태 변경 / VIEW·트리거: 대상 `TB_MBR_ADDR.DEL_YN='Y'`; 기본 주소 재지정 시 `DFLT_YN` 변경. `TRG_MBR_ADDR_MOD_DTTM`이 기록. 주문 스냅샷 유지.

## C-05 기본 배달 주소 지정
- method/path: `PATCH /api/customer/addresses/{addressId}/default`
- 권한: CUSTOMER
- 설명: 기본 주소를 변경한다. 현재 화면에서 선택한 배달 주소는 클라이언트 상태이며 별도로 영구 저장하지 않는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | addressId | integer | O | 기본으로 지정할 주소, 본문 없음 |

### 응답
```json
{"success":true,"data":{"addressId":12,"isDefault":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| addressId / isDefault | integer / boolean | `TB_MBR_ADDR.MBR_ADDR_ID` / `DFLT_YN='Y'` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소 없음·삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR` / 바꾸는 테이블: `TB_MBR_ADDR`.
- 트랜잭션: 기존 기본 주소 해제 후 대상 지정 전체.
- 서버 검사: 본인의 미삭제 주소인지 확인.
- 상태 변경 / VIEW·트리거: 기존 `TB_MBR_ADDR.DFLT_YN='N'` 후 대상 Y, 부분 UNIQUE로 중복 방지. `TRG_MBR_ADDR_MOD_DTTM`이 기록.

## C-06 포인트 잔액·내역 조회
- method/path: `GET /api/customer/points`
- 권한: CUSTOMER
- 설명: 본인 잔액과 거래일시 최신순 거래 목록을 반환한다. CHARGE·REFUND는 증가, USE·EXPIRE는 감소이며 거래금액은 양수이다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | page / size | integer | X | 기본 1 / 20, size 최대 100 |

### 응답
```json
{"success":true,"data":{"balance":25000,"items":[{"transactionId":93,"type":"USE","amount":5000,"balanceAfter":25000,"method":null,"orderId":3021,"status":"COMPLETED","occurredAt":"2026-11-17 18:02:11"}],"page":1,"size":20,"totalCount":1}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| balance | integer | `TB_MBR.PNT_BAL_AMT`, 초기값 0 |
| page / size / totalCount / items | integer / integer / integer / array | 요청 페이지 / 크기 / 본인 거래 총수 / 거래 목록 |
| items[].transactionId / type / amount | integer / string / integer | `TB_PNT_TXN.PNT_TXN_ID` / `PNT_TXN_TYPE_CD` / `PNT_TXN_AMT` |
| items[].balanceAfter / method / orderId | integer / string 또는 null / integer 또는 null | `TB_PNT_TXN.PNT_BAL_AMT` / `CHRG_MTHD_CD` / `ORD_ID` |
| items[].status / occurredAt | string / string | `TB_PNT_TXN.PNT_TXN_STTS` / `PNT_TXN_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 페이지 조건 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_PNT_TXN` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 세션 회원의 잔액·거래만 조회.
- 상태 변경 / VIEW·트리거: 없음.

## C-07 포인트 충전(가상 결제)
- method/path: `POST /api/customer/points/charges`
- 권한: CUSTOMER
- 설명: 실제 결제 연동 없이 가상 승인하고 포인트를 충전한다.

> 미정(Q): 1회 충전 상한 금액. 충전 단위는 10,000원으로 확정이다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | amount | integer | O | 양수, 10,000원 배수. 1회 상한 미정(Q) |
| body | method | string | O | CARD, KAKAO, NAVER. POINT 불가 |

### 응답
```json
{"success":true,"data":{"transactionId":94,"type":"CHARGE","amount":30000,"balance":55000,"status":"COMPLETED","chargedAt":"2026-11-17 19:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| transactionId / type / amount | integer / string / integer | `TB_PNT_TXN.PNT_TXN_ID` / `PNT_TXN_TYPE_CD` / `PNT_TXN_AMT` |
| balance / status / chargedAt | integer / string / string | 거래 후 `TB_MBR.PNT_BAL_AMT` / `TB_PNT_TXN.PNT_TXN_STTS` / `PNT_TXN_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 양의 정수·10,000원 배수 아님, 결제수단 오류, 상한 확정 후 상한 초과 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_PNT_TXN` / 바꾸는 테이블: `TB_MBR`, `TB_PNT_TXN`.
- 트랜잭션: `TB_MBR.PNT_BAL_AMT` 증가와 거래 후 잔액을 담은 CHARGE 거래 INSERT 전체.
- 서버 검사: 충전액·수단 확인. 충전 거래의 `TB_PNT_TXN.CHRG_MTHD_CD` 지정, `ORD_ID`는 NULL.
- 상태 변경 / VIEW·트리거: 거래 COMPLETED. `TRG_MBR_MOD_DTTM`이 회원 수정일시 기록.

## C-08 가게 목록·검색
- method/path: `GET /api/customer/stores`
- 권한: CUSTOMER
- 설명: 본인 주소에서 3000m 이내인 승인·미삭제 가게를 검색하며 비영업 가게도 아래에 표시한다.

- 정렬 코드는 원본대로 유지한다. DEFAULT는 영업중 우선·실제 거리 오름차순·가게 ID 오름차순이다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | addressId | integer | O | 본인 미삭제 주소 |
| query | categoryCode | string | X | CHICKEN, PIZZA, KOREAN, CHINESE, JAPANESE, SNACK, CAFE, ETC |
| query | keyword | string | X | 가게명 부분 일치 |
| query | sort | string | X | DEFAULT(기본), RATING, REVIEW-COUNT, DELIVERY_TIP |
| query | page / size | integer | X | 기본 1 / 20, size 최대 100 |

### 응답
```json
{"success":true,"data":{"items":[{"storeId":10,"storeName":"연세치킨 신촌점","categoryCode":"CHICKEN","operStatus":"OPEN","isOpenNow":true,"distance":1200,"minOrderAmount":15000,"deliveryTip":3000,"estimatedDeliveryMinutes":24,"avgRating":4.6,"reviewCount":32,"canOrder":true}],"page":1,"size":20,"totalCount":1}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| page / size / totalCount / items | integer / integer / integer / array | 페이지 / 크기 / 검색 조건 전체 건수 / 가게 목록 |
| items[].storeId / storeName / categoryCode | integer / string / string | `TB_STORE.STORE_ID` / `STORE_NM` / `STORE_CTGR_CD` |
| items[].operStatus / isOpenNow | string / boolean | 공통 영업 계산: OPEN·PAUSED·CLOSED / 현재 영업 여부 |
| items[].distance | integer | 주소 `TB_MBR_ADDR.MBR_LAT`, `MBR_LNG`와 가게 `TB_STORE.STORE_LAT`, `STORE_LNG`의 실제 직선거리(m)를 반올림 |
| items[].minOrderAmount / deliveryTip | integer / integer | `TB_STORE.MIN_ORD_AMT` / `DLVR_TIP_AMT` |
| items[].estimatedDeliveryMinutes | integer | `TB_STORE.COOK_EST_MI + 실제 거리(km) × 3`을 합한 뒤 분 단위 올림 |
| items[].avgRating / reviewCount | number 또는 null / integer | `V_STORE_RATING.AVG_RTNG` / `RVW_CNT` |
| items[].canOrder | boolean | 승인·미삭제·배달반경 충족 상태에서 isOpenNow. 장바구니 최소금액 검사는 주문 시 수행 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 주소 ID·카테고리·sort·페이지 조건 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소 없음·삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_ORD`, `TB_RVW` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 주소 소유권, `TB_STORE.STORE_APRV_STTS='APPROVED'`, `DEL_YN='N'`, 서버 계산 거리 ≤ 3000m. 미영업 가게도 조회하되 canOrder=false.
- 상태 변경 / VIEW·트리거: `V_STORE_RATING` 조인. 모든 정렬은 영업중 우선. DEFAULT는 실제 거리 오름차순, RATING은 `AVG_RTNG IS NULL` 뒤·평점 내림차순, REVIEW-COUNT는 리뷰 수 내림차순, DELIVERY_TIP은 배달팁 오름차순. 각 정렬의 동률은 가게 ID 오름차순.

## C-09 고객 가게 상세 조회
- method/path: `GET /api/customer/stores/{storeId}`
- 권한: CUSTOMER
- 설명: 승인·미삭제 가게 상세를 반환하며 영업 외에도 조회 가능하다.

- 3000m 밖에서도 200으로 상세를 제공하되 canOrder=false. 실제 주문은 OUT_OF_DELIVERY_RANGE로 차단한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 가게 ID |
| query | addressId | integer | O | 본인 미삭제 주소 |

### 응답
```json
{"success":true,"data":{"storeId":10,"storeName":"연세치킨 신촌점","categoryCode":"CHICKEN","telNo":"02-123-4567","address":"서울 서대문구 연세로 50","description":"바삭한 치킨","hours":[{"dayOfWeek":1,"open":"11:00","close":"23:00"}],"closedDays":[0,2,3,4,5,6],"operStatus":"OPEN","isOpenNow":true,"canOrder":true,"distance":1200,"minOrderAmount":15000,"deliveryTip":3000,"cookMinutes":20,"estimatedDeliveryMinutes":24,"avgRating":4.6,"reviewCount":32}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| storeId / storeName / categoryCode | integer / string / string | `TB_STORE.STORE_ID` / `STORE_NM` / `STORE_CTGR_CD` |
| telNo / address / description | string / string / string 또는 null | `TB_STORE.STORE_TELNO` / `STORE_ADDR` / `STORE_CN` |
| hours[].dayOfWeek / open / close | integer / string / string | `TB_STORE_HOURS.DAY_OF_WEEK`(0 일~6 토) / `OPEN_TM` / `CLOSE_TM` |
| closedDays | integer[] | 0~6 중 영업시간 행 없는 요일 |
| operStatus / isOpenNow / canOrder | string / boolean / boolean | 공통 영업 계산 / 영업 여부 / 영업·반경 충족 여부 |
| distance | integer | 주소 좌표와 가게 좌표의 실제 직선거리(m)를 반올림 |
| minOrderAmount / deliveryTip / cookMinutes | integer / integer / integer | `TB_STORE.MIN_ORD_AMT` / `DLVR_TIP_AMT` / `COOK_EST_MI` |
| estimatedDeliveryMinutes | integer | 기본 조리분 + 실제 거리(km) × 3을 합한 뒤 분 단위 올림 |
| avgRating / reviewCount | number 또는 null / integer | `V_STORE_RATING.AVG_RTNG` / `RVW_CNT` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수 주소 누락·ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소 없음·삭제됨 또는 가게 없음·삭제·미승인 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_ORD`, `TB_RVW` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 주소 소유권·미삭제, 가게 승인·미삭제. 조회 가능 여부와 별개로 영업 외·반경 밖은 canOrder=false.
- 상태 변경 / VIEW·트리거: `V_STORE_RATING`으로 공개 평점·리뷰 수 조회. 영업 상태는 저장값과 영업시간으로 계산.

## C-10 가게 메뉴 목록
- method/path: `GET /api/customer/stores/{storeId}/menus`
- 권한: CUSTOMER
- 설명: 미삭제 분류·메뉴를 분류순서와 메뉴순서로 반환한다. 품절 메뉴도 표시한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 승인·미삭제 가게 ID |

### 응답
```json
{"success":true,"data":[{"categoryId":1,"categoryName":"대표 메뉴","seq":1,"menus":[{"menuId":101,"menuName":"후라이드치킨","price":18000,"description":"바삭한 기본 치킨","saleStatus":"ON_SALE","seq":1,"optionGroupCount":1}]}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].categoryId / categoryName / seq | integer / string / integer | `TB_MENU_CTGR.CTGR_ID` / `CTGR_NM` / `CTGR_SEQ` |
| [].menus | array | 분류 소속 미삭제 메뉴 |
| [].menus[].menuId / menuName / price | integer / string / integer | `TB_MENU.MENU_ID` / `MENU_NM` / `MENU_AMT` |
| [].menus[].description / saleStatus / seq | string 또는 null / string / integer | `TB_MENU.MENU_CN` / `MENU_SALE_STTS` / `MENU_SEQ` |
| [].menus[].optionGroupCount | integer | 해당 메뉴의 미삭제 `TB_MENU_OPT_GRP` 행 수 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |
| 404 | NOT_FOUND | 가게 없음·삭제·미승인 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 승인·미삭제 가게, 분류와 메뉴의 가게 일치 및 미삭제 확인.
- 상태 변경 / VIEW·트리거: 없음. 품절은 목록에서 제외하지 않지만 담기·주문 불가.

## C-11 메뉴 상세·옵션 조회
- method/path: `GET /api/customer/stores/{storeId}/menus/{menuId}`
- 권한: CUSTOMER
- 설명: 메뉴와 미삭제 옵션 그룹·옵션을 순서대로 반환한다. 품절 메뉴도 조회 가능하다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId / menuId | integer | O | 가게 / 해당 가게 메뉴 ID |

### 응답
```json
{"success":true,"data":{"menuId":101,"categoryId":1,"categoryName":"대표 메뉴","menuName":"후라이드치킨","price":18000,"description":"바삭한 기본 치킨","saleStatus":"ON_SALE","seq":1,"optionGroups":[{"optionGroupId":501,"groupName":"부위 선택","required":true,"maxSelect":1,"seq":1,"options":[{"optionId":9002,"optionName":"순살","price":2000,"seq":2}]}]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| menuId / menuName / price / description | integer / string / integer / string 또는 null | `TB_MENU.MENU_ID` / `MENU_NM` / `MENU_AMT` / `MENU_CN` |
| categoryId / categoryName | integer / string | `TB_MENU_CTGR.CTGR_ID` / `CTGR_NM` |
| saleStatus / seq | string / integer | `TB_MENU.MENU_SALE_STTS` / `MENU_SEQ` |
| optionGroups[].optionGroupId / groupName | integer / string | `TB_MENU_OPT_GRP.OPT_GRP_ID` / `OPT_GRP_NM` |
| optionGroups[].required / maxSelect / seq | boolean / integer / integer | `TB_MENU_OPT_GRP.RQRD_YN='Y'` / `MAX_SLCT_CNT` / `OPT_GRP_SEQ` |
| optionGroups[].options[].optionId / optionName / price / seq | integer / string / integer / integer | `TB_MENU_OPT.OPT_ID` / `OPT_NM` / `OPT_AMT` / `OPT_SEQ` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |
| 404 | NOT_FOUND | 가게 없음·삭제·미승인, 메뉴·분류 삭제 또는 가게 소속 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 가게 공개 여부, 메뉴·분류 소속 일치 및 삭제 여부. 미삭제 그룹·옵션만 반환.
- 상태 변경 / VIEW·트리거: 없음.

## C-12 가게 공개 리뷰 목록
- method/path: `GET /api/customer/stores/{storeId}/reviews`
- 권한: CUSTOMER
- 설명: 공개 리뷰를 최신순으로 반환하고 작성자 이름 일부를 가린다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | integer | O | 가게 ID |
| query | page / size | integer | X | 기본 1 / 20, size 최대 100 |

### 응답
```json
{"success":true,"data":{"avgRating":4.6,"reviewCount":32,"items":[{"reviewId":701,"writerName":"김**","rating":5,"content":"바삭하고 맛있어요","createdAt":"2026-11-17 20:11:03","orderedMenus":"후라이드치킨","reply":{"content":"감사합니다!","createdAt":"2026-11-17 21:00:00"}}],"page":1,"size":20,"totalCount":32}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| avgRating / reviewCount | number 또는 null / integer | `V_STORE_RATING.AVG_RTNG` / `RVW_CNT` |
| page / size / totalCount / items | integer / integer / integer / array | 페이지 / 크기 / 공개 리뷰 수 / 리뷰 목록 |
| items[].reviewId / rating / content / createdAt | integer / integer / string 또는 null / string | `TB_RVW.RVW_ID` / `RVW_RTNG` / `RVW_CN` / `REG_DTTM` |
| items[].writerName | string | `TB_MBR.MBR_NM` 일부 마스킹, 사장 공개 리뷰 목록과 동일 규칙 |
| items[].orderedMenus | string | `TB_ORD_DTL.ORD_MENU_NM`을 상세순서로 묶은 주문 메뉴명 |
| items[].reply | object 또는 null | 미삭제 답글, 없으면 null |
| items[].reply.content / createdAt | string / string | `TB_RVW_REPLY.RVW_REPLY_CN` / `REG_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·페이지 조건 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |
| 404 | NOT_FOUND | 가게 없음·삭제·미승인 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_RVW`, `TB_RVW_REPLY` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 가게 공개 가능 여부. 가게 소속 주문의 `TB_RVW.RVW_HDN_YN='N'`, `DEL_YN='N'`만 반환하며 미삭제 답글만 조인.
- 상태 변경 / VIEW·트리거: `V_STORE_RATING` 사용, 리뷰 0건이면 avgRating=null, reviewCount=0.

## C-13 장바구니 조회
- method/path: `GET /api/customer/cart`
- 권한: CUSTOMER
- 설명: 재로그인 후에도 유지되는 본인 장바구니를 최신 가격·판매 상태로 계산한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 요청 없음 |

### 응답
```json
{"success":true,"data":{"cartId":61,"storeId":10,"storeName":"연세치킨 신촌점","minOrderAmount":15000,"deliveryTip":3000,"orderTotal":20000,"payAmount":23000,"meetsMinOrder":true,"items":[{"cartItemId":401,"menuId":101,"menuName":"후라이드치킨","quantity":1,"unitPrice":18000,"options":[{"optionId":9002,"optionName":"순살","price":2000}],"lineTotal":20000,"available":true,"unavailableReason":null}]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| cartId / storeId / storeName | integer 또는 null / integer 또는 null / string 또는 null | `TB_CART.CART_ID` / `STORE_ID` / `TB_STORE.STORE_NM` |
| minOrderAmount / deliveryTip | integer | `TB_STORE.MIN_ORD_AMT` / `DLVR_TIP_AMT`, 빈 장바구니는 0 |
| orderTotal / payAmount / meetsMinOrder | integer / integer / boolean | 항목 합계 / 합계+배달팁 / 합계≥최소금액(빈 장바구니 false) |
| items[].cartItemId / menuId / quantity | integer / integer / integer | `TB_CART_DTL.CART_DTL_ID` / `MENU_ID` / `CART_QTY` |
| items[].menuName / unitPrice | string / integer | 현재 `TB_MENU.MENU_NM` / `MENU_AMT` |
| items[].options[].optionId / optionName / price | integer / string / integer | `TB_MENU_OPT.OPT_ID` / `OPT_NM` / `OPT_AMT` |
| items[].lineTotal | integer | (현재 메뉴단가 + 선택 옵션금액 합) × 수량 |
| items[].available / unavailableReason | boolean / string 또는 null | 메뉴·분류·옵션의 삭제·품절·현재 옵션규칙에 따른 담기 가능 여부 / 불가 이유, 가능하면 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 세션 회원 장바구니만 조회, 한 가게 소속인지·메뉴·옵션 유효성 재검사. 최소금액은 배달팁 제외.
- 상태 변경 / VIEW·트리거: 없음. 빈 장바구니는 cartId·storeId·storeName=null, items=[], 금액 0, meetsMinOrder=false.

## C-14 장바구니 메뉴 담기
- method/path: `POST /api/customer/cart/items`
- 권한: CUSTOMER
- 설명: 판매 가능한 메뉴·옵션을 본인 장바구니에 담는다.

> 미정(Q): 수량 상한, replaceCart=true의 교체 기능 확정, 동일 메뉴·동일 옵션 구성의 수량 합산 여부. 원본 제안 필드는 유지하되 확정 기능으로 간주하지 않는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | storeId / menuId | integer | O | 가게 / 메뉴 ID |
| body | quantity | integer | O | 1 이상, 상한 미정(Q) |
| body | optionIds | integer[] | O | 선택 옵션, 미선택은 [], 중복 선택 불가 |
| body | replaceCart | boolean | X | 기본 false. true의 교체 동작 미정(Q) |

### 응답
```json
{"success":true,"data":{"cartId":61,"cartItemId":401,"quantity":1}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| cartId / cartItemId / quantity | integer / integer / integer | `TB_CART.CART_ID` / `TB_CART_DTL.CART_DTL_ID` / `CART_QTY` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·수량·옵션 배열·타입 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |
| 404 | NOT_FOUND | 가게·메뉴·분류·옵션 없음·삭제됨 또는 가게 미승인 |
| 409 | MENU_UNAVAILABLE | 품절 등 담기 불가 |
| 409 | INVALID_OPTION_SELECTION | 필수그룹 누락, 그룹별 최대 선택 수 초과, 타 메뉴 옵션 |
| 409 | CART_STORE_CONFLICT | 다른 가게 장바구니가 있고 replaceCart=false |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT` / 바꾸는 테이블: `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT`.
- 트랜잭션: 가게 일치 검사·필요한 장바구니 생성·항목·옵션 INSERT 전체. 교체 기능을 채택하면 기존 헤더 삭제와 재생성도 동일 범위.
- 서버 검사: 회원당 장바구니 1개, 가게와 메뉴·분류 일치, 판매·삭제 상태, 옵션이 해당 메뉴 소속인지, 필수그룹당 최소 1개 및 `TB_MENU_OPT_GRP.MAX_SLCT_CNT` 이하인지 검사.
- 상태 변경 / VIEW·트리거: 교체 시 헤더 삭제는 FK CASCADE로 기존 항목·옵션 삭제. 합산 채택 시 `TRG_CART_DTL_MOD_DTTM`이 항목 수정일시 기록.

## C-15 장바구니 수량 변경
- method/path: `PATCH /api/customer/cart/items/{cartItemId}`
- 권한: CUSTOMER
- 설명: 본인 항목 수량을 변경하고 최신 가격으로 항목 합계를 반환한다.

> 미정(Q): 수량 상한은 C-14와 함께 확정한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | cartItemId | integer | O | 장바구니 항목 ID |
| body | quantity | integer | O | 1 이상, 0은 허용하지 않음. 상한 미정(Q), 삭제는 C-16 |

### 응답
```json
{"success":true,"data":{"cartItemId":401,"quantity":2,"lineTotal":40000}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| cartItemId / quantity | integer / integer | `TB_CART_DTL.CART_DTL_ID` / `CART_QTY` |
| lineTotal | integer | (현재 `TB_MENU.MENU_AMT` + 선택 `TB_MENU_OPT.OPT_AMT` 합) × 수량 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·수량 오류 또는 수량 0 이하 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 항목 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 항목 없음·삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT`, `TB_MENU`, `TB_MENU_OPT` / 바꾸는 테이블: `TB_CART_DTL`.
- 트랜잭션: 소유권 확인·수량 UPDATE·최신 금액 계산.
- 서버 검사: 항목→장바구니→회원 소유권, 양의 정수 수량. 주문 직전 판매·옵션 검증은 C-19가 별도로 재수행.
- 상태 변경 / VIEW·트리거: `TRG_CART_DTL_MOD_DTTM`이 기록. 과거 주문 값 변경 없음.

## C-16 장바구니 항목 삭제
- method/path: `DELETE /api/customer/cart/items/{cartItemId}`
- 권한: CUSTOMER
- 설명: 본인 항목과 선택 옵션을 삭제하며 마지막 항목이면 헤더도 삭제한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | cartItemId | integer | O | 삭제할 항목 ID, 본문 없음 |

### 응답
```json
{"success":true,"data":{"deletedCartItemId":401,"remainingItemCount":0}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| deletedCartItemId / remainingItemCount | integer / integer | 삭제한 `TB_CART_DTL.CART_DTL_ID` / 남은 항목 행 수(수량 합 아님) |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 항목 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 항목 없음·삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT` / 바꾸는 테이블: `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT`.
- 트랜잭션: 소유권 확인·항목 삭제·남은 항목 확인·필요 시 헤더 삭제 전체.
- 서버 검사: 본인 항목인지 확인, 마지막 항목이면 가게 ID만 남은 헤더를 유지하지 않음.
- 상태 변경 / VIEW·트리거: `TB_CART_DTL` DELETE 시 선택 옵션 FK CASCADE. 헤더 삭제도 FK CASCADE 적용.

## C-17 장바구니 전체 비우기
- method/path: `DELETE /api/customer/cart`
- 권한: CUSTOMER
- 설명: 본인 장바구니를 비운다. 이미 비어 있어도 200으로 처리한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 요청 없음 |

### 응답
```json
{"success":true,"data":{"cleared":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| cleared | boolean | 장바구니 없음 또는 삭제 완료이면 true |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT` / 바꾸는 테이블: `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT`.
- 트랜잭션: 세션 회원 장바구니 전체 삭제.
- 서버 검사: 세션 회원의 헤더만 삭제. 다른 회원·주문에 영향 없음.
- 상태 변경 / VIEW·트리거: `TB_CART` DELETE → FK CASCADE로 항목·옵션 삭제.

## C-18 주문서 미리보기 (선택)
- method/path: `POST /api/customer/orders/preview`
- 권한: CUSTOMER
- 설명: 저장 없이 주문 가능 여부와 최신 금액을 검증한다. 선택 API이며 호출 여부와 관계없이 C-19는 전체 검증을 다시 수행한다.

- distance는 실제 직선거리(m)를 반올림하여 표시한다. 반경 판정에는 반올림 전 값을 사용한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | addressId | integer | O | 본인 미삭제 주소 |
| body | payMethod | string | O | CARD, KAKAO, NAVER, POINT |

### 응답
```json
{"success":true,"data":{"storeId":10,"storeName":"연세치킨 신촌점","addressId":11,"deliveryAddress":"서울 서대문구 신촌로 25","distance":1200,"items":[{"menuId":101,"menuName":"후라이드치킨","quantity":1,"unitPrice":18000,"options":[{"optionName":"순살","price":2000}],"lineTotal":20000}],"orderTotal":20000,"deliveryTip":3000,"payAmount":23000,"minOrderAmount":15000,"pointBalance":25000,"canOrder":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| storeId / storeName / addressId / deliveryAddress | integer / string / integer / string | `TB_STORE.STORE_ID` / `STORE_NM` / `TB_MBR_ADDR.MBR_ADDR_ID` / `MBR_ADDR` |
| distance | integer | 고객 주소 좌표와 가게 좌표의 실제 직선거리(m)를 반올림 |
| items[].menuId / menuName / quantity / unitPrice | integer / string / integer / integer | `TB_MENU.MENU_ID` / `MENU_NM` / `TB_CART_DTL.CART_QTY` / `TB_MENU.MENU_AMT` |
| items[].options[].optionName / price | string / integer | `TB_MENU_OPT.OPT_NM` / `OPT_AMT` |
| items[].lineTotal / orderTotal | integer / integer | (메뉴단가+선택 옵션금액 합)×수량 / 항목 합계 |
| deliveryTip / payAmount / minOrderAmount | integer / integer / integer | `TB_STORE.DLVR_TIP_AMT` / orderTotal+deliveryTip / `TB_STORE.MIN_ORD_AMT` |
| pointBalance / canOrder | integer / boolean | `TB_MBR.PNT_BAL_AMT` / 검증 통과 시 true, 불충족은 아래 오류 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 주소 ID·결제수단 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소·가게 없음·삭제됨 |
| 409 | EMPTY_CART | 장바구니 없음·항목 없음 |
| 409 | STORE_NOT_APPROVED | 가게 미승인 |
| 409 | STORE_CLOSED | 일시중지·영업시간 밖 |
| 409 | MENU_UNAVAILABLE | 메뉴·분류 삭제 또는 품절 |
| 409 | INVALID_OPTION_SELECTION | 옵션 삭제·소속 오류·필수/최대 선택 조건 위반 |
| 409 | OUT_OF_DELIVERY_RANGE | 실제 직선거리 > 3000m |
| 409 | MIN_ORDER_NOT_MET | 메뉴·옵션 합계가 최소금액 미만 |
| 409 | INSUFFICIENT_POINTS | POINT인데 잔액 부족 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음. 미리보기 결과는 가격·재고·잔액을 예약하지 않는다.
- 서버 검사: 주소·장바구니 본인 소유, 가게 승인·미삭제·실제 영업·3000m, 장바구니 가게 일치, 메뉴·옵션 소속·판매·삭제·필수·최대선택, 최신 금액·최소금액·POINT 잔액.
- 상태 변경 / VIEW·트리거: 없음.

## C-19 주문 생성·가상 결제
- method/path: `POST /api/customer/orders`
- 권한: CUSTOMER
- 설명: 서버의 최신 가격으로 주문을 생성하고 단일 결제수단으로 가상 승인한다.

- 0원 POINT 결제도 승인한다. 잔액은 그대로 두고 USE 거래는 생성하지 않는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | addressId | integer | O | 본인 미삭제 주소 |
| body | payMethod | string | O | CARD, KAKAO, NAVER, POINT |
| body | storeRequest / riderRequest | string | X | 가게 요청 / 라이더 요청, 각각 최대 500자 |
| body | cutlery | boolean | X | 기본 false, 일회용 수저 요청 |

### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"WAIT","orderedAt":"2026-11-17 18:02:11","orderTotal":20000,"deliveryTip":3000,"payAmount":23000,"payMethod":"CARD","paymentStatus":"APPROVED","autoCancelAt":"2026-11-17 18:12:11"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId / status / orderedAt | integer / string / string | `TB_ORD.ORD_ID` / `ORD_STTS` / `ORD_DTTM` |
| orderTotal / deliveryTip | integer / integer | `TB_ORD.ORD_TOT_AMT`(메뉴·옵션 합, 배달팁 제외) / `DLVR_TIP_AMT` |
| payAmount / payMethod / paymentStatus | integer / string / string | `TB_PAY.PAY_AMT` / `PAY_MTHD_CD` / `PAY_STTS` |
| autoCancelAt | string | `TB_ORD.ORD_DTTM + 10분`, 예약 작업 시각이 아닌 미접수 만료 기준 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수값·타입·결제수단·요청사항 길이 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주소 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주소·가게 없음·삭제됨 |
| 409 | EMPTY_CART | 장바구니 없음·항목 없음 |
| 409 | STORE_NOT_APPROVED | 승인 대기·반려 |
| 409 | STORE_CLOSED | 일시중지·영업시간 밖 |
| 409 | MENU_UNAVAILABLE | 메뉴·분류 삭제 또는 품절 |
| 409 | INVALID_OPTION_SELECTION | 필수옵션 누락·선택초과·옵션 삭제·소속 오류 |
| 409 | OUT_OF_DELIVERY_RANGE | 실제 직선거리 > 3000m |
| 409 | MIN_ORDER_NOT_MET | 최신 메뉴·옵션 합계가 최소금액 미만 |
| 409 | INSUFFICIENT_POINTS | POINT 조건부 잔액 차감 실패 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_ADDR`, `TB_STORE`, `TB_STORE_HOURS`, `TB_MENU_CTGR`, `TB_MENU`, `TB_MENU_OPT_GRP`, `TB_MENU_OPT`, `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT` / 바꾸는 테이블: `TB_ORD`, `TB_ORD_DTL`, `TB_ORD_DTL_OPT`, `TB_PAY`, `TB_MBR`(POINT), `TB_PNT_TXN`(POINT), `TB_CART`, `TB_CART_DTL`, `TB_CART_DTL_OPT`.
- 트랜잭션: 모든 검증 → 주문・상세・옵션 스냅샷 → 결제 → POINT 차감·USE → 장바구니 삭제를 하나로 처리. 중간 실패는 전체 롤백.
- 서버 검사: C-18과 같은 소유권·가게 일치·승인·미삭제·영업시간·거리·메뉴·옵션·최소금액 검사를 독립적으로 재수행. 클라이언트 금액은 받지 않으며 `(TB_MENU.MENU_AMT + 선택 TB_MENU_OPT.OPT_AMT 합) × TB_CART_DTL.CART_QTY`로 계산.
- 상태 변경 / VIEW·트리거:
  1. `TB_ORD.ORD_STTS='WAIT'`. 요청을 `STORE_RQST_CN`, `RIDER_RQST_CN`, `CUTLERY_YN`에 저장. 주소의 `TB_MBR_ADDR.MBR_ADDR`, `MBR_DADDR`, `MBR_LAT`, `MBR_LNG`를 `TB_ORD.DLVR_ADDR`, `DLVR_DADDR`, `DLVR_LAT`, `DLVR_LNG`에 복사. 배달팁도 주문 시점 값 저장.
  2. `TB_ORD_DTL.ORD_DTL_SEQ`, `MENU_ID`, `ORD_MENU_NM`, `ORD_QTY`, `ORD_UPRC`와 `TB_ORD_DTL_OPT.OPT_ID`, `ORD_OPT_GRP_NM`, `ORD_OPT_NM`, `ORD_OPT_AMT` 저장. 단가는 옵션 제외이며 그룹명까지 반드시 스냅샷으로 보존.
  3. 주문당 `TB_PAY` 1건, `PAY_AMT=메뉴·옵션 합+배달팁`, `PAY_STTS='APPROVED'`, `PAY_APRV_DTTM=now`. CARD·KAKAO·NAVER도 외부 연동 없는 가상 승인.
  4. POINT 양수 결제이면 `UPDATE TB_MBR SET PNT_BAL_AMT=PNT_BAL_AMT-? WHERE MBR_ID=? AND PNT_BAL_AMT>=?`의 변경 행 수 1 확인 후 `TB_PNT_TXN`에 USE·주문 ID·차감액·거래 후 잔액·COMPLETED 기록. 0원 POINT 결제는 잔액을 변경하지 않고 USE 거래를 생략한다. 잔액 변경 시 `TRG_MBR_MOD_DTTM`이 수정일시 기록.
  5. 본인 `TB_CART` DELETE → FK CASCADE로 항목·옵션 삭제. `TB_DLVR`은 생성하지 않으며 사장 접수 O-03 때 생성한다. 직렬화된 쓰기 트랜잭션에서 장바구니 소비·조건부 잔액 차감으로 중복 사용을 방지한다.

## C-20 고객 주문 내역 목록
- method/path: `GET /api/customer/orders`
- 권한: CUSTOMER
- 설명: 만료 처리를 반영한 본인 주문을 최근 주문순으로 반환한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | status | string | X | ALL(기본), WAIT, COOKING, READY, DELIVERING, DONE, CANCEL |
| query | page / size | integer | X | 기본 1 / 20, size 최대 100 |

### 응답
```json
{"success":true,"data":{"items":[{"orderId":3021,"storeId":10,"storeName":"연세치킨 신촌점","orderedAt":"2026-11-17 18:02:11","status":"WAIT","summary":"후라이드치킨 외 0건","payAmount":23000,"payMethod":"CARD","canCancel":true,"canReview":false}],"page":1,"size":20,"totalCount":1}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| page / size / totalCount / items | integer / integer / integer / array | 페이지 / 크기 / 필터 적용 주문 수 / 주문 목록 |
| items[].orderId / storeId / orderedAt / status | integer / integer / string / string | `TB_ORD.ORD_ID` / `STORE_ID` / `ORD_DTTM` / `ORD_STTS` |
| items[].storeName / summary | string / string | `TB_STORE.STORE_NM` / 첫 `TB_ORD_DTL.ORD_MENU_NM` + 나머지 상세 행 수 |
| items[].payAmount / payMethod | integer / string | `TB_PAY.PAY_AMT` / `PAY_MTHD_CD` |
| items[].canCancel | boolean | 만료 처리 후 `TB_ORD.ORD_STTS='WAIT'` |
| items[].canReview | boolean | 공통 리뷰 신규 조건 전체 충족. 삭제된 리뷰가 있어도 false |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | status·페이지 조건 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_PAY`, `TB_DLVR`, `TB_RVW`, `TB_MBR_RSTR` / 바꾸는 테이블: `TB_ORD`; 취소 트리거 경유 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 WAIT 취소 및 그 연쇄 변경. 이후 상태 필터·건수·목록에 반영한다.
- 서버 검사: 본인 주문만 조회. canReview는 DONE·배달완료 72시간·삭제 포함 리뷰 부재·활성 제재 부재를 교차 검사.
- 상태 변경 / VIEW·트리거: 만료 주문에 `TB_ORD.ORD_STTS='CANCEL'`, `ORD_CNCL_DTTM=now`, `CNCL_ACTR_CD='SYSTEM'`, `CNCL_RSN_CD='NO_RESPONSE'`. `TRG_ORD_CANCEL`과 수정일시 트리거가 연쇄 처리. API 직접 환불 없음.

## C-21 고객 주문 상세·상태 조회
- method/path: `GET /api/customer/orders/{orderId}`
- 권한: CUSTOMER
- 설명: 만료 처리를 반영한 주문 스냅샷과 진행 상태를 반환한다. COOKING 중에도 배차되어 rider가 존재할 수 있다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | orderId | integer | O | 본인 주문 ID |

### 응답
```json
{"success":true,"data":{"orderId":3021,"store":{"storeId":10,"storeName":"연세치킨 신촌점"},"orderedAt":"2026-11-17 18:02:11","status":"COOKING","autoCancelAt":null,"items":[{"menuName":"후라이드치킨","quantity":1,"unitPrice":18000,"options":[{"groupName":"부위 선택","optionName":"순살","price":2000}],"lineTotal":20000}],"storeRequest":"덜 맵게 해주세요","riderRequest":"문 앞에 두어 주세요","cutlery":false,"deliveryAddress":"서울 서대문구 신촌로 25","deliveryAddressDetail":"101호","orderTotal":20000,"deliveryTip":3000,"payAmount":23000,"payMethod":"CARD","acceptedAt":"2026-11-17 18:05:40","cookMinutes":25,"rider":{"name":"박라이더","vehicle":"MOTORCYCLE","dispatchedAt":"2026-11-17 18:06:00","pickedUpAt":null},"deliveredAt":null,"canceledAt":null,"cancelActor":null,"cancelReason":null,"cancelReasonDetail":null,"canCancel":false,"canReview":false,"myReview":{"reviewId":null,"isHidden":false,"canEdit":false}}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId / orderedAt / status | integer / string / string | `TB_ORD.ORD_ID` / `ORD_DTTM` / `ORD_STTS` |
| store.storeId / storeName | integer / string | `TB_ORD.STORE_ID` / `TB_STORE.STORE_NM` |
| autoCancelAt | string 또는 null | WAIT이면 `TB_ORD.ORD_DTTM + 10분`, 나머지 null |
| items[].menuName / quantity / unitPrice | string / integer / integer | `TB_ORD_DTL.ORD_MENU_NM` / `ORD_QTY` / `ORD_UPRC` |
| items[].options[].groupName / optionName / price | string / string / integer | `TB_ORD_DTL_OPT.ORD_OPT_GRP_NM` / `ORD_OPT_NM` / `ORD_OPT_AMT` |
| items[].lineTotal | integer | (주문 단가+옵션 스냅샷 금액 합)×주문 수량 |
| storeRequest / riderRequest / cutlery | string 또는 null / string 또는 null / boolean | `TB_ORD.STORE_RQST_CN` / `RIDER_RQST_CN` / `CUTLERY_YN='Y'` |
| deliveryAddress / deliveryAddressDetail | string / string 또는 null | `TB_ORD.DLVR_ADDR` / `DLVR_DADDR` |
| orderTotal / deliveryTip / payAmount / payMethod | integer / integer / integer / string | `TB_ORD.ORD_TOT_AMT` / `DLVR_TIP_AMT` / `TB_PAY.PAY_AMT` / `PAY_MTHD_CD` |
| acceptedAt / cookMinutes | string 또는 null / integer 또는 null | `TB_ORD.ORD_RCPT_DTTM` / `COOK_EST_MI` |
| rider | object 또는 null | 배차된 라이더, 미배차이면 null |
| rider.name / vehicle | string / string | 라이더 `TB_MBR.MBR_NM` / `TB_RIDER.VHCL_TYPE_CD` |
| rider.dispatchedAt / rider.pickedUpAt | string / string 또는 null | `TB_DLVR.DSPCH_DTTM` / `PKUP_DTTM` |
| deliveredAt | string 또는 null | `TB_DLVR.DLVR_CMPL_DTTM` |
| canceledAt / cancelActor / cancelReason / cancelReasonDetail | string 또는 null | `TB_ORD.ORD_CNCL_DTTM` / `CNCL_ACTR_CD` / `CNCL_RSN_CD` / `ORD_CNCL_RSN_CN` |
| canCancel / canReview | boolean / boolean | 만료 처리 후 WAIT / 공통 리뷰 신규 조건 |
| myReview.reviewId / isHidden / canEdit | integer 또는 null / boolean / boolean | 본인 미삭제 `TB_RVW.RVW_ID`(숨김 포함) / `RVW_HDN_YN='Y'` / 공통 리뷰 수정 조건. 리뷰 없으면 null·false·false |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주문 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주문 없음 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_RIDER`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_ORD_DTL_OPT`, `TB_PAY`, `TB_DLVR`, `TB_RVW`, `TB_MBR_RSTR` / 바꾸는 테이블: `TB_ORD`; 취소 트리거 경유 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 본인 주문 확인 후 조회 전 만료 WAIT 취소·연쇄 변경.
- 서버 검사: 본인 소유, canReview·canEdit 조건 및 주문↔배달 일시 정합성. 리뷰 존재 검사는 삭제된 행도 포함해 재작성 차단.
- 상태 변경 / VIEW·트리거: 만료 시 SYSTEM/NO_RESPONSE로 CANCEL UPDATE → `TRG_ORD_CANCEL` 처리. 메뉴·옵션·주소는 현재 값이 아닌 주문 스냅샷 사용. 예상배달 소요시간 계산은 접수 조리분+가게와 주문 배달지의 직선거리(km)×3을 분 단위 올림하며 배차 대기는 제외한다. 원본 응답에 해당 결과 필드는 없어 임의로 추가하지 않는다.

## C-22 고객 주문 취소
- method/path: `POST /api/customer/orders/{orderId}/cancel`
- 권한: CUSTOMER
- 설명: 만료되지 않은 본인 WAIT 주문만 직접 취소한다. 사유는 입력받지 않는다.

- refunded는 결제 취소 완료 여부이며 결제수단과 관계없이 취소 성공 시 true이다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | orderId | integer | O | 본인 주문 ID, 본문 없음 |

### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"CANCEL","cancelActor":"CUSTOMER","cancelReason":"CUSTOMER_REQUEST","canceledAt":"2026-11-17 18:04:00","refunded":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId / status / cancelActor / cancelReason / canceledAt | integer / string / string / string / string | `TB_ORD.ORD_ID` / `ORD_STTS` / `CNCL_ACTR_CD` / `CNCL_RSN_CD` / `ORD_CNCL_DTTM` |
| refunded | boolean | `TB_PAY.PAY_STTS='CANCELED'`인 결제 취소 완료 여부. 성공 응답은 모든 결제수단에서 true이며 POINT 잔액 환불 여부와는 별개 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주문 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주문 없음 |
| 409 | ORDER_ALREADY_PROCESSED | 10분 만료 또는 접수·취소 등으로 WAIT 아님, 조건부 UPDATE 변경 행 수 0 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_PAY`, `TB_PNT_TXN`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`; 취소 트리거 경유 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 소유권 확인·만료 검사·조건부 취소 및 트리거 연쇄 변경 전체. 만료면 SYSTEM 취소를 커밋한 뒤 409 반환.
- 서버 검사: 본인 주문, 같은 트랜잭션에서 `TB_ORD.ORD_DTTM + 10분` 경과 확인. 만료면 SYSTEM/NO_RESPONSE로 먼저 취소하며 고객 취소로 덮지 않는다. 미만료면 `WHERE ORD_ID=? AND MBR_ID=? AND ORD_STTS='WAIT'` 조건부 UPDATE 행 수로 경합 판정.
- 상태 변경 / VIEW·트리거: 직접 취소는 `TB_ORD.ORD_STTS='CANCEL'`, `ORD_CNCL_DTTM=now`, `CNCL_ACTR_CD='CUSTOMER'`, `CNCL_RSN_CD='CUSTOMER_REQUEST'`. CANCEL UPDATE → `TRG_ORD_CANCEL`이 결제 취소·포인트 환불·라이더 IDLE 처리. 승인 POINT만 잔액·양수 REFUND 거래, 나머지는 결제 상태만 CANCELED. API가 환불·결제·라이더 UPDATE를 다시 하지 않으며 수정일시도 트리거 처리.

## C-23 내 리뷰 목록 (선택)
- method/path: `GET /api/customer/reviews`
- 권한: CUSTOMER
- 설명: 본인 미삭제 리뷰를 최신순으로 반환한다. 관리자 숨김 리뷰도 관리 목적으로 표시한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | page / size | integer | X | 기본 1 / 20, size 최대 100 |

### 응답
```json
{"success":true,"data":{"items":[{"reviewId":701,"orderId":2990,"storeId":10,"storeName":"연세치킨 신촌점","rating":5,"content":"맛있어요","createdAt":"2026-11-17 20:11:03","canEdit":true,"reply":{"content":"감사합니다!","createdAt":"2026-11-17 21:00:00"},"isHidden":false}],"page":1,"size":20,"totalCount":1}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| page / size / totalCount / items | integer / integer / integer / array | 페이지 / 크기 / 본인 미삭제 리뷰 수 / 리뷰 목록 |
| items[].reviewId / orderId / rating / content / createdAt | integer / integer / integer / string 또는 null / string | `TB_RVW.RVW_ID` / `ORD_ID` / `RVW_RTNG` / `RVW_CN` / `REG_DTTM` |
| items[].storeId / storeName | integer / string | `TB_ORD.STORE_ID` / `TB_STORE.STORE_NM` |
| items[].isHidden / canEdit | boolean / boolean | `TB_RVW.RVW_HDN_YN='Y'` / 공통 리뷰 수정 조건 |
| items[].reply | object 또는 null | 미삭제 답글, 없으면 null |
| items[].reply.content / createdAt | string / string | `TB_RVW_REPLY.RVW_REPLY_CN` / `REG_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 페이지 조건 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | CUSTOMER 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_DLVR`, `TB_RVW`, `TB_RVW_REPLY` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 주문 회원으로 본인 리뷰 확인, `TB_RVW.DEL_YN='N'`만 목록화. DONE·배달완료 72시간·미숨김으로 canEdit 계산. 제재를 기존 리뷰 수정에 확대 적용하지 않는다.
- 상태 변경 / VIEW·트리거: 없음. 공개 평점에는 숨김 리뷰가 포함되지 않음.

## C-24 리뷰 작성
- method/path: `POST /api/customer/orders/{orderId}/review`
- 권한: CUSTOMER
- 설명: 본인 배달완료 주문에 리뷰를 한 번 작성한다. 삭제한 리뷰도 재작성할 수 없다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | orderId | integer | O | 본인 주문 ID |
| body | rating | integer | O | 1~5 |
| body | content | string | X | 최대 1,000자. 생략 시 NULL 저장 |

### 응답
```json
{"success":true,"data":{"reviewId":701,"orderId":2990,"rating":5,"content":null,"createdAt":"2026-11-17 21:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| reviewId / orderId / rating / content / createdAt | integer / integer / integer / string 또는 null / string | `TB_RVW.RVW_ID` / `ORD_ID` / `RVW_RTNG` / `RVW_CN` / `REG_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·평점 형식/범위·내용 타입/길이 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 주문 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 주문 없음 |
| 409 | ORDER_NOT_DELIVERED | DONE 아님 또는 배달완료일시 없음 |
| 409 | REVIEW_PERIOD_EXPIRED | `TB_DLVR.DLVR_CMPL_DTTM`부터 72시간 초과 |
| 409 | REVIEW_ALREADY_EXISTS | 해당 주문 리뷰 행 존재, 논리 삭제 포함 |
| 409 | REVIEW_RESTRICTED | 활성 REVIEW_WRITE 제재 존재 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_DLVR`, `TB_RVW`, `TB_MBR_RSTR` / 바꾸는 테이블: `TB_RVW`.
- 트랜잭션: 본인·상태·기한·제재·기존 리뷰 검사와 INSERT 전체.
- 서버 검사: 본인 주문 `TB_ORD.ORD_STTS='DONE'`, `TB_DLVR.ORD_ID` 일치 및 완료일시부터 72시간 이내, 현재 활성 `TB_MBR_RSTR.RSTR_TYPE_CD='REVIEW_WRITE'` 없음, `TB_RVW.ORD_ID` 행 없음(DEL_YN으로 거르지 않음). 주문 상태·배달완료 일시 교차 검사를 서버에서 수행.
- 상태 변경 / VIEW·트리거: `TB_RVW.RVW_HDN_YN='N'`, `DEL_YN='N'`, 생략 content는 `RVW_CN=NULL`. 주문당 UNIQUE가 중복을 마지막으로 방어. `V_STORE_RATING`은 다음 조회부터 자동 반영하며 별도 평점 UPDATE 없음.

## C-25 리뷰 수정
- method/path: `PATCH /api/customer/reviews/{reviewId}`
- 권한: CUSTOMER
- 설명: 본인 미숨김·미삭제 리뷰의 보낸 필드만 수정한다. 신규 작성 제한은 기존 리뷰 수정에 적용하지 않는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | reviewId | integer | O | 리뷰 ID |
| body | rating | integer | X | 1~5 |
| body | content | string 또는 null | X | 최대 1,000자. null 또는 빈 문자열(앞뒤 공백 제거 후)이면 내용을 지우고 `RVW_CN=NULL` 저장 |
| body | — | — | — | rating·content 중 최소 1개. 생략 필드는 기존 값 유지 |

### 응답
```json
{"success":true,"data":{"reviewId":701,"rating":4,"content":"맛있었어요","updatedAt":"2026-11-17 22:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| reviewId / rating / content / updatedAt | integer / integer / string 또는 null / string | `TB_RVW.RVW_ID` / `RVW_RTNG` / `RVW_CN` / `MOD_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 수정값 없음·ID·평점·내용 타입/길이 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 리뷰 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 리뷰 없음·논리 삭제됨 |
| 409 | REVIEW_PERIOD_EXPIRED | 배달완료부터 72시간 초과 |
| 409 | REVIEW_UNAVAILABLE | 관리자 숨김 또는 주문·배달완료 조건 불충족 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_DLVR`, `TB_RVW` / 바꾸는 테이블: `TB_RVW`.
- 트랜잭션: 소유권·상태·기한 확인과 리뷰 UPDATE 전체.
- 서버 검사: 주문을 통해 본인 리뷰 확인, DONE·실제 배달완료부터 72시간 이내·미삭제·미숨김 확인. 활성 제재 검사는 신규 작성에만 적용하므로 수정에는 적용하지 않음.
- 상태 변경 / VIEW·트리거: 제공한 `TB_RVW.RVW_RTNG`, `RVW_CN`만 변경. `TRG_RVW_MOD_DTTM`이 수정일시 기록 후 해당 값을 조회해 응답. `V_STORE_RATING` 자동 반영.

## C-26 리뷰 삭제
- method/path: `DELETE /api/customer/reviews/{reviewId}`
- 권한: CUSTOMER
- 설명: 본인 리뷰를 기간·숨김 여부와 무관하게 논리 삭제한다. 삭제 후 해당 주문에 재작성 불가하다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | reviewId | integer | O | 리뷰 ID, 본문 없음 |

### 응답
```json
{"success":true,"data":{"reviewId":701,"deleted":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| reviewId / deleted | integer / boolean | `TB_RVW.RVW_ID` / `DEL_YN='Y'` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | 타인 리뷰 또는 CUSTOMER 아님 |
| 404 | NOT_FOUND | 리뷰 없음·이미 논리 삭제됨 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_RVW` / 바꾸는 테이블: `TB_RVW`.
- 트랜잭션: 본인 소유 확인과 논리 삭제 UPDATE.
- 서버 검사: 리뷰의 주문 회원이 본인인지 확인. 72시간·숨김·신규 제재에 관계없이 삭제 허용.
- 상태 변경 / VIEW·트리거: `TB_RVW.DEL_YN='Y'`, 행과 주문 UNIQUE는 유지. `TRG_RVW_MOD_DTTM`이 기록하며 `V_STORE_RATING`에서 제외. 답글 행은 별도로 삭제하지 않으며 공개 조회가 삭제 리뷰를 제외한다.
