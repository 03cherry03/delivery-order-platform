# 공통 인증·가게 신청 API

## 공통 규칙

- 성공: `{ "success": true, "data": ... }`. 실패: `{ "success": false, "error": { "code": "...", "message": "...", "fields": {} } }` (`fields`는 입력 오류일 때 선택).
- 본문은 JSON. 일시는 한국 시간 `YYYY-MM-DD HH:mm:ss`, 금액은 원 단위 정수다. 비밀번호·비밀번호 해시는 응답하지 않는다.
- 모든 인증 요청은 서명·만료 검증 후 `TB_MBR.MBR_ID`로 회원을 읽고 `TB_MBR.MBR_STTS='ACTIVE'`와 현재 `TB_MBR.MBR_ROLE_CD`를 확인한다. 쿠키에 담긴 역할을 권한 근거로 사용하지 않는다. 리뷰 작성 제한은 로그인 차단이 아니라 해당 API에서 `TB_MBR_RSTR`로 검사한다.

### 세션 쿠키

| 항목 | 규칙 |
|---|---|
| 이름 | `delivery_session` |
| 값 | 회원 식별자 `memberId`, 발급 시각 `issuedAt`, 만료 시각 `expiresAt`를 담은 base64url 페이로드 + HMAC-SHA256 서명. 시각은 Unix 초, 비밀키는 서버 환경변수로만 관리한다. |
| 구현 | Node `crypto`의 HMAC. 서명은 상수 시간 비교로 검증하며, 변조·형식 오류·만료는 401 `UNAUTHORIZED`다. |
| 속성 | `HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`, HTTPS 운영 환경에서 `Secure`. `Domain`을 생략한 호스트 전용 쿠키다. |
| 수명 | 로그인부터 24시간 고정. 요청마다 연장하지 않으며 페이로드 만료와 쿠키 수명을 일치시킨다. |
| 발급·삭제 | A-01 성공 시 새 쿠키 발급. A-02·A-07 성공 시 같은 이름·경로·속성으로 `Max-Age=0`을 설정한다. 가입은 쿠키를 발급하지 않는다. |
| 로그아웃 범위 | 별도 세션 테이블 없는 서명 쿠키이므로 현재 브라우저의 쿠키를 지운다. 이미 복사된 쿠키의 서버측 개별 폐기는 제공하지 않는다. 탈퇴 쿠키는 매 요청 회원 상태 검사로 거부된다. |

## A-01 로그인

- method/path: `POST /api/auth/login`
- 권한: 누구나
- 설명: 활성 회원의 이메일·비밀번호를 확인하고 세션을 발급한다. 탈퇴 이메일로 재가입했다면 새 활성 회원만 인증한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | email | string | O | 유효한 이메일, 최대 100자. `TB_MBR.MBR_EMAIL` |
| body | password | string | O | 가입 시 설정한 비밀번호. `TB_MBR.MBR_PWD`의 해시와 검증 |

### 응답

HTTP 200. `Set-Cookie`로 세션을 발급한다.

