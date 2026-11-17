# 관리자 API

X-00은 관리자 메인 화면과 메뉴 배지에 사용하는 **관리자 요약** API다. 모든 경로는 화면의 `front_admin_api.js`와 일치한다.

- 모든 요청은 HMAC 서명 세션 쿠키가 필요하다. 서버는 매번 `TB_MBR.MBR_STTS='ACTIVE'`, `TB_MBR.MBR_ROLE_CD='ADMIN'`을 확인한다.
- 요청 본문은 JSON. 일시는 한국 시간 `YYYY-MM-DD HH:mm:ss`, 금액은 원 단위 정수, 거리는 m 정수다. ID는 양의 정수다.
- 성공은 `{ "success": true, "data": ... }`, 실패는 `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "입력값을 확인해주세요.", "fields": {} } }`다. `fields`는 선택이다.
- 이 영역의 원본 목록은 페이지 없는 배열이다. X-11·X-14는 최대 50건이다.
- 활성 리뷰 작성 제한은 `TB_MBR_RSTR.RSTR_TYPE_CD='REVIEW_WRITE'`이고 `TB_MBR_RSTR.RSTR_END_DTTM IS NULL` 또는 현재보다 미래인 행이다. 새 제한은 시작일시가 현재이므로 이 조건으로 활성 여부를 판단한다. 주문 등 다른 기능은 제한하지 않는다.
- UPDATE 시 수정일시는 해당 수정일시 트리거가 기록한다. API가 `MOD_DTTM`을 직접 설정하지 않는다.

## X-00 관리자 요약
- method/path: `GET /api/admin/summary`
- 권한: ADMIN
- 설명: 처리 대기 신청·신고 수와 활성 리뷰 작성 제한 수를 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| 없음 | — | — | — | 본문·쿼리 없음 |

### 응답
```json
{"success":true,"data":{"pendingApplications":3,"pendingReports":5,"activeRestrictions":2}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| pendingApplications | integer | `TB_STORE_APRV.STORE_APRV_STTS='PENDING'` 건수 |
| pendingReports | integer | `TB_RVW_RPT.RVW_RPT_STTS='PENDING'` 건수 |
| activeRestrictions | integer | 공통 활성 조건에 해당하는 `TB_MBR_RSTR` 행 수 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE_APRV`, `TB_RVW_RPT`, `TB_MBR_RSTR` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 공통 인증·역할, 제한 종료일시 비교.
- 상태 변경 / VIEW·트리거: 없음.

## X-01 입점 신청 목록
- method/path: `GET /api/admin/store-applications`
- 권한: ADMIN
- 설명: PENDING은 신청 오래된 순, APPROVED·REJECTED는 처리 최신순으로 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | status | string | 아니오 | PENDING(기본), APPROVED, REJECTED |

### 응답
```json
{"success":true,"data":[{"applicationId":41,"storeId":12,"storeName":"연세분식","ownerName":"이사장","bizNo":"234-56-78901","categoryCode":"SNACK","appliedAt":"2026-11-17 09:12:00","isReapply":false}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].applicationId, [].storeId | integer | `TB_STORE_APRV.STORE_APRV_ID`, `TB_STORE.STORE_ID` |
| [].storeName, [].bizNo, [].categoryCode | string | `TB_STORE.STORE_NM`, `TB_STORE.BIZ_NO`, `TB_STORE.STORE_CTGR_CD` |
| [].ownerName | string | `TB_STORE.OWNR_MBR_ID`로 연결한 `TB_MBR.MBR_NM` |
| [].appliedAt | string | `TB_STORE_APRV.APLY_DTTM` |
| [].isReapply | boolean | 같은 가게에 해당 신청보다 이전 REJECTED 신청이 있는지 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | status가 허용값 아님 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_APRV` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 공통 인증·역할, 신청→가게→사장 조인, 이전 반려 이력 존재 여부.
- 상태 변경 / VIEW·트리거: 없음.

## X-02 입점 신청 상세
- method/path: `GET /api/admin/store-applications/{applicationId}`
- 권한: ADMIN
- 설명: 가게 정보(S-01에서 매출·평점 제외), 사장 연락처, 이전 신청 이력을 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | applicationId | integer | 예 | 입점 신청 ID |

