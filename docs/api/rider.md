# 라이더 API

## 공통 규칙

| 항목 | 규칙 |
|---|---|
| 인증 | D-01은 비로그인 허용. 나머지는 HMAC 서명 세션 쿠키(Node `crypto`)를 검증하고 요청마다 `TB_MBR.MBR_STTS='ACTIVE'`, `TB_MBR.MBR_ROLE_CD='RIDER'` 확인 |
| 성공·실패 | 성공 `{ "success": true, "data": ... }`. 실패 `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "입력값을 확인해 주세요.", "fields": { "actRadiusM": "500~5000의 정수여야 합니다." } }`. `fields`는 입력 오류일 때 선택적으로 제공 |
| 형식 | 요청 본문은 JSON. 일시 `YYYY-MM-DD HH:mm:ss`(한국 시간), 금액은 원 단위 정수, 거리는 m 단위 정수 |
| 페이지 | D-09만 페이지 적용. `page` 기본 1, `size` 기본 20·최대 100. 나머지 목록은 배열 |
| 위치 | 서버 한 곳에 둔 숭실대 좌표 상수 `(37.4963, 126.9575)` 사용. D-04의 선택 쿼리 `lat`, `lng` 유지. 현재 화면은 두 값을 보내지 않음 |
| 배달 기록 | O-03 접수 시 `TB_DLVR.RIDER_MBR_ID=NULL`로 생성. 별도 배달 상태 컬럼 없이 `TB_ORD.ORD_STTS`와 `TB_DLVR.DSPCH_DTTM`, `TB_DLVR.PKUP_DTTM`, `TB_DLVR.DLVR_CMPL_DTTM`으로 판단 |
| 미접수 만료 | 주문을 조회하는 D-02·D-04·D-06·D-09는 조회 전에 `TB_ORD.ORD_STTS='WAIT'`이고 `TB_ORD.ORD_DTTM + 10분`이 지난 주문을 SYSTEM 취소. `TB_ORD.ORD_STTS='CANCEL'`, `TB_ORD.ORD_CNCL_DTTM=현재 일시`, `TB_ORD.CNCL_ACTR_CD='SYSTEM'`, `TB_ORD.CNCL_RSN_CD='NO_RESPONSE'` 기록. 예약 작업 없음 |
| 취소 연쇄 처리 | `TB_ORD.ORD_STTS='CANCEL'` UPDATE → `TRG_ORD_CANCEL`이 결제 취소·POINT 결제 포인트 환불과 REFUND 거래·배차된 미완료 라이더 IDLE 처리를 수행. API가 중복 수행하지 않음 |
| 수정 일시 | UPDATE의 `MOD_DTTM`은 해당 `TRG_*_MOD_DTTM`이 기록. API가 직접 지정하지 않음 |
| 공통 API | 로그인 A-01, 로그아웃 A-02, 회원 정보 조회·수정 A-03, 탈퇴 A-07은 공통 인증 문서 참조 |

### 배달 흐름과 취소 화면

| 단계 | 주문 | 배달 기록 | 라이더 |
|---|---|---|---|
| 사장 접수 O-03 | WAIT → COOKING | 라이더 없이 배달 행 생성 | 변화 없음 |
| 배차 수락 D-05 | COOKING 또는 READY 유지 | 라이더·배차 일시 기록 | IDLE → BUSY |
| 사장 조리 완료 | COOKING → READY | 변화 없음 | BUSY 유지 |
| 픽업 D-07 | READY → DELIVERING | 픽업 일시 기록 | BUSY 유지 |
| 완료 D-08 | DELIVERING → DONE | 완료 일시 기록 | BUSY → IDLE |
| 사장 취소 O-06·고객센터 취소 X-13 등 | CANCEL | 기존 배차·픽업 기록 유지, 완료로 처리하지 않음 | `TRG_ORD_CANCEL`이 미완료 배달 라이더를 IDLE로 변경 |

- 한 라이더는 동시에 한 건만 수행하며 직접 배차를 취소하는 API는 없다.
- 취소 후 다음 D-06 폴링은 `data: null`, D-02는 `riderStatus: "IDLE"`, `currentDeliveryId: null`을 반환한다. 화면은 배차 대기 목록으로 돌아가며 취소 주문은 D-04·D-09에 나타나지 않는다.
- D-04는 5초, D-06은 10초 폴링한다. 픽업 버튼은 READY, 완료 버튼은 DELIVERING일 때만 활성화한다.