```json
{ "success": true, "data": { "memberId": 3, "name": "김사장", "role": "OWNER" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | `TB_MBR.MBR_ID` |
| name | string | `TB_MBR.MBR_NM` |
| role | string | `TB_MBR.MBR_ROLE_CD`: CUSTOMER, OWNER, RIDER, ADMIN |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수값 누락·잘못된 타입·이메일 형식 |
| 401 | LOGIN_FAILED | 활성 이메일 없음, 비밀번호 불일치, 탈퇴 회원만 존재. 계정 존재 여부를 구분하지 않는 같은 메시지 사용 |
| 429 | LOGIN_LOCKED | 10분 내 실패 5회(5번째는 401) 이후 10분간 올바른 비밀번호도 검증하지 않음. `Retry-After` 헤더는 남은 초, 메시지는 남은 분을 안내 |

### DB 처리

- 읽는 테이블: `TB_MBR` / 바꾸는 테이블: `TB_MBR`.
- 트랜잭션: 활성 회원 확인·비밀번호 검증·최종 로그인 시각 갱신. 성공 후 쿠키 발급.
- 서버 검사: 이메일 조회 조건에 `TB_MBR.MBR_STTS='ACTIVE'`를 포함하고 저장 해시로 비밀번호를 검증한다.
- 로그인 실패 횟수는 이메일의 앞뒤 공백을 제거하고 소문자로 변환한 키로 서버 메모리에 기록한다. 비밀번호 불일치 및 미가입·비활성 이메일의 401을 집계하고, 로그인 성공 시 초기화한다.
- 상태 변경 / VIEW·트리거: `TB_MBR.MBR_LOGIN_DTTM`을 현재 한국 시각으로 갱신한다. `TRG_MBR_MOD_DTTM`이 수정 시각을 기록한다. VIEW 사용 없음.

## A-02 로그아웃

- method/path: `POST /api/auth/logout`
- 권한: 로그인한 회원(CUSTOMER, OWNER, RIDER, ADMIN)
- 설명: 현재 브라우저의 세션 쿠키를 만료시킨다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 요청 본문 없음 |

### 응답

HTTP 200. 세션 쿠키 삭제.

```json
{ "success": true, "data": null }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| data | null | 반환 데이터 없음 |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 세션 없음·변조·만료 또는 회원이 비활성 |

### DB 처리

- 읽는 테이블: `TB_MBR`(공통 인증) / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 공통 세션·활성 회원 확인.
- 상태 변경 / VIEW·트리거: DB 변경 없이 쿠키만 삭제. VIEW·트리거 사용 없음.

## A-03 내 정보

- method/path: `GET /api/auth/me`
- 권한: 로그인한 회원(CUSTOMER, OWNER, RIDER, ADMIN)
- 설명: 화면 진입 시 로그인 여부·현재 역할을 확인한다. 응답은 A-01과 동일한 세 필드이며 이메일·전화번호·포인트·라이더 정보는 포함하지 않는다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 요청 본문·쿼리 없음 |

### 응답

HTTP 200.

```json
{ "success": true, "data": { "memberId": 7, "name": "김고객", "role": "CUSTOMER" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | `TB_MBR.MBR_ID` |
| name | string | `TB_MBR.MBR_NM` |
| role | string | `TB_MBR.MBR_ROLE_CD` |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 세션 없음·변조·만료 또는 회원이 비활성 |

### DB 처리

- 읽는 테이블: `TB_MBR` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 쿠키 발급 당시 값이 아닌 현재 활성 회원 정보 반환.
- 상태 변경 / VIEW·트리거: 없음. 조회로 최종 로그인 시각을 갱신하지 않는다.

이름·연락처·비밀번호 수정은 A-08을 사용한다. 라이더 원문의 ‘A-03 내 정보 수정’ 안내도 A-08을 가리킨다.

## A-04 내 가게 목록

- method/path: `GET /api/owner/stores`
- 권한: OWNER
- 설명: 삭제되지 않은 본인 가게를 승인 상태와 무관하게 모두 반환한다. 가게가 없으면 빈 배열이다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 요청 본문·쿼리 없음 |

### 응답

HTTP 200. 페이지 없는 배열.

```json
{ "success": true, "data": [
  { "storeId": 10, "storeName": "연세치킨 신촌점", "approvalStatus": "APPROVED", "operStatus": "OPEN", "rejectReason": null, "waitingOrderCount": 2 },
  { "storeId": 11, "storeName": "연세피자", "approvalStatus": "REJECTED", "operStatus": "PAUSED", "rejectReason": "사업자번호 확인 불가", "waitingOrderCount": 0 }
] }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].storeId | number | `TB_STORE.STORE_ID` |
| [].storeName | string | `TB_STORE.STORE_NM` |
| [].approvalStatus | string | `TB_STORE.STORE_APRV_STTS`: PENDING, APPROVED, REJECTED |
| [].operStatus | string | 저장값 `TB_STORE.STORE_OPER_STTS`가 PAUSED이면 PAUSED. 그 외 현재 한국 요일·시각이 `TB_STORE_HOURS.DAY_OF_WEEK`, `TB_STORE_HOURS.OPEN_TM` 이상·`TB_STORE_HOURS.CLOSE_TM` 미만에 포함되면 OPEN, 아니면 CLOSED |
| [].rejectReason | string 또는 null | 가장 최근 신청(`TB_STORE_APRV.APLY_DTTM` 내림차순, 동률은 `TB_STORE_APRV.STORE_APRV_ID` 내림차순)의 `TB_STORE_APRV.RJCT_RSN_CN` |
| [].waitingOrderCount | number | 해당 가게의 `TB_ORD.ORD_STTS='WAIT'` 주문 수. 만료 자동 취소 후 계산 |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | 현재 역할이 OWNER가 아님 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_APRV`, `TB_STORE_HOURS`, `TB_ORD`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`(만료 자동 취소 연쇄 처리).
- 트랜잭션: 주문 조회 전에 만료 WAIT 주문 자동 취소, 이후 본인 가게별 대기 주문 수 조회.
- 서버 검사: `TB_STORE.OWNR_MBR_ID`가 세션 회원이고 `TB_STORE.DEL_YN='N'`인 행만 반환. 승인 대기·반려 가게도 포함한다.
- 상태 변경 / VIEW·트리거: `TB_ORD.ORD_DTTM + 10분` 경과 WAIT는 `TB_ORD.ORD_STTS='CANCEL'`, 취소일시 현재 시각, `TB_ORD.CNCL_ACTR_CD='SYSTEM'`, `TB_ORD.CNCL_RSN_CD='NO_RESPONSE'`로 UPDATE → `TRG_ORD_CANCEL`이 결제 취소·POINT 결제 환불 및 REFUND 거래·라이더 IDLE 처리를 한다. API는 중복 처리하지 않는다. 수정 시각은 각 수정 시각 트리거가 기록한다. VIEW 사용 없음.