### 응답
```json
{"success":true,"data":{"applicationId":41,"storeId":12,"storeName":"연세분식","categoryCode":"SNACK","bizNo":"234-56-78901","telNo":"02-123-4567","address":"서울 동작구 상도로 369","addressDetail":"1층","lat":37.4963,"lng":126.9575,"hours":[{"dayOfWeek":1,"open":"11:00","close":"23:00"}],"closedDays":[0,2,3,4,5,6],"minOrderAmount":10000,"deliveryTip":3000,"cookMinutes":20,"description":null,"approvalStatus":"PENDING","operStatus":"PAUSED","isOpenNow":false,"onSaleMenuCount":0,"ownerName":"이사장","ownerEmail":"owner@example.com","ownerTel":"010-1234-5678","history":[]}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| applicationId | integer | `TB_STORE_APRV.STORE_APRV_ID` |
| storeId, storeName, categoryCode, bizNo | integer / string | `TB_STORE.STORE_ID`, `TB_STORE.STORE_NM`, `TB_STORE.STORE_CTGR_CD`, `TB_STORE.BIZ_NO` |
| telNo, address, addressDetail | string / null | `TB_STORE.STORE_TELNO`, `TB_STORE.STORE_ADDR`, `TB_STORE.STORE_DADDR`; 상세주소만 null 가능 |
| lat, lng | number | `TB_STORE.STORE_LAT`, `TB_STORE.STORE_LNG` |
| hours | array | `TB_STORE_HOURS`를 요일·시작시각순 조회; 시간대 없는 요일은 휴무 |
| hours[].dayOfWeek, hours[].open, hours[].close | integer / string | `TB_STORE_HOURS.DAY_OF_WEEK`(0 일~6 토), `TB_STORE_HOURS.OPEN_TM`, `TB_STORE_HOURS.CLOSE_TM`(HH:mm, 종료 24:00 가능) |
| closedDays | integer[] | 영업시간 행이 없는 요일 |
| minOrderAmount, deliveryTip, cookMinutes | integer | `TB_STORE.MIN_ORD_AMT`, `TB_STORE.DLVR_TIP_AMT`, `TB_STORE.COOK_EST_MI` |
| description | string / null | `TB_STORE.STORE_CN` |
| approvalStatus | string | `TB_STORE.STORE_APRV_STTS` 현재 승인 상태 |
| operStatus, isOpenNow | string / boolean | 저장 영업상태가 PAUSED면 PAUSED, 그 밖에 현재 시간대 밖이면 CLOSED, 나머지는 OPEN; isOpenNow는 계산 결과 OPEN 여부 |
| onSaleMenuCount | integer | `TB_MENU.STORE_ID`가 일치하고 `TB_MENU.DEL_YN='N'`, `TB_MENU.MENU_SALE_STTS='ON_SALE'`인 메뉴 수 |
| ownerName, ownerEmail, ownerTel | string / null | 사장의 `TB_MBR.MBR_NM`, `TB_MBR.MBR_EMAIL`, `TB_MBR.MBR_TELNO`; 탈퇴한 사장 전화번호는 null |
| history | array | 같은 가게의 해당 신청 이전 신청 이력 |
| history[].appliedAt, history[].status, history[].processedAt, history[].rejectReason | string / null | `TB_STORE_APRV.APLY_DTTM`, `TB_STORE_APRV.STORE_APRV_STTS`, `TB_STORE_APRV.PRCS_DTTM`, `TB_STORE_APRV.RJCT_RSN_CN`; 미처리 시 처리일시 null, 반려가 아니면 사유 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | applicationId 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 신청 없음 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_STORE_APRV`, `TB_STORE_HOURS`, `TB_MENU` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 신청→가게→사장 연결, 영업시간 기준 현재 영업상태 계산, 가게별 이전 신청 이력 조회.
- 상태 변경 / VIEW·트리거: 없음. 평점 VIEW는 사용하지 않는다.

## X-03 입점 승인
- method/path: `POST /api/admin/store-applications/{applicationId}/approve`
- 권한: ADMIN
- 설명: 처리 대기 신청을 승인하며 가게 영업상태 PAUSED는 유지한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | applicationId | integer | 예 | 입점 신청 ID; 본문 없음 |