## D-01 라이더 회원가입

- method/path: `POST /api/auth/signup`
- 권한: 누구나(로그인 불필요)
- 설명: RIDER 회원과 라이더 정보를 함께 생성한다. 관리자 승인은 필요하지 않다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | role | string | O | `RIDER` |
| body | email | string | O | 이메일 형식. `TB_MBR.MBR_EMAIL` |
| body | password | string | O | 8자 이상. 해시하여 `TB_MBR.MBR_PWD` 저장 |
| body | name | string | O | 이름. `TB_MBR.MBR_NM` |
| body | tel | string | O | 연락처. `TB_MBR.MBR_TELNO` |
| body | vehicleType | string | O | `WALK`, `BICYCLE`, `MOTORCYCLE`, `CAR` |
| body | actRadiusM | number | X | 500~5000 정수. 생략 시 3000 |

### 응답

201

```json
{ "success": true, "data": { "memberId": 31, "role": "RIDER" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | 생성한 `TB_MBR.MBR_ID` |
| role | string | `TB_MBR.MBR_ROLE_CD`, `RIDER` |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수값 누락, 이메일·비밀번호·운송수단·반경 형식 오류 |
| 409 | DUPLICATE_EMAIL | 같은 이메일의 `TB_MBR.MBR_STTS='ACTIVE'` 회원 존재. 역할과 무관하며 탈퇴 회원은 제외 |

### DB 처리

- 읽는 테이블: `TB_MBR` / 바꾸는 테이블: `TB_MBR`, `TB_RIDER`.
- 트랜잭션: 활성 이메일 중복 확인 → 비밀번호 해시를 포함한 `TB_MBR` INSERT(`TB_MBR.MBR_ROLE_CD='RIDER'`, `TB_MBR.MBR_STTS='ACTIVE'`) → 생성한 회원 ID로 `TB_RIDER` INSERT. 어느 단계든 실패하면 전체 롤백.
- 서버 검사: 운송수단 4개, 반경 정수 500~5000. 이메일 중복은 ACTIVE 회원만 검사하고 부분 UNIQUE 인덱스 `UK_MBR_EMAIL_ACTIVE` 충돌도 DUPLICATE_EMAIL로 반환한다. WITHDRAWN 회원의 이메일은 재사용 가능하다.
- 상태 변경 / VIEW·트리거: `TB_RIDER.VHCL_TYPE_CD`, `TB_RIDER.ACT_RADIUS_M`을 저장하고 `TB_RIDER.RIDER_STTS='IDLE'`로 시작. VIEW 사용 없음.

## D-02 내 라이더 정보

- method/path: `GET /api/rider/me`
- 권한: RIDER
- 설명: 진입 화면에서 활동 정보와 현재 배달 번호를 조회한다. BUSY면 현재 배달, IDLE이면 배차 대기 화면으로 이동한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 세션 회원 기준 |

### 응답

200

```json
{ "success": true, "data": { "memberId": 31, "name": "김라이더", "tel": "010-1234-5678", "vehicleType": "MOTORCYCLE", "actRadiusM": 3000, "riderStatus": "IDLE", "currentDeliveryId": null } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | `TB_MBR.MBR_ID` |
| name | string | `TB_MBR.MBR_NM` |
| tel | string | `TB_MBR.MBR_TELNO` |
| vehicleType | string | `TB_RIDER.VHCL_TYPE_CD` |
| actRadiusM | number | `TB_RIDER.ACT_RADIUS_M` |
| riderStatus | string | `TB_RIDER.RIDER_STTS`, IDLE 또는 BUSY |
| currentDeliveryId | number 또는 null | BUSY일 때 내 미완료·비취소 배달의 `TB_DLVR.DLVR_ID`. IDLE이면 null |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 |
| 404 | NOT_FOUND | 라이더 정보 없음 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_RIDER`, `TB_DLVR`, `TB_ORD` / 바꾸는 테이블: 조회 전 만료 취소의 `TB_ORD`와 트리거 연쇄 대상 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 취소와 트리거 처리는 하나의 쓰기 트랜잭션. 이후 회원·라이더·현재 배달을 일관된 조회로 반환.
- 서버 검사: BUSY면 `TB_DLVR.RIDER_MBR_ID=세션 회원 ID`, `TB_DLVR.DLVR_CMPL_DTTM IS NULL`, 연결된 `TB_ORD.ORD_STTS<>'CANCEL'`인 배달을 찾는다. 동시에 진행 중인 배달은 최대 1건이다.
- 상태 변경 / VIEW·트리거: 조회 자체의 상태 변경·VIEW 사용 없음. 만료 취소는 공통 규칙의 `TRG_ORD_CANCEL` 처리.

## D-03 활동 정보 수정

- method/path: `PATCH /api/rider/me`
- 권한: RIDER
- 설명: 대기 중 운송수단·활동 반경에서 보낸 필드만 수정한다. 이름·연락처·비밀번호는 A-03을 사용한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | vehicleType | string | X | `WALK`, `BICYCLE`, `MOTORCYCLE`, `CAR` |
| body | actRadiusM | number | X | 500~5000 정수 |

두 필드 중 하나 이상 전송한다. 생략 필드는 유지하며 null은 허용하지 않는다.

### 응답

200

```json
{ "success": true, "data": { "memberId": 31, "name": "김라이더", "tel": "010-1234-5678", "vehicleType": "MOTORCYCLE", "actRadiusM": 2000, "riderStatus": "IDLE", "currentDeliveryId": null } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | `TB_MBR.MBR_ID` |
| name | string | `TB_MBR.MBR_NM` |
| tel | string | `TB_MBR.MBR_TELNO` |
| vehicleType | string | 수정 후 `TB_RIDER.VHCL_TYPE_CD` |
| actRadiusM | number | 수정 후 `TB_RIDER.ACT_RADIUS_M` |
| riderStatus | string | `TB_RIDER.RIDER_STTS`, 성공 시 IDLE |
| currentDeliveryId | null | 대기 중에만 수정 가능하므로 null |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 수정 필드 없음, 허용하지 않는 운송수단·반경 또는 null |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 |
| 404 | NOT_FOUND | 라이더 정보 없음 |
| 409 | RIDER_BUSY | 배달 중 활동 정보 수정 시도 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_RIDER` / 바꾸는 테이블: `TB_RIDER`.
- 트랜잭션: 라이더 상태 확인 → `TB_RIDER.RIDER_STTS='IDLE'` 조건으로 전달 필드만 UPDATE → 수정 결과 조회. 배차 수락과 경합해도 BUSY 상태의 수정은 허용하지 않는다.
- 서버 검사: 세션 회원의 라이더 행, 활동 정보 입력 제약과 IDLE 상태를 검사한다.
- 상태 변경 / VIEW·트리거: 상태는 변경하지 않는다. `TRG_RIDER_MOD_DTTM`이 수정 일시를 기록. VIEW 사용 없음.

## D-04 배차 대기 목록

- method/path: `GET /api/rider/dispatch-requests`
- 권한: RIDER
- 설명: 내 활동 반경 안의 미배차 요청을 배열로 조회한다(5초 폴링). BUSY여도 조회는 가능하고 수락만 제한된다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | lat | number | X | 유한한 위도 -90~90. 생략 시 37.4963 |
| query | lng | number | X | 유한한 경도 -180~180. 생략 시 126.9575 |

현재 화면은 좌표를 보내지 않으므로 서버의 숭실대 상수를 사용한다. GPS 수집·위치 저장은 하지 않는다.

### 응답

200. 대상이 없으면 `data: []`.

```json
{ "success": true, "data": [{ "deliveryId": 205, "orderId": 1042, "storeName": "상도치킨", "storeAddress": "서울 동작구 상도로 300", "storeLat": 37.4985, "storeLng": 126.9530, "distanceToStoreM": 450, "deliveryAddress": "서울 동작구 상도동 123", "deliveryDistanceM": 1800, "deliveryTip": 3000, "orderStatus": "COOKING", "expectedReadyAt": "2026-11-24 18:42:00" }] }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].deliveryId | number | `TB_DLVR.DLVR_ID` |
| [].orderId | number | `TB_ORD.ORD_ID` |
| [].storeName | string | `TB_STORE.STORE_NM` |
| [].storeAddress | string | `TB_STORE.STORE_ADDR` |
| [].storeLat | number | `TB_STORE.STORE_LAT` |
| [].storeLng | number | `TB_STORE.STORE_LNG` |
| [].distanceToStoreM | number | 기준 위치 → 가게 하버사인 직선거리(m), 응답은 정수 반올림 |
| [].deliveryAddress | string | `TB_ORD.DLVR_ADDR`, 기본 주소만. 상세 주소는 수락 후 D-06 제공 |
| [].deliveryDistanceM | number | 가게 좌표 → `TB_ORD.DLVR_LAT`, `TB_ORD.DLVR_LNG` 하버사인 직선거리(m), 정수 반올림 |
| [].deliveryTip | number | 주문 시점 `TB_ORD.DLVR_TIP_AMT` |
| [].orderStatus | string | `TB_ORD.ORD_STTS`, COOKING 또는 READY |
| [].expectedReadyAt | string | `TB_ORD.ORD_RCPT_DTTM + TB_ORD.COOK_EST_MI`분. READY면 과거 일시일 수 있음 |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 좌표가 숫자가 아니거나 범위 밖 |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 |
| 404 | NOT_FOUND | 라이더 정보 없음 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_RIDER`, `TB_DLVR`, `TB_ORD`, `TB_STORE` / 바꾸는 테이블: 조회 전 만료 취소의 `TB_ORD`와 트리거 연쇄 대상 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 취소와 트리거 처리는 하나의 쓰기 트랜잭션. 목록 조회 자체는 읽기 전용.
- 서버 검사: `TB_DLVR.RIDER_MBR_ID IS NULL`이며 연결된 `TB_ORD.ORD_STTS IN ('COOKING','READY')`인 행만 조회. Node에서 하버사인으로 기준 위치 → 가게 거리를 계산하고 반올림 전 거리 `<= TB_RIDER.ACT_RADIUS_M`인 행만 남긴다. 가게 → 배달지 거리도 Node에서 계산한다.
- 상태 변경 / VIEW·트리거: `expectedReadyAt` 오름차순, 페이지 없이 전체 배열 반환. VIEW 사용 없음. 만료 취소는 공통 규칙의 `TRG_ORD_CANCEL` 처리.

## D-05 배차 수락

- method/path: `POST /api/rider/deliveries/{deliveryId}/accept`
- 권한: RIDER
- 설명: 미배차 요청 한 건을 선점하고 BUSY로 전환한다. 성공하면 현재 배달 화면으로 이동한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | deliveryId | number | O | 양의 정수, `TB_DLVR.DLVR_ID` |
| body | 없음 | — | — | 본문 없음 |

### 응답

200. D-06의 현재 배달과 같은 객체.

```json
{ "success": true, "data": { "deliveryId": 205, "orderId": 1042, "orderStatus": "COOKING", "store": { "name": "상도치킨", "address": "서울 동작구 상도로 300", "tel": "02-123-4567", "lat": 37.4985, "lng": 126.9530 }, "delivery": { "address": "서울 동작구 상도동 123", "addressDetail": "101동 1001호", "lat": 37.5012, "lng": 126.9481, "customerTel": "010-9876-5432", "riderRequest": "문 앞에 두고 벨 눌러주세요" }, "itemSummary": "후라이드치킨 외 1건", "itemCount": 2, "deliveryTip": 3000, "expectedReadyAt": "2026-11-24 18:42:00", "dispatchedAt": "2026-11-24 18:25:00", "pickedUpAt": null } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| deliveryId | number | `TB_DLVR.DLVR_ID` |
| orderId | number | `TB_ORD.ORD_ID` |
| orderStatus | string | `TB_ORD.ORD_STTS`, 수락 직후 COOKING 또는 READY |
| store.name / store.address / store.tel | string | `TB_STORE.STORE_NM` / `TB_STORE.STORE_ADDR` / `TB_STORE.STORE_TELNO` |
| store.lat / store.lng | number | `TB_STORE.STORE_LAT` / `TB_STORE.STORE_LNG` |
| delivery.address | string | `TB_ORD.DLVR_ADDR` |
| delivery.addressDetail | string 또는 null | `TB_ORD.DLVR_DADDR` |
| delivery.lat / delivery.lng | number | `TB_ORD.DLVR_LAT` / `TB_ORD.DLVR_LNG` |
| delivery.customerTel | string 또는 null | 해당 배달에 배차된 라이더에게만 주문 고객의 실제 `TB_MBR.MBR_TELNO` 제공. 탈퇴 고객은 null |
| delivery.riderRequest | string 또는 null | `TB_ORD.RIDER_RQST_CN` |
| itemSummary | string | `TB_ORD_DTL.ORD_DTL_SEQ` 첫 행의 `TB_ORD_DTL.ORD_MENU_NM` + 나머지 행이 있으면 ` 외 N건` |
| itemCount | number | 해당 주문의 `TB_ORD_DTL` 행 수(수량 합계 아님) |
| deliveryTip | number | `TB_ORD.DLVR_TIP_AMT` |
| expectedReadyAt | string | `TB_ORD.ORD_RCPT_DTTM + TB_ORD.COOK_EST_MI`분 |
| dispatchedAt | string | `TB_DLVR.DSPCH_DTTM` |
| pickedUpAt | null | 수락 직후 `TB_DLVR.PKUP_DTTM`은 null |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | deliveryId가 양의 정수가 아님 |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 |
| 404 | NOT_FOUND | 배달 또는 라이더 정보 없음 |
| 409 | ORDER_ALREADY_PROCESSED | 1순위: 연결 주문이 COOKING·READY가 아님(취소 포함) |
| 409 | ALREADY_DISPATCHED | 2순위: 이미 다른 라이더 또는 본인에게 배차됨 |
| 409 | RIDER_BUSY | 3순위: 요청은 수락 가능하지만 본인이 이미 배달 중 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_RIDER`, `TB_DLVR`, `TB_ORD`, `TB_STORE`, `TB_ORD_DTL` / 바꾸는 테이블: `TB_DLVR`, `TB_RIDER`.
- 트랜잭션: `BEGIN IMMEDIATE` 안에서 대상 확인 → 주문 상태 검사 → `TB_DLVR.RIDER_MBR_ID IS NULL` 조건으로 라이더 ID·배차 일시 UPDATE → `TB_RIDER.MBR_ID=세션 회원 ID AND TB_RIDER.RIDER_STTS='IDLE'` 조건으로 BUSY UPDATE → 응답 조회. 실패하면 선점까지 전체 롤백.
- 서버 검사: 실패 우선순위는 주문 상태 → 배차 여부 → 라이더 BUSY. 배달 조건부 UPDATE 결과 0행이면 ALREADY_DISPATCHED, 라이더 조건부 UPDATE 결과 0행이면 RIDER_BUSY. better-sqlite3의 동기 쓰기와 같은 트랜잭션의 조건부 UPDATE로 동일 배달 중복 배차와 한 라이더의 동시 2건 수락을 방지한다.
- 상태 변경 / VIEW·트리거: API가 `TB_DLVR.RIDER_MBR_ID`, `TB_DLVR.DSPCH_DTTM`과 `TB_RIDER.RIDER_STTS='BUSY'`를 함께 기록. 주문 상태는 유지. `TRG_DLVR_MOD_DTTM`, `TRG_RIDER_MOD_DTTM` 적용. VIEW 사용 없음.

## D-06 현재 배달

- method/path: `GET /api/rider/deliveries/current`
- 권한: RIDER
- 설명: 내가 맡은 진행 중 배달 한 건을 조회한다(10초 폴링). 없으면 null을 반환한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 세션 회원 기준 |

### 응답

200. 진행 중 배달이 없거나 완료·취소된 경우 `{ "success": true, "data": null }`.

```json
{ "success": true, "data": { "deliveryId": 205, "orderId": 1042, "orderStatus": "READY", "store": { "name": "상도치킨", "address": "서울 동작구 상도로 300", "tel": "02-123-4567", "lat": 37.4985, "lng": 126.9530 }, "delivery": { "address": "서울 동작구 상도동 123", "addressDetail": "101동 1001호", "lat": 37.5012, "lng": 126.9481, "customerTel": "010-9876-5432", "riderRequest": "문 앞에 두고 벨 눌러주세요" }, "itemSummary": "후라이드치킨 외 1건", "itemCount": 2, "deliveryTip": 3000, "expectedReadyAt": "2026-11-24 18:42:00", "dispatchedAt": "2026-11-24 18:25:00", "pickedUpAt": null } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | object 또는 null | 내 진행 중 배달, 없으면 null |
| deliveryId | number | `TB_DLVR.DLVR_ID` |
| orderId | number | `TB_ORD.ORD_ID` |
| orderStatus | string | `TB_ORD.ORD_STTS`, 정상 흐름에서 COOKING·READY·DELIVERING |
| store.name / store.address / store.tel | string | `TB_STORE.STORE_NM` / `TB_STORE.STORE_ADDR` / `TB_STORE.STORE_TELNO` |
| store.lat / store.lng | number | `TB_STORE.STORE_LAT` / `TB_STORE.STORE_LNG` |
| delivery.address | string | `TB_ORD.DLVR_ADDR` |
| delivery.addressDetail | string 또는 null | `TB_ORD.DLVR_DADDR` |
| delivery.lat / delivery.lng | number | `TB_ORD.DLVR_LAT` / `TB_ORD.DLVR_LNG` |
| delivery.customerTel | string 또는 null | 해당 배달에 배차된 라이더에게만 주문 고객의 실제 `TB_MBR.MBR_TELNO` 제공. 탈퇴 고객은 null |
| delivery.riderRequest | string 또는 null | `TB_ORD.RIDER_RQST_CN`. 가게 요청사항은 제공하지 않음 |
| itemSummary | string | `TB_ORD_DTL.ORD_DTL_SEQ` 첫 행의 `TB_ORD_DTL.ORD_MENU_NM` + 나머지 행이 있으면 ` 외 N건`. 메뉴별 가격·옵션 상세는 제공하지 않음 |
| itemCount | number | `TB_ORD_DTL` 행 수, 수량 합계 아님 |
| deliveryTip | number | `TB_ORD.DLVR_TIP_AMT` |
| expectedReadyAt | string | `TB_ORD.ORD_RCPT_DTTM + TB_ORD.COOK_EST_MI`분 |
| dispatchedAt | string | `TB_DLVR.DSPCH_DTTM` |
| pickedUpAt | string 또는 null | `TB_DLVR.PKUP_DTTM`, 픽업 전 null |


### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 |

배달이 없다는 이유로 404를 반환하지 않는다.

### DB 처리

- 읽는 테이블: `TB_MBR`(인증·주문 고객 연락처), `TB_DLVR`, `TB_ORD`, `TB_ORD_DTL`, `TB_STORE` / 바꾸는 테이블: 조회 전 만료 취소의 `TB_ORD`와 트리거 연쇄 대상 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 취소와 트리거 처리는 하나의 쓰기 트랜잭션. 배달·주문·요약·연락처는 일관된 읽기 범위에서 조회한다.
- 서버 검사: `TB_DLVR.RIDER_MBR_ID=세션 회원 ID`, `TB_DLVR.DLVR_CMPL_DTTM IS NULL`, `TB_ORD.ORD_STTS<>'CANCEL'`인 내 배달만 조회. 서버의 완료 트랜잭션이 DONE과 완료 일시를 함께 기록하므로 정상 데이터에서 DONE은 포함되지 않는다.
- 상태 변경 / VIEW·트리거: 조회 자체의 상태 변경·VIEW 사용 없음. 취소 트리거는 배차 기록을 지우지 않으므로 주문의 CANCEL 제외 조건이 필수다. 만료 취소는 공통 규칙의 `TRG_ORD_CANCEL` 처리.

## D-07 픽업 완료

- method/path: `POST /api/rider/deliveries/{deliveryId}/pickup`
- 권한: RIDER(해당 배달에 배차된 본인)
- 설명: 조리가 끝난 READY 주문만 픽업 처리한다. 조리 중 가게에 도착해도 COOKING 상태에서는 처리할 수 없다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | deliveryId | number | O | 양의 정수, `TB_DLVR.DLVR_ID` |
| body | 없음 | — | — | 본문 없음 |

### 응답

200. D-06과 같은 객체에 픽업 결과를 반영한다.

```json
{ "success": true, "data": { "deliveryId": 205, "orderId": 1042, "orderStatus": "DELIVERING", "store": { "name": "상도치킨", "address": "서울 동작구 상도로 300", "tel": "02-123-4567", "lat": 37.4985, "lng": 126.9530 }, "delivery": { "address": "서울 동작구 상도동 123", "addressDetail": "101동 1001호", "lat": 37.5012, "lng": 126.9481, "customerTel": "010-9876-5432", "riderRequest": "문 앞에 두고 벨 눌러주세요" }, "itemSummary": "후라이드치킨 외 1건", "itemCount": 2, "deliveryTip": 3000, "expectedReadyAt": "2026-11-24 18:42:00", "dispatchedAt": "2026-11-24 18:25:00", "pickedUpAt": "2026-11-24 18:44:00" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| deliveryId | number | `TB_DLVR.DLVR_ID` |
| orderId | number | `TB_ORD.ORD_ID` |
| orderStatus | string | 변경 후 `TB_ORD.ORD_STTS`, DELIVERING |
| store.name / store.address / store.tel | string | `TB_STORE.STORE_NM` / `TB_STORE.STORE_ADDR` / `TB_STORE.STORE_TELNO` |
| store.lat / store.lng | number | `TB_STORE.STORE_LAT` / `TB_STORE.STORE_LNG` |
| delivery.address | string | `TB_ORD.DLVR_ADDR` |
| delivery.addressDetail | string 또는 null | `TB_ORD.DLVR_DADDR` |
| delivery.lat / delivery.lng | number | `TB_ORD.DLVR_LAT` / `TB_ORD.DLVR_LNG` |
| delivery.customerTel | string 또는 null | 해당 배달에 배차된 라이더에게만 주문 고객의 실제 `TB_MBR.MBR_TELNO` 제공. 탈퇴 고객은 null |
| delivery.riderRequest | string 또는 null | `TB_ORD.RIDER_RQST_CN` |
| itemSummary | string | `TB_ORD_DTL.ORD_DTL_SEQ` 첫 행의 `TB_ORD_DTL.ORD_MENU_NM` + 나머지 행이 있으면 ` 외 N건` |
| itemCount | number | `TB_ORD_DTL` 행 수 |
| deliveryTip | number | `TB_ORD.DLVR_TIP_AMT` |
| expectedReadyAt | string | `TB_ORD.ORD_RCPT_DTTM + TB_ORD.COOK_EST_MI`분 |
| dispatchedAt | string | `TB_DLVR.DSPCH_DTTM` |
| pickedUpAt | string | 기록한 `TB_DLVR.PKUP_DTTM` |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | deliveryId가 양의 정수가 아님 |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 또는 해당 배달에 배차된 본인이 아님 |
| 404 | NOT_FOUND | 배달 없음 |
| 409 | NOT_READY | 주문이 아직 COOKING |
| 409 | ORDER_ALREADY_PROCESSED | READY·COOKING 외 상태. 취소·이미 픽업·완료 포함 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_DLVR`, `TB_ORD`, `TB_STORE`, `TB_ORD_DTL` / 바꾸는 테이블: `TB_ORD`, `TB_DLVR`.
- 트랜잭션: 배달 존재·배차 소유자 확인 → `TB_ORD.ORD_STTS='READY'` 조건으로 DELIVERING UPDATE → `TB_DLVR.PKUP_DTTM=현재 일시` 기록 → 응답 조회. 실패하면 전체 롤백.
- 서버 검사: 배달의 `TB_DLVR.RIDER_MBR_ID`가 세션 회원과 일치해야 한다. 조건부 주문 UPDATE가 0행이면 현재 상태가 COOKING일 때 NOT_READY, 그 외 ORDER_ALREADY_PROCESSED. 주문 상태와 픽업 일시의 연관 무결성을 서버가 보장한다.
- 상태 변경 / VIEW·트리거: READY → DELIVERING, 픽업 일시 기록. 라이더는 BUSY 유지. `TRG_ORD_MOD_DTTM`, `TRG_DLVR_MOD_DTTM` 적용. VIEW 사용 없음.

## D-08 배달 완료

- method/path: `POST /api/rider/deliveries/{deliveryId}/complete`
- 권한: RIDER(해당 배달에 배차된 본인)
- 설명: 픽업 후 DELIVERING 주문을 완료하고 라이더를 IDLE로 돌린다. 화면은 배차 대기 목록으로 돌아간다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | deliveryId | number | O | 양의 정수, `TB_DLVR.DLVR_ID` |
| body | 없음 | — | — | 본문 없음 |

### 응답

200

```json
{ "success": true, "data": { "deliveryId": 205, "completedAt": "2026-11-24 19:01:00" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| deliveryId | number | `TB_DLVR.DLVR_ID` |
| completedAt | string | 기록한 `TB_DLVR.DLVR_CMPL_DTTM` |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | deliveryId가 양의 정수가 아님 |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 또는 해당 배달에 배차된 본인이 아님 |
| 404 | NOT_FOUND | 배달 없음 |
| 409 | NOT_PICKED_UP | 주문이 COOKING 또는 READY |
| 409 | ORDER_ALREADY_PROCESSED | DELIVERING·COOKING·READY 외 상태. 취소·이미 완료 포함 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_DLVR`, `TB_ORD`, `TB_RIDER` / 바꾸는 테이블: `TB_ORD`, `TB_DLVR`, `TB_RIDER`.
- 트랜잭션: 배달 존재·배차 소유자 확인 → `TB_ORD.ORD_STTS='DELIVERING'` 조건으로 DONE UPDATE → `TB_DLVR.DLVR_CMPL_DTTM=현재 일시` 기록 → `TB_RIDER.RIDER_STTS='IDLE'` UPDATE. 모두 같은 트랜잭션이며 실패 시 전체 롤백.
- 서버 검사: 배차된 본인만 허용. 조건부 주문 UPDATE가 0행이면 COOKING·READY는 NOT_PICKED_UP, 그 외 ORDER_ALREADY_PROCESSED. 픽업된 배달과 DELIVERING 주문의 연관 무결성을 서버가 보장한다.
- 상태 변경 / VIEW·트리거: DELIVERING → DONE, 완료 일시 기록, BUSY → IDLE은 API가 처리한다(완료 시 IDLE 전환 트리거 없음). `TRG_ORD_MOD_DTTM`, `TRG_DLVR_MOD_DTTM`, `TRG_RIDER_MOD_DTTM` 적용. VIEW 사용 없음.

## D-09 배달 내역

- method/path: `GET /api/rider/deliveries/history`
- 권한: RIDER
- 설명: 내가 완료한 배달만 페이지로 조회한다. 오늘 건수·배달팁 합계는 페이지와 무관한 전체 오늘 완료분이다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | page | number | X | 1 이상 정수. 기본 1 |
| query | size | number | X | 1~100 정수. 기본 20 |

### 응답

200. 내역이 없으면 `items: []`, `totalCount: 0`. 오늘 완료가 없으면 `todayCount: 0`, `todayTipSum: 0`.

```json
{ "success": true, "data": { "items": [{ "deliveryId": 205, "orderId": 1042, "storeName": "상도치킨", "deliveryAddress": "서울 동작구 상도동 123", "deliveryTip": 3000, "pickedUpAt": "2026-11-24 18:44:00", "completedAt": "2026-11-24 19:01:00" }], "page": 1, "size": 20, "totalCount": 37, "todayCount": 5, "todayTipSum": 15000 } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| items | array | 해당 페이지 완료 배달 목록 |
| items[].deliveryId | number | `TB_DLVR.DLVR_ID` |
| items[].orderId | number | `TB_ORD.ORD_ID` |
| items[].storeName | string | `TB_STORE.STORE_NM` |
| items[].deliveryAddress | string | `TB_ORD.DLVR_ADDR` |
| items[].deliveryTip | number | `TB_ORD.DLVR_TIP_AMT` |
| items[].pickedUpAt | string | `TB_DLVR.PKUP_DTTM` |
| items[].completedAt | string | `TB_DLVR.DLVR_CMPL_DTTM` |
| page | number | 적용한 페이지 번호 |
| size | number | 적용한 페이지 크기 |
| totalCount | number | 페이지 제한 전 내 DONE 배달 전체 건수 |
| todayCount | number | 내 DONE 배달 중 한국 시간 오늘 날짜에 `TB_DLVR.DLVR_CMPL_DTTM`이 속하는 전체 건수 |
| todayTipSum | number | todayCount 대상의 `TB_ORD.DLVR_TIP_AMT` 합계. 없으면 0 |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | page·size가 정수가 아니거나 허용 범위 밖 |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | RIDER 역할 아님 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_DLVR`, `TB_ORD`, `TB_STORE` / 바꾸는 테이블: 조회 전 만료 취소의 `TB_ORD`와 트리거 연쇄 대상 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 취소와 트리거 처리는 하나의 쓰기 트랜잭션. items·totalCount·오늘 합계는 같은 읽기 범위에서 조회한다.
- 서버 검사: `TB_DLVR.RIDER_MBR_ID=세션 회원 ID`이고 `TB_ORD.ORD_STTS='DONE'`인 배달만 포함. 취소·진행 중 배달 제외. 오늘 합계에도 같은 소유자·완료 조건을 적용하고 페이지 조건은 적용하지 않는다.
- 상태 변경 / VIEW·트리거: `TB_DLVR.DLVR_CMPL_DTTM` 내림차순, `LIMIT size OFFSET (page-1)*size`. VIEW 사용 없음. 만료 취소는 공통 규칙의 `TRG_ORD_CANCEL` 처리.