## A-05 가게 추가 등록·재신청

- method/path: 추가 `POST /api/owner/stores`, 재신청 `PUT /api/owner/stores/{storeId}/application`
- 권한: OWNER
- 설명: 추가는 새 가게·입점 신청을 생성한다. 재신청은 본인 반려 가게의 신청 정보를 교체하고 새 승인 이력을 생성한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | storeId | number | 재신청 O | 양의 정수. 재신청할 `TB_STORE.STORE_ID` |
| body | storeName | string | O | 비어 있지 않은 가게명. `TB_STORE.STORE_NM` |
| body | categoryCode | string | O | CHICKEN, PIZZA, KOREAN, CHINESE, JAPANESE, SNACK, CAFE, ETC. `TB_STORE.STORE_CTGR_CD` |
| body | bizNo | string | O | `000-00-00000` 형식. 전체 가게에서 중복 불가(재신청은 자기 행 제외). `TB_STORE.BIZ_NO` |
| body | telNo | string | O | 가게 전화번호. `TB_STORE.STORE_TELNO` |
| body | address | string | O | 비어 있지 않은 주소. `TB_STORE.STORE_ADDR` |
| body | addressDetail | string | X | 상세주소, 생략 시 NULL. `TB_STORE.STORE_DADDR` |
| body | lat | number | O | -90~90, NULL 불가. `TB_STORE.STORE_LAT` |
| body | lng | number | O | -180~180, NULL 불가. `TB_STORE.STORE_LNG` |
| body | minOrderAmount | number | O | 0 이상 정수. `TB_STORE.MIN_ORD_AMT` |
| body | deliveryTip | number | O | 0 이상 정수. `TB_STORE.DLVR_TIP_AMT` |
| body | cookMinutes | number | O | 1 이상 정수(분). `TB_STORE.COOK_EST_MI` |
| body | description | string | X | 가게 소개, 생략 시 NULL. `TB_STORE.STORE_CN` |
| body | hours | array | O | 비어 있지 않은 요일별 영업시간. 전체를 교체하며 미등록 요일은 휴무 |
| body | hours[].dayOfWeek | number | O | 0(일)~6(토) 정수. `TB_STORE_HOURS.DAY_OF_WEEK` |
| body | hours[].open | string | O | `HH:mm`, 00:00~23:59. `TB_STORE_HOURS.OPEN_TM` |
| body | hours[].close | string | O | `HH:mm`, 시작보다 늦고 24:00까지. `TB_STORE_HOURS.CLOSE_TM` |