### 응답
```json
{"success":true,"data":{"applicationId":41,"status":"APPROVED","processedAt":"2026-11-17 10:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| applicationId, status, processedAt | integer / string | `TB_STORE_APRV.STORE_APRV_ID`, `TB_STORE_APRV.STORE_APRV_STTS`, `TB_STORE_APRV.PRCS_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | applicationId 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 신청 없음 |
| 409 | ALREADY_PROCESSED | 신청이 PENDING 아님 또는 조건부 UPDATE 결과 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE_APRV`, `TB_STORE` / 바꾸는 테이블: `TB_STORE_APRV`, `TB_STORE`.
- 트랜잭션: PENDING 검사 → 신청 조건부 UPDATE → 연결 가게 현재 승인 상태 UPDATE를 하나로 처리한다.
- 서버 검사: 신청 존재·PENDING 확인, 연결 가게 확인; `WHERE STORE_APRV_STTS='PENDING'` 결과 행 수로 동시 처리 충돌을 판정한다.
- 상태 변경 / VIEW·트리거: 신청 상태 APPROVED, `TB_STORE_APRV.PRCSR_MBR_ID`=로그인 관리자, `TB_STORE_APRV.PRCS_DTTM`=현재, `TB_STORE_APRV.RJCT_RSN_CN`=null; `TB_STORE.STORE_APRV_STTS='APPROVED'`. 영업상태는 변경하지 않는다. `TRG_STORE_APRV_MOD_DTTM`, `TRG_STORE_MOD_DTTM`이 수정일시를 기록한다. 승인 동기화는 트리거가 아닌 API 책임이다.

## X-04 입점 반려
- method/path: `POST /api/admin/store-applications/{applicationId}/reject`
- 권한: ADMIN
- 설명: 처리 대기 신청을 필수 반려 사유와 함께 반려한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | applicationId | integer | 예 | 입점 신청 ID |
| body | rejectReason | string | 예 | 공백만 불가, 최대 300자; `TB_STORE_APRV.RJCT_RSN_CN` |

### 응답
```json
{"success":true,"data":{"applicationId":41,"status":"REJECTED","processedAt":"2026-11-17 10:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| applicationId, status, processedAt | integer / string | `TB_STORE_APRV.STORE_APRV_ID`, `TB_STORE_APRV.STORE_APRV_STTS`, `TB_STORE_APRV.PRCS_DTTM` |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID 오류, 사유 누락·공백·300자 초과 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 신청 없음 |
| 409 | ALREADY_PROCESSED | 신청이 PENDING 아님 또는 조건부 UPDATE 결과 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE_APRV`, `TB_STORE` / 바꾸는 테이블: `TB_STORE_APRV`, `TB_STORE`.
- 트랜잭션: PENDING 검사 → 신청 조건부 UPDATE → 연결 가게 현재 승인 상태 UPDATE를 하나로 처리한다.
- 서버 검사: 반려 사유, 신청 존재·PENDING, 연결 가게; `WHERE STORE_APRV_STTS='PENDING'` 결과 행 수로 동시 처리 충돌 판정.
- 상태 변경 / VIEW·트리거: 신청 상태 REJECTED, `TB_STORE_APRV.PRCSR_MBR_ID`=로그인 관리자, `TB_STORE_APRV.PRCS_DTTM`=현재, `TB_STORE_APRV.RJCT_RSN_CN`=rejectReason; `TB_STORE.STORE_APRV_STTS='REJECTED'`. `TRG_STORE_APRV_MOD_DTTM`, `TRG_STORE_MOD_DTTM`이 수정일시를 기록한다. 승인 상태 동기화는 API가 수행한다.

## X-05 리뷰 신고 목록
- method/path: `GET /api/admin/review-reports`
- 권한: ADMIN
- 설명: 신고 상태별 목록을 조회한다. PENDING은 신고 오래된 순이다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | status | string | 아니오 | PENDING(기본), ACCEPTED, REJECTED |

### 응답
```json
{"success":true,"data":[{"reportId":80,"reviewId":702,"storeName":"연세치킨 신촌점","reason":"FALSE","reportedAt":"2026-11-17 22:00:00","rating":1,"reviewPreview":"음식이 아예 안 왔어요..."}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].reportId, [].reviewId | integer | `TB_RVW_RPT.RVW_RPT_ID`, `TB_RVW.RVW_ID` |
| [].storeName | string | 리뷰→주문→가게의 `TB_STORE.STORE_NM` |
| [].reason, [].reportedAt | string | `TB_RVW_RPT.RVW_RPT_RSN_CD`, `TB_RVW_RPT.REG_DTTM` |
| [].rating | integer | `TB_RVW.RVW_RTNG` |
| [].reviewPreview | string / null | `TB_RVW.RVW_CN`의 미리보기; 내용 없으면 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | status가 허용값 아님 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_RVW`, `TB_RVW_RPT` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 공통 인증·역할, 신고→리뷰→주문→가게 조인. 신고 근거인 숨김 리뷰도 조회한다.
- 상태 변경 / VIEW·트리거: 없음. 주문은 가게 연결에만 사용하며 주문 상태를 조회하지 않는다.

## X-06 리뷰 신고 상세
- method/path: `GET /api/admin/review-reports/{reportId}`
- 권한: ADMIN
- 설명: 신고 내용, 리뷰, 실제 배달완료 여부, 작성자의 숨김 이력과 현재 제한을 확인한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | reportId | integer | 예 | 신고 ID |

### 응답
```json
{"success":true,"data":{"reportId":80,"reason":"FALSE","content":"배달완료 사진 있음","reportedAt":"2026-11-17 22:00:00","status":"PENDING","review":{"reviewId":702,"rating":1,"content":"음식이 아예 안 왔어요","createdAt":"2026-11-17 21:30:00","hidden":false},"order":{"orderId":2991,"status":"DONE","deliveredAt":"2026-11-17 19:40:00","menus":"양념치킨"},"writer":{"memberId":7,"name":"박고객","hiddenReviewCount":2,"restricted":false}}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| reportId, reason, content, reportedAt, status | integer / string | `TB_RVW_RPT.RVW_RPT_ID`, `TB_RVW_RPT.RVW_RPT_RSN_CD`, `TB_RVW_RPT.RVW_RPT_CN`, `TB_RVW_RPT.REG_DTTM`, `TB_RVW_RPT.RVW_RPT_STTS` |
| review.reviewId, review.rating, review.content | integer / string / null | `TB_RVW.RVW_ID`, `TB_RVW.RVW_RTNG`, `TB_RVW.RVW_CN`(내용 null 가능) |
| review.createdAt, review.hidden | string / boolean | `TB_RVW.REG_DTTM`, `TB_RVW.RVW_HDN_YN='Y'` 여부 |
| order.orderId, order.status | integer / string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_STTS` |
| order.deliveredAt | string / null | `TB_DLVR.DLVR_CMPL_DTTM`; 배달 행·완료일시 없으면 null |
| order.menus | string | `TB_ORD_DTL.ORD_MENU_NM`을 `TB_ORD_DTL.ORD_DTL_SEQ`순 결합 |
| writer.memberId, writer.name | integer / string | 주문 작성자의 `TB_MBR.MBR_ID`, `TB_MBR.MBR_NM` |
| writer.hiddenReviewCount | integer | 작성자의 주문에 연결되고 `TB_RVW.RVW_HDN_YN='Y'`인 리뷰 수 |
| writer.restricted | boolean | 공통 활성 조건의 `TB_MBR_RSTR` 존재 여부 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | reportId 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 신고 없음 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_ORD_DTL`, `TB_DLVR`, `TB_RVW`, `TB_RVW_RPT`, `TB_MBR_RSTR` / 바꾸는 테이블: 만료 WAIT가 있으면 `TB_ORD`, 트리거로 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 주문 상태 조회 전에 만료 WAIT 자동 취소를 트리거 연쇄 변경과 함께 처리하고 상세를 조회한다.
- 서버 검사: 신고→리뷰→주문→작성자 연결, 제한 종료일시 비교, 작성자별 숨김 리뷰 집계. 배달은 LEFT JOIN한다.
- 상태 변경 / VIEW·트리거: 조회 전 `TB_ORD.ORD_DTTM`+10분이 지난 WAIT를 SYSTEM·NO_RESPONSE로 CANCEL 처리한다. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 상세 조회 자체는 상태를 바꾸지 않는다.

## X-07 리뷰 신고 처리
- method/path: `POST /api/admin/review-reports/{reportId}/process`
- 권한: ADMIN
- 설명: 신고를 수용하여 리뷰를 숨기거나 기각하며, 수용 시 작성자를 함께 제한할 수 있다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | reportId | integer | 예 | 신고 ID |
| body | decision | string | 예 | ACCEPTED(숨김), REJECTED(기각) |
| body | note | string | 예 | 공백만 불가; 처리 사유 `TB_RVW_RPT.PRCS_CN`; 제한 생성 시 제한 사유로도 저장 |
| body | restrictWriter | boolean | 아니오 | 기본 false; true는 ACCEPTED에서만 허용 |

### 응답
```json
{"success":true,"data":{"reportId":80,"status":"ACCEPTED","processedAt":"2026-11-17 23:00:00","reviewHidden":true,"writerRestricted":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| reportId, status, processedAt | integer / string | `TB_RVW_RPT.RVW_RPT_ID`, `TB_RVW_RPT.RVW_RPT_STTS`, `TB_RVW_RPT.PRCS_DTTM` |
| reviewHidden | boolean | 처리 후 `TB_RVW.RVW_HDN_YN='Y'` 여부 |
| writerRestricted | boolean | 처리 후 작성자의 활성 `TB_MBR_RSTR` 존재 여부 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·decision·note·restrictWriter 오류 또는 REJECTED인데 restrictWriter=true |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 신고 없음 |
| 409 | ALREADY_PROCESSED | 신고가 PENDING 아님 또는 조건부 UPDATE 결과 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_RVW`, `TB_RVW_RPT`, `TB_MBR_RSTR` / 바꾸는 테이블: `TB_RVW_RPT`, ACCEPTED면 `TB_RVW`, 필요 시 `TB_MBR_RSTR`.
- 트랜잭션: 신고 PENDING 검사·조건부 처리 → 리뷰 숨김 → 선택적 작성자 제한 생성을 한 트랜잭션으로 묶는다.
- 서버 검사: 신고→리뷰→주문의 `TB_ORD.MBR_ID`로 작성자 확인; 활성 제한 중복 검사도 같은 트랜잭션에서 수행한다. 이미 제한 중이면 새 행을 만들지 않고 writerRestricted=true(오류 아님). 주문은 작성자 연결용이다.
- 상태 변경 / VIEW·트리거: `TB_RVW_RPT.RVW_RPT_STTS`=decision, `TB_RVW_RPT.PRCSR_MBR_ID`=로그인 관리자, `TB_RVW_RPT.PRCS_DTTM`=현재, `TB_RVW_RPT.PRCS_CN`=note. ACCEPTED면 `TB_RVW.RVW_HDN_YN='Y'`, REJECTED는 기존 숨김 여부를 바꾸지 않는다. 새 제한은 `TB_MBR_RSTR.MBR_ID`=작성자, `TB_MBR_RSTR.RVW_RPT_ID`=reportId, `TB_MBR_RSTR.RSTR_TYPE_CD='REVIEW_WRITE'`, 시작=현재, 종료=null, 사유=note, 처리자=관리자다. `TRG_RVW_MOD_DTTM`이 리뷰 수정일시를 기록하며 숨김 리뷰는 `V_STORE_RATING` 집계에서 제외된다.

## X-08 리뷰 작성 제한 목록
- method/path: `GET /api/admin/restrictions`
- 권한: ADMIN
- 설명: 현재 제한 중인 회원 또는 제한 이력을 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | active | boolean | 아니오 | 기본 true: 공통 활성 조건만 조회; false면 전체 이력 |


### 응답
```json
{"success":true,"data":[{"restrictionId":12,"memberId":7,"memberName":"박고객","email":"park@example.com","reason":"허위 리뷰 반복","startedAt":"2026-11-17 23:00:00","endedAt":null,"reportId":80}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].restrictionId, [].memberId | integer | `TB_MBR_RSTR.MBR_RSTR_ID`, `TB_MBR_RSTR.MBR_ID` |
| [].memberName, [].email | string | 제한 대상의 `TB_MBR.MBR_NM`, `TB_MBR.MBR_EMAIL` |
| [].reason, [].startedAt | string | `TB_MBR_RSTR.RSTR_RSN_CN`, `TB_MBR_RSTR.RSTR_STRT_DTTM` |
| [].endedAt | string / null | `TB_MBR_RSTR.RSTR_END_DTTM`; null은 해제 전까지 무기한 |
| [].reportId | integer / null | `TB_MBR_RSTR.RVW_RPT_ID`; 근거 신고가 없으면 null |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | active가 true·false 아님 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_RSTR` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: 대상 회원 조인; active=true면 종료일시가 NULL이거나 현재보다 미래인 REVIEW_WRITE 행만 선택한다.
- 상태 변경 / VIEW·트리거: 없음.

## X-09 리뷰 작성 제한
- method/path: `POST /api/admin/restrictions`
- 권한: ADMIN
- 설명: 고객에게 리뷰 작성 제한을 추가한다. 성공 HTTP 201.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| body | memberId | integer | 예 | 제한할 CUSTOMER 회원 |
| body | reason | string | 예 | 공백만 불가; `TB_MBR_RSTR.RSTR_RSN_CN` |
| body | reportId | integer | 아니오 | 근거 신고 ID; 생략 시 null |

### 응답
```json
{"success":true,"data":{"restrictionId":12,"memberId":7,"startedAt":"2026-11-17 23:00:00","endedAt":null}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| restrictionId, memberId | integer | `TB_MBR_RSTR.MBR_RSTR_ID`, `TB_MBR_RSTR.MBR_ID` |
| startedAt, endedAt | string / null | `TB_MBR_RSTR.RSTR_STRT_DTTM`, `TB_MBR_RSTR.RSTR_END_DTTM`(생성 시 null) |


### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·reason 오류, 근거 신고의 리뷰 작성자와 memberId 불일치 |
| 400 | NOT_CUSTOMER | 대상 역할이 CUSTOMER 아님 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 회원 또는 지정한 신고 없음 |
| 409 | ALREADY_RESTRICTED | 같은 회원에게 활성 REVIEW_WRITE 제한 존재 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_RSTR`, reportId가 있으면 `TB_RVW_RPT`, `TB_RVW`, `TB_ORD` / 바꾸는 테이블: `TB_MBR_RSTR`.
- 트랜잭션: 대상 고객 확인·활성 제한 중복 검사·선택적 근거 연결 검사·제한 INSERT를 하나로 처리한다.
- 서버 검사: 대상 역할 CUSTOMER, 공통 활성 조건의 중복을 서버에서 검사한다(DB 인덱스만으로 막지 않음). 근거가 있으면 신고→리뷰→주문 작성자와 대상 회원이 같은지 확인한다.
- 상태 변경 / VIEW·트리거: `TB_MBR_RSTR.RSTR_TYPE_CD='REVIEW_WRITE'`, 시작일시=현재, 종료일시=null, 사유=reason, `TB_MBR_RSTR.PRCSR_MBR_ID`=로그인 관리자, `TB_MBR_RSTR.RVW_RPT_ID`=reportId 또는 null. VIEW·연쇄 트리거 없음.

## X-10 리뷰 작성 제한 해제
- method/path: `POST /api/admin/restrictions/{restrictionId}/release`
- 권한: ADMIN
- 설명: 활성 제한의 종료일시를 현재로 기록하여 해제한다. 회원 행이나 제한 이력을 삭제하지 않는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | restrictionId | integer | 예 | 제한 ID; 본문 없음 |

### 응답
```json
{"success":true,"data":{"restrictionId":12,"endedAt":"2026-11-18 10:00:00"}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| restrictionId, endedAt | integer / string | `TB_MBR_RSTR.MBR_RSTR_ID`, `TB_MBR_RSTR.RSTR_END_DTTM` |


### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | restrictionId 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 제한 없음 |
| 409 | ALREADY_RELEASED | 종료일시가 현재 이하이거나 조건부 UPDATE 결과 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_MBR_RSTR` / 바꾸는 테이블: `TB_MBR_RSTR`.
- 트랜잭션: 존재·활성 검사와 조건부 해제 UPDATE를 하나로 처리한다.
- 서버 검사: 제한 존재 확인 후 종료일시가 NULL 또는 미래인 행만 UPDATE, 변경 행 수로 중복 해제 판정.
- 상태 변경 / VIEW·트리거: `TB_MBR_RSTR.RSTR_END_DTTM`=현재. 최초 제한 처리자는 유지한다. 이 테이블에는 수정일시 컬럼·트리거가 없다.

## X-11 주문 검색 (고객센터)
- method/path: `GET /api/admin/orders`
- 권한: ADMIN
- 설명: 주문번호·고객 이메일·전화번호로 최신순 최대 50건을 찾는다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | keyword | string | 예 | 공백만 불가; @ 포함이면 이메일, 하이픈 포함 또는 010 시작이면 전화번호, 나머지 숫자는 주문번호 |

### 응답
```json
{"success":true,"data":[{"orderId":3021,"orderedAt":"2026-11-18 18:02:11","status":"COOKING","customerName":"김고객","customerTel":"010-1234-5678","storeName":"연세치킨 신촌점","payAmount":24000,"canCancel":true}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].orderId, [].orderedAt, [].status | integer / string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_DTTM`, `TB_ORD.ORD_STTS` |
| [].customerName, [].customerTel | string / null | 주문자의 `TB_MBR.MBR_NM`, `TB_MBR.MBR_TELNO`; 탈퇴 시 전화번호 null |
| [].storeName, [].payAmount | string / integer | `TB_STORE.STORE_NM`, `TB_PAY.PAY_AMT` |
| [].canCancel | boolean | 주문 상태가 WAIT·COOKING·READY·DELIVERING 중 하나인지 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | keyword 누락·공백 또는 세 검색 형식에 해당하지 않음 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_STORE`, `TB_ORD`, `TB_PAY`, 자동 취소 시 `TB_DLVR` / 바꾸는 테이블: 만료 WAIT가 있으면 `TB_ORD`, 트리거로 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 WAIT 자동 취소와 연쇄 변경을 한 트랜잭션으로 처리한 뒤 검색한다.
- 서버 검사: 형식별 검색 대상 결정, 주문→고객·가게·주문당 결제 1건 조인, 최대 50건 제한. 검색 결과가 없으면 빈 배열.
- 상태 변경 / VIEW·트리거: `TB_ORD.ORD_DTTM`+10분이 지난 WAIT를 조건부로 CANCEL, `TB_ORD.CNCL_ACTR_CD='SYSTEM'`, `TB_ORD.CNCL_RSN_CD='NO_RESPONSE'`, 취소일시=현재로 기록한다. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. API는 환불을 중복 실행하지 않는다.

## X-12 주문 상세 (고객센터)
- method/path: `GET /api/admin/orders/{orderId}`
- 권한: ADMIN
- 설명: O-02 주문서 전체와 고객·가게 연락처, 진행 시각, 관리자 취소 정보를 조회한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | orderId | integer | 예 | 주문 ID |

### 응답
```json
{"success":true,"data":{"orderId":3021,"orderedAt":"2026-11-18 18:02:11","status":"COOKING","items":[{"menuName":"후라이드치킨","quantity":1,"unitPrice":18000,"options":[{"groupName":"부위 선택","optionName":"순살","price":2000}],"lineTotal":20000}],"storeRequest":"맵게 해주세요","riderRequest":"문 앞에 두고 벨","cutlery":false,"deliveryAddress":"서울 동작구 상도로 369","deliveryAddressDetail":"101호","distance":1200,"orderTotal":20000,"deliveryTip":3000,"payAmount":23000,"payMethod":"CARD","acceptedAt":"2026-11-18 18:05:00","cookMinutes":20,"canceledAt":null,"cancelActor":null,"cancelReason":null,"cancelReasonDetail":null,"rider":null,"customer":{"memberId":7,"name":"김고객","email":"kim@example.com","tel":"010-1234-5678"},"store":{"storeId":10,"storeName":"연세치킨 신촌점","telNo":"02-123-4567"},"timeline":{"orderedAt":"2026-11-18 18:02:11","acceptedAt":"2026-11-18 18:05:00","dispatchedAt":null,"pickedUpAt":null,"deliveredAt":null,"canceledAt":null},"canCancel":true,"cancelProcessor":null,"counselNote":null}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, orderedAt, status | integer / string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_DTTM`, `TB_ORD.ORD_STTS` |
| items | array | `TB_ORD_DTL.ORD_DTL_SEQ`순 주문 당시 스냅샷 |
| items[].menuName, items[].quantity, items[].unitPrice | string / integer | `TB_ORD_DTL.ORD_MENU_NM`, `TB_ORD_DTL.ORD_QTY`, `TB_ORD_DTL.ORD_UPRC` |
| items[].options[].groupName, items[].options[].optionName, items[].options[].price | string / integer | `TB_ORD_DTL_OPT.ORD_OPT_GRP_NM`, `TB_ORD_DTL_OPT.ORD_OPT_NM`, `TB_ORD_DTL_OPT.ORD_OPT_AMT`; 옵션 없으면 빈 배열 |
| items[].lineTotal | integer | (단가 + 옵션금액 합) × 수량 |
| storeRequest, riderRequest | string / null | `TB_ORD.STORE_RQST_CN`, `TB_ORD.RIDER_RQST_CN` |
| cutlery | boolean | `TB_ORD.CUTLERY_YN='Y'` 여부 |
| deliveryAddress, deliveryAddressDetail | string / null | `TB_ORD.DLVR_ADDR`, `TB_ORD.DLVR_DADDR`; 상세주소만 null 가능 |
| distance | integer | 가게 `TB_STORE.STORE_LAT`·`TB_STORE.STORE_LNG`와 주문 `TB_ORD.DLVR_LAT`·`TB_ORD.DLVR_LNG` 사이 직선거리(m) |
| orderTotal, deliveryTip | integer | `TB_ORD.ORD_TOT_AMT`, `TB_ORD.DLVR_TIP_AMT` |
| payAmount, payMethod | integer / string | `TB_PAY.PAY_AMT`, `TB_PAY.PAY_MTHD_CD` |
| acceptedAt, cookMinutes | string / integer / null | `TB_ORD.ORD_RCPT_DTTM`, `TB_ORD.COOK_EST_MI`; 미접수 시 null |
| canceledAt, cancelActor, cancelReason, cancelReasonDetail | string / null | `TB_ORD.ORD_CNCL_DTTM`, `TB_ORD.CNCL_ACTR_CD`, `TB_ORD.CNCL_RSN_CD`, `TB_ORD.ORD_CNCL_RSN_CN` |
| rider | object / null | 미배차면 null |
| rider.name, rider.vehicle | string | 라이더의 `TB_MBR.MBR_NM`, `TB_RIDER.VHCL_TYPE_CD` |
| rider.dispatchedAt, rider.pickedUpAt | string / null | `TB_DLVR.DSPCH_DTTM`, `TB_DLVR.PKUP_DTTM`; 미픽업 시 pickedUpAt=null |
| customer.memberId, customer.name, customer.email, customer.tel | integer / string / null | 주문자의 `TB_MBR.MBR_ID`, `TB_MBR.MBR_NM`, `TB_MBR.MBR_EMAIL`, `TB_MBR.MBR_TELNO`; 탈퇴 시 tel=null |
| store.storeId, store.storeName, store.telNo | integer / string | `TB_STORE.STORE_ID`, `TB_STORE.STORE_NM`, `TB_STORE.STORE_TELNO` |
| timeline.orderedAt, timeline.acceptedAt, timeline.canceledAt | string / null | `TB_ORD.ORD_DTTM`, `TB_ORD.ORD_RCPT_DTTM`, `TB_ORD.ORD_CNCL_DTTM` |
| timeline.dispatchedAt, timeline.pickedUpAt, timeline.deliveredAt | string / null | `TB_DLVR.DSPCH_DTTM`, `TB_DLVR.PKUP_DTTM`, `TB_DLVR.DLVR_CMPL_DTTM`; 미도달 단계 null |
| canCancel | boolean | WAIT·COOKING·READY·DELIVERING 여부 |
| cancelProcessor | object / null | 관리자 취소 시 처리자 객체, 그 외 null |
| cancelProcessor.memberId, cancelProcessor.name | integer / string | `TB_ORD.CNCL_PRCSR_MBR_ID`로 연결한 관리자의 `TB_MBR.MBR_ID`, `TB_MBR.MBR_NM` |
| counselNote | string / null | `TB_ORD.CNSL_MEMO_CN` |


### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | orderId 형식 오류 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 주문 없음 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_RIDER`, `TB_STORE`, `TB_ORD`, `TB_ORD_DTL`, `TB_ORD_DTL_OPT`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: 만료 WAIT가 있으면 `TB_ORD`, 트리거로 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`.
- 트랜잭션: 조회 전 만료 WAIT 자동 취소·연쇄 변경을 한 트랜잭션으로 처리한 뒤 상세를 조회한다.
- 서버 검사: 주문→고객·가게·결제 연결, 배달·라이더·취소 처리자는 선택 조인. 배달 행은 접수 시 생성되므로 WAIT에서는 없을 수 있다. 주문·상세·옵션은 스냅샷으로 반환한다.
- 상태 변경 / VIEW·트리거: 조회 전 10분 만료 WAIT를 SYSTEM·NO_RESPONSE로 CANCEL 처리한다. `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. 배차·픽업·완료는 배달 일시로 판단하며 별도 배달 상태는 없다.

## X-13 주문 취소 (고객센터)
- method/path: `POST /api/admin/orders/{orderId}/cancel`
- 권한: ADMIN
- 설명: WAIT·COOKING·READY·DELIVERING 주문을 관리자 권한으로 취소한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| path | orderId | integer | 예 | 주문 ID |
| body | reason | string | 예 | CUSTOMER_REQUEST, STORE_ISSUE, DELIVERY_FAIL, ETC |
| body | counselNote | string | 예 | 공백만 불가, 최대 300자; 상담 내용 `TB_ORD.CNSL_MEMO_CN` |
| body | reasonDetail | string | ETC일 때 예 | ETC면 공백만 불가, 그 외 선택; `TB_ORD.ORD_CNCL_RSN_CN`에 저장, 생략 시 null |


### 응답
```json
{"success":true,"data":{"orderId":3021,"status":"CANCEL","canceledAt":"2026-11-18 18:20:00","refunded":true}}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| orderId, status, canceledAt | integer / string | `TB_ORD.ORD_ID`, `TB_ORD.ORD_STTS`, `TB_ORD.ORD_CNCL_DTTM` |
| refunded | boolean | 취소 트랜잭션 완료 표시(true); POINT 결제만 포인트 환불, 다른 수단은 결제 상태 취소를 뜻함 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | ID·reason·counselNote·reasonDetail 형식 오류 또는 ETC인데 reasonDetail 누락·공백 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 주문 없음 |
| 409 | ORDER_ALREADY_PROCESSED | DONE·CANCEL이거나 조건부 UPDATE 결과 0행 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_PAY`, `TB_DLVR` / 바꾸는 테이블: `TB_ORD`; 트리거로 `TB_PAY`, `TB_MBR`, `TB_PNT_TXN`, `TB_RIDER`. `TB_DLVR` 행은 유지한다.
- 트랜잭션: 주문 확인 → 허용 상태 조건부 UPDATE → 취소 트리거 연쇄 변경을 하나로 처리한다.
- 서버 검사: `WHERE ORD_ID=? AND ORD_STTS IN ('WAIT','COOKING','READY','DELIVERING')`의 변경 행 수를 확인한다. 조회 시 canCancel=true였어도 동시 배달완료·취소로 0행이면 409. 처리자는 요청에서 받지 않고 세션의 ADMIN 회원을 사용한다.
- 상태 변경 / VIEW·트리거: `TB_ORD.ORD_STTS='CANCEL'`, `TB_ORD.ORD_CNCL_DTTM`=현재, `TB_ORD.CNCL_ACTR_CD='ADMIN'`, `TB_ORD.CNCL_PRCSR_MBR_ID`=로그인 관리자, `TB_ORD.CNCL_RSN_CD`=reason, `TB_ORD.CNSL_MEMO_CN`=counselNote, `TB_ORD.ORD_CNCL_RSN_CN`=reasonDetail(생략 시 null). `ORD_STTS='CANCEL' UPDATE → TRG_ORD_CANCEL이 결제 취소·포인트 환불·라이더 IDLE 처리`. API가 중복 환불하거나 배달완료일시를 만들지 않는다. `TB_PAY.ORD_ID`는 UNIQUE로 주문당 결제 1건이며, 승인된 POINT 결제만 잔액 환불 및 양수 금액의 REFUND 거래를 생성하고 그 밖의 수단은 결제 상태만 CANCELED로 바꾼다. `TRG_ORD_MOD_DTTM` 등 수정일시 트리거가 동작한다. 관리자 취소는 매출·수락률 집계에서 제외한다.

## X-14 회원 검색
- method/path: `GET /api/admin/members`
- 권한: ADMIN
- 설명: 이름·이메일·전화번호 부분 검색으로 고객센터 대상 또는 X-09 제한 대상 회원을 찾는다. ACTIVE·WITHDRAWN 회원을 모두 검색하며 최대 50건, ADMIN은 제외한다.

### 요청
| 위치 | 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|---|
| query | keyword | string | 예 | 공백만 불가; 이름·이메일·전화번호 부분 검색 |
| query | role | string | 아니오 | CUSTOMER, OWNER, RIDER; 생략하면 세 역할 모두 |

### 응답
```json
{"success":true,"data":[{"memberId":7,"name":"박고객","email":"park@example.com","tel":"010-2222-3333","role":"CUSTOMER","joinedAt":"2026-11-01 12:00:00","orderCount":12,"hiddenReviewCount":2,"restricted":false}]}
```
| 필드 | 타입 | 설명 (출처 컬럼 또는 계산식) |
|---|---|---|
| [].memberId, [].name, [].email, [].tel, [].role | integer / string / null | `TB_MBR.MBR_ID`, `TB_MBR.MBR_NM`, `TB_MBR.MBR_EMAIL`, `TB_MBR.MBR_TELNO`, `TB_MBR.MBR_ROLE_CD`; 탈퇴 시 tel=null |
| [].joinedAt | string | `TB_MBR.REG_DTTM` |
| [].orderCount | integer | `TB_ORD.MBR_ID`가 회원인 주문 수(상태 무관) |
| [].hiddenReviewCount | integer | 해당 회원 주문의 `TB_RVW.RVW_HDN_YN='Y'` 리뷰 수 |
| [].restricted | boolean | 공통 활성 조건의 REVIEW_WRITE 제한 존재 여부 |

### 오류
| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | VALIDATION_ERROR | keyword 누락·공백 또는 role 허용값 아님 |
| 401 | UNAUTHORIZED | 세션 없음·만료·비활성 회원 |
| 403 | FORBIDDEN | ADMIN 아님 |

### DB 처리
- 읽는 테이블: `TB_MBR`, `TB_ORD`, `TB_RVW`, `TB_MBR_RSTR` / 바꾸는 테이블: 없음.
- 트랜잭션: 없음.
- 서버 검사: ACTIVE·WITHDRAWN 모두 포함하되 ADMIN 제외, 역할 필터, 이름·이메일·전화번호 OR 부분검색, 최대 50건 제한. 주문·숨김 리뷰는 각각 집계하여 다중 조인으로 건수가 부풀지 않게 한다. 검색 결과 없으면 빈 배열.
- 상태 변경 / VIEW·트리거: 없음. 주문은 상태 무관 건수·리뷰 작성자 연결에만 사용하며 주문 상태를 조회하지 않는다.