같은 요일에 여러 구간을 허용하되 겹치면 안 된다. 맞닿는 구간은 허용한다. 자정을 넘으면 두 요일로 나눈다(금 18:00~24:00, 토 00:00~02:00). S-04와 같은 규칙이다.

### 응답

추가 HTTP 201, 재신청 HTTP 200.

```json
{ "success": true, "data": { "storeId": 12, "approvalStatus": "PENDING" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| storeId | number | 생성 또는 갱신한 `TB_STORE.STORE_ID` |
| approvalStatus | string | `TB_STORE.STORE_APRV_STTS`, 항상 PENDING |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수값·타입·사업자번호 형식·코드·좌표·금액·조리시간 오류 |
| 400 | INVALID_HOURS | 영업시간 빈 배열, 시간 형식·요일 오류, 종료가 시작 이하, 같은 요일 구간 중복 |
| 401 | UNAUTHORIZED | 유효한 활성 회원 세션 없음 |
| 403 | FORBIDDEN | OWNER가 아니거나 재신청 가게 소유자가 아님 |
| 404 | NOT_FOUND | 재신청 가게가 없거나 삭제됨 |
| 409 | NOT_REJECTED | 재신청 대상의 현재 승인 상태가 REJECTED가 아님 |
| 409 | DUPLICATE_BIZ_NO | 다른 가게가 이미 사용 중인 사업자번호 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_APRV` / 바꾸는 테이블: `TB_STORE`, `TB_STORE_APRV`, `TB_STORE_HOURS`.
- 트랜잭션: 소유권·현재 상태·사업자번호 중복 확인부터 가게 저장, 영업시간 저장, 새 PENDING 승인 이력 생성까지 전부. 실패하면 전체 롤백.
- 서버 검사: 재신청은 비삭제 본인 가게 + 현재 REJECTED만 허용. 같은 요일 영업시간 겹침을 검사한다. 재신청 시 기존 영업시간을 삭제한 뒤 요청 전체를 저장한다.
- 상태 변경 / VIEW·트리거: 추가는 `TB_STORE.OWNR_MBR_ID`에 세션 회원, `TB_STORE.STORE_OPER_STTS='PAUSED'`, `TB_STORE.STORE_APRV_STTS='PENDING'`로 생성한다. 재신청도 현재 승인 상태를 PENDING으로 바꾸고, `TB_STORE_APRV.STORE_APRV_STTS='PENDING'`인 새 행을 같은 트랜잭션에 저장한다. 새 승인 이력의 처리자·처리일시·반려 사유는 NULL. 승인 상태 동기화는 API가 하며 트리거가 하지 않는다. UPDATE 수정 시각은 `TRG_STORE_MOD_DTTM`이 기록한다. VIEW 사용 없음.

## A-06 회원가입(CUSTOMER·OWNER)

- method/path: `POST /api/auth/signup`
- 권한: 누구나
- 설명: role로 분기한다. CUSTOMER는 회원만, OWNER는 첫 가게·입점 신청까지 함께 생성한다. RIDER는 같은 경로의 [D-01](rider.md#d-01-라이더-회원가입)을 따른다. ADMIN 공개 가입은 금지한다. 가입 후 자동 로그인하지 않는다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | role | string | O | 이 문서의 분기는 CUSTOMER, OWNER. RIDER 요청은 D-01로 분기. `TB_MBR.MBR_ROLE_CD` |
| body | email | string | O | 유효한 이메일, 최대 100자. ACTIVE 회원 사이에서만 중복 불가. `TB_MBR.MBR_EMAIL` |
| body | password | string | O | 8자 이상. Node `crypto.scrypt`로 솔트 포함 해시를 저장하며 평문 저장 금지. `TB_MBR.MBR_PWD` |
| body | name | string | O | 비어 있지 않은 이름, 최대 50자. `TB_MBR.MBR_NM` |
| body | tel | string | O | `010-0000-0000` 형식. `TB_MBR.MBR_TELNO` |
| body | store | object | OWNER O | 첫 가게 정보. 내부 필드·필수 여부·제약은 A-05의 body와 동일. CUSTOMER는 보내지 않음 |

### 응답

HTTP 201. 세션 쿠키를 발급하지 않으며 화면은 로그인 화면으로 이동한다.

```json
{ "success": true, "data": { "memberId": 7, "role": "CUSTOMER" } }
```

OWNER 응답:

```json
{ "success": true, "data": { "memberId": 3, "role": "OWNER", "storeId": 10, "approvalStatus": "PENDING" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | 새 `TB_MBR.MBR_ID` |
| role | string | `TB_MBR.MBR_ROLE_CD` |
| storeId | number | OWNER만 반환. 새 `TB_STORE.STORE_ID` |
| approvalStatus | string | OWNER만 반환. `TB_STORE.STORE_APRV_STTS`, PENDING |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 필수값·형식·타입 오류, ADMIN·알 수 없는 역할, OWNER의 store 누락, CUSTOMER의 store 전달 |
| 400 | INVALID_HOURS | OWNER의 store.hours가 A-05 영업시간 규칙 위반 |
| 409 | DUPLICATE_EMAIL | 같은 이메일의 `TB_MBR.MBR_STTS='ACTIVE'` 회원이 존재 |
| 409 | DUPLICATE_BIZ_NO | OWNER 첫 가게의 사업자번호가 이미 존재 |

### DB 처리

- 읽는 테이블: `TB_MBR`, OWNER는 `TB_STORE` 추가 / 바꾸는 테이블: `TB_MBR`, OWNER는 `TB_STORE`, `TB_STORE_APRV`, `TB_STORE_HOURS` 추가.
- 트랜잭션: 활성 이메일 중복 검사·회원 생성. OWNER는 A-05와 같은 가게·영업시간·PENDING 신청 생성까지 모두 한 트랜잭션. 실패하면 회원 생성도 롤백.
- 서버 검사: 중복 조회는 반드시 `TB_MBR.MBR_STTS='ACTIVE'` 조건을 사용한다. 부분 유일 인덱스 `UK_MBR_EMAIL_ACTIVE`가 동시 중복도 막는다. 탈퇴 회원 행을 되살리지 않고 새 회원 식별자를 발급한다. OWNER는 사업자번호·영업시간도 A-05 규칙으로 검사한다.
- 상태 변경 / VIEW·트리거: `TB_MBR.MBR_STTS='ACTIVE'`, `TB_MBR.PNT_BAL_AMT=0`, 최종 로그인·탈퇴일시 NULL로 생성한다. OWNER는 가게 PAUSED, 가게 현재 승인·새 신청 상태 모두 PENDING으로 같은 트랜잭션에 저장한다. INSERT 기본 시각 사용, VIEW·UPDATE 트리거 사용 없음.

## A-07 회원 탈퇴

- method/path: `DELETE /api/auth/me`
- 권한: 로그인한 CUSTOMER, OWNER, RIDER(ADMIN 제외)
- 설명: 비밀번호 재확인·역할별 진행 업무 검사를 거쳐 개인정보를 비우고 잔여 포인트를 소멸한다. 기존 이메일·회원 식별자와 주문·배달 이력은 보존하며 재가입은 새 회원으로 처리한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | password | string | O | 현재 비밀번호. `TB_MBR.MBR_PWD`의 해시와 검증 |

### 응답

HTTP 200. 세션 쿠키 삭제.

```json
{ "success": true, "data": { "withdrawnAt": "2026-11-18 20:00:00", "expiredPoint": 3000 } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| withdrawnAt | string | `TB_MBR.MBR_WTHDR_DTTM`, 현재 한국 시각 |
| expiredPoint | number | 탈퇴 직전 `TB_MBR.PNT_BAL_AMT`. 0이면 EXPIRE 거래 없이 0 반환 |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 비밀번호 누락·타입 오류 |
| 401 | UNAUTHORIZED | 세션 없음·변조·만료 또는 회원이 비활성 |
| 401 | PASSWORD_MISMATCH | 현재 비밀번호 불일치 |
| 403 | FORBIDDEN | ADMIN의 탈퇴 요청 |
| 409 | HAS_ACTIVE_ORDERS | CUSTOMER의 본인 주문 또는 OWNER의 본인 가게 주문이 WAIT·COOKING·READY·DELIVERING. RIDER는 본인 배달의 `TB_DLVR.DLVR_CMPL_DTTM IS NULL`이고 연결 주문의 `TB_ORD.ORD_STTS`가 CANCEL이 아닌 경우 |
| 409 | STORE_STILL_OPEN | OWNER가 소유한 비삭제 가게 중 저장된 `TB_STORE.STORE_OPER_STTS='OPEN'`이 존재. 영업시간 밖의 계산값 CLOSED여도 저장값 OPEN이면 차단 |

### DB 처리

- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_DLVR`, `TB_PAY` / 바꾸는 테이블: `TB_MBR`, `TB_MBR_ADDR`, `TB_PNT_TXN`, `TB_CART` 및 CASCADE로 `TB_CART_DTL`, `TB_CART_DTL_OPT`, OWNER는 `TB_STORE` 추가. 만료 자동 취소 시 `TB_ORD`, `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER` 추가.
- 트랜잭션: 주문 검사 전 만료 WAIT 자동 취소를 처리한다. 탈퇴 변경은 활성 상태·비밀번호·진행 업무 재확인부터 포인트 소멸 거래, 회원 개인정보 변경, 회원주소 논리 삭제, 장바구니 삭제, OWNER 소유 가게 논리 삭제·일시정지까지 한 트랜잭션이며 실패 시 전체 롤백한다. 성공 커밋 후 쿠키 삭제.
- 서버 검사: CUSTOMER는 `TB_ORD.MBR_ID`가 세션 회원인 진행 주문, OWNER는 `TB_STORE.OWNR_MBR_ID`가 세션 회원인 가게의 진행 주문을 검사한다. OWNER는 비삭제 소유 가게의 저장 영업 상태도 검사한다. RIDER는 `TB_DLVR.RIDER_MBR_ID`가 세션 회원이고 `TB_DLVR.DLVR_CMPL_DTTM IS NULL`이며 연결 주문의 `TB_ORD.ORD_STTS<>'CANCEL'`인 배달이 있으면 차단한다(D-06과 동일). 취소된 배달은 차단하지 않는다. 탈퇴를 위해 배달을 임의 취소·완료하거나 라이더를 IDLE로 바꾸지는 않는다.
- 상태 변경 / VIEW·트리거:
  1. `TB_MBR.MBR_STTS='WITHDRAWN'`, `TB_MBR.MBR_WTHDR_DTTM=현재 시각`, `TB_MBR.MBR_NM='탈퇴회원'`, `TB_MBR.MBR_PWD=NULL`, `TB_MBR.MBR_TELNO=NULL`로 한 UPDATE에 기록한다. `TB_MBR.MBR_EMAIL`은 그대로 유지한다.
  2. 기존 잔액이 양수일 때만 `TB_PNT_TXN`에 회원 식별자, `TB_PNT_TXN.PNT_TXN_TYPE_CD='EXPIRE'`, `TB_PNT_TXN.PNT_TXN_AMT=기존 잔액`, `TB_PNT_TXN.PNT_BAL_AMT=0`, `TB_PNT_TXN.PNT_TXN_STTS='COMPLETED'`, 거래일시 현재 시각, 주문 식별자·충전수단 NULL로 INSERT하고 회원 잔액을 0으로 만든다. 잔액 0이면 거래를 만들지 않는다.
  3. 본인 주소(`TB_MBR_ADDR.MBR_ID`가 세션 회원)의 `TB_MBR_ADDR.DEL_YN='Y'`로 논리 삭제한다. 본인의 `TB_CART` 행을 DELETE한다. `TB_CART_DTL`, `TB_CART_DTL_OPT`는 외래키 CASCADE로 삭제되므로 별도 중복 DELETE하지 않는다.
  4. OWNER는 `TB_STORE.OWNR_MBR_ID`가 세션 회원이고 `TB_STORE.DEL_YN='N'`인 모든 소유 가게를 `TB_STORE.DEL_YN='Y'`, `TB_STORE.STORE_OPER_STTS='PAUSED'`로 함께 UPDATE한다. 기존 승인 이력·주문 이력은 보존한다.
  5. 회원·주소·가게 수정 시각은 각각 `TRG_MBR_MOD_DTTM`, `TRG_MBR_ADDR_MOD_DTTM`, `TRG_STORE_MOD_DTTM`이 기록한다. 만료 WAIT 취소는 A-04와 동일하게 주문 CANCEL UPDATE → `TRG_ORD_CANCEL` 연쇄 처리이며 API는 결제 취소·환불·라이더 IDLE을 중복 수행하지 않는다. VIEW 사용 없음.



## A-08 내 정보 수정

- method/path: `PATCH /api/auth/me`
- 권한: 로그인한 ACTIVE 회원(CUSTOMER, OWNER, RIDER, ADMIN)
- 설명: 보낸 필드만 변경한다. 이메일·역할은 수정할 수 없다. 비밀번호 변경에만 현재 비밀번호를 재확인한다.

### 요청

| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | name | string | X | 비어 있지 않은 이름, 최대 50자. `TB_MBR.MBR_NM` |
| body | tel | string | X | `010-0000-0000` 형식. `TB_MBR.MBR_TELNO` |
| body | newPassword | string | X | 8자 이상. 솔트 포함 scrypt 해시로 `TB_MBR.MBR_PWD`에 저장 |
| body | currentPassword | string | 조건부 O | newPassword가 있으면 필수. 기존 `TB_MBR.MBR_PWD` 해시와 검증 |

name, tel, newPassword 중 적어도 하나를 보낸다. 생략한 필드는 유지하며 NULL은 허용하지 않는다. 이메일·역할 변경 필드는 허용하지 않는다.

### 응답

HTTP 200. A-03과 같은 형태로 변경 후 정보를 반환한다.

```json
{ "success": true, "data": { "memberId": 7, "name": "김새이름", "role": "CUSTOMER" } }
```

| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| memberId | number | `TB_MBR.MBR_ID` |
| name | string | 변경 후 `TB_MBR.MBR_NM` |
| role | string | 변경하지 않은 `TB_MBR.MBR_ROLE_CD` |

### 오류

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | 변경 필드 없음, 타입·이름 길이·전화번호 형식·새 비밀번호 길이 오류, newPassword가 있으나 currentPassword 누락, 이메일·역할 변경 시도 |
| 401 | UNAUTHORIZED | 세션 없음·변조·만료 또는 회원이 비활성 |
| 401 | PASSWORD_MISMATCH | newPassword 변경 시 currentPassword가 기존 비밀번호와 불일치 |

### DB 처리

- 읽는 테이블: `TB_MBR` / 바꾸는 테이블: `TB_MBR`.
- 트랜잭션: 현재 활성 회원·입력값 확인, 필요한 경우 현재 비밀번호 검증, 보낸 필드 UPDATE, 변경 후 정보 조회까지 하나의 트랜잭션. 오류 시 전체 롤백.
- 서버 검사: 세션 회원 본인만 수정한다. newPassword가 없으면 현재 비밀번호 검증 없이 이름·전화번호만 변경할 수 있다. 이메일·역할은 UPDATE 대상에서 제외한다.
- 상태 변경 / VIEW·트리거: 이름·전화번호와 새 비밀번호의 scrypt 해시 중 전달된 값만 저장한다. `TB_MBR.MBR_LOGIN_DTTM`은 변경하지 않는다. 수정 시각은 `TRG_MBR_MOD_DTTM`이 기록하며 API가 직접 넣지 않는다. VIEW 사용 없음.
