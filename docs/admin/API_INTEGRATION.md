# 관리자 API 연결

## 1. 기준 문서와 구조

이번 연결은 저장소의 최신 [관리자 계약](../../server/docs/api/admin.md), [인증 계약](../../server/docs/api/auth.md), 실제 `server/src/api` 구현을 기준으로 합니다. 이전 PDF보다 구체화된 요청 필드와 기본값을 프런트에 반영했습니다.

화면은 `lib/admin/api.js`를 통해 Express 서버에 JSON 요청을 보내고, 서버가 `server/delivery.db`를 조회·수정합니다. 관리자 코드는 공통 서버의 트랜잭션·환불·트리거 처리를 호출합니다.

| 구성 | 위치 |
|---|---|
| 화면 | `app/admin`, `components/admin` |
| 요청 함수·응답 검사 | `lib/admin/api.js` |
| 조회 상태·재조회·목록 페이지 | `lib/admin/hooks.js` |
| 공통 API 서버 | `server/src/app.js`, `server/src/routes.js` |
| 관리자 엔드포인트 | `server/src/api/admin` |
| 인증·권한 | `server/src/lib/auth.js` |
| SQLite 연결 | `server/src/lib/db.js` |

## 2. 환경변수

프로젝트 루트의 `.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_USE_MOCK=false
```

| 변수 | 관리자 코드의 처리 |
|---|---|
| `NEXT_PUBLIC_API_BASE` | 기본 `http://localhost:4000`. API 서버의 origin을 설정하며 `/api`는 붙이지 않음. |
| `NEXT_PUBLIC_USE_MOCK` | 정확히 `true`일 때만 시연 모드. 그 외에는 실제 API 사용. |

예를 들어 `getSummary()`는 `http://localhost:4000/api/admin/summary`를 요청합니다. 환경변수 변경 후 개발 서버를 다시 실행하고, 배포용으로 빌드한 경우에는 다시 빌드합니다.

## 3. 인증과 공통 응답

모든 실제 요청은 `credentials: 'include'`로 로그인 쿠키를 함께 전달합니다. 로그인 성공 응답에서 `role === 'ADMIN'`인지 확인하고, 관리자 레이아웃은 `/api/auth/me`로 현재 세션을 확인합니다. 실제 권한 검사는 서버가 요청마다 수행합니다.

```json
{
  "success": true,
  "data": { "memberId": 1, "name": "관리자", "role": "ADMIN" }
}
```

목록의 `data`는 배열이며 화면에서 페이지를 나눕니다. 클라이언트 요청 함수는 공통 응답에서 `data`를 꺼내 화면에 반환합니다.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해주세요.",
    "fields": { "reasonDetail": "상세 사유를 입력해 주세요." }
  }
}
```

서버가 보내는 `message`와 선택적인 `fields`를 화면에 표시합니다. 401을 받으면 관리자 로그인 화면으로 이동합니다. 409는 다른 요청이 먼저 처리했거나 현재 상태가 변경된 경우이므로, 데이터를 다시 조회한 후 현재 상태에 맞춰 처리합니다.

세션 쿠키는 `delivery_session`, HttpOnly, SameSite=Lax, 24시간 고정 수명입니다. 여러 역할을 같은 브라우저 일반 탭에서 번갈아 로그인하면 같은 쿠키가 바뀝니다.

## 4. 화면별 API 연결표

다음 경로는 모두 API 서버의 `/api`를 기준으로 합니다.

| ID | 클라이언트 함수 | 메서드·경로 |
|---|---|---|
| A-01 | `login` | `POST /auth/login` |
| A-02 | `logout` | `POST /auth/logout` |
| A-03 | `getMe` | `GET /auth/me` |
| X-00 | `getSummary` | `GET /admin/summary` |
| X-01 | `getApplications` | `GET /admin/store-applications?status=...` |
| X-02 | `getApplication` | `GET /admin/store-applications/{applicationId}` |
| X-03 | `approveApplication` | `POST /admin/store-applications/{applicationId}/approve` |
| X-04 | `rejectApplication` | `POST /admin/store-applications/{applicationId}/reject` |
| X-05 | `getReports` | `GET /admin/review-reports?status=...` |
| X-06 | `getReport` | `GET /admin/review-reports/{reportId}` |
| X-07 | `processReport` | `POST /admin/review-reports/{reportId}/process` |
| X-08 | `getRestrictions` | `GET /admin/restrictions?active=...` |
| X-09 | `createRestriction` | `POST /admin/restrictions` |
| X-10 | `releaseRestriction` | `POST /admin/restrictions/{restrictionId}/release` |
| X-11 | `searchOrders` | `GET /admin/orders?keyword=...` |
| X-12 | `getOrder` | `GET /admin/orders/{orderId}` |
| X-13 | `cancelOrder` | `POST /admin/orders/{orderId}/cancel` |
| X-14 | `searchMembers` | `GET /admin/members?keyword=...&role=...` |

## 5. 기존 관리자 화면과 달라진 연결 처리

### 기타 사유와 상담 메모

최신 X-13은 `reasonDetail`을 받습니다. `reason: 'ETC'`이면 상세 사유가 필수이며 상담 메모와 별개의 값입니다.

```json
{
  "reason": "ETC",
  "reasonDetail": "배달지 건물 출입이 불가능하여 고객과 취소를 협의함",
  "counselNote": "고객에게 취소 및 환불 처리 내용을 안내함"
}
```

화면에 기타 상세 입력란과 필수 검사를 추가하고, 취소 후 주문 상세에서 `cancelReasonDetail`을 표시합니다. 주문 상태·결제 취소·포인트 환불·라이더 복귀는 기존 서버 로직이 처리합니다.

### 현재 제한과 해제 이력

| 탭 | 요청 | 화면 처리 |
|---|---|---|
| 현재 제한 | `active=true` | 활성 제한 표시 |
| 해제 | `active=false` | 전체 이력 중 종료된 제한 표시 |
| 전체 | `active=false` | 전체 이력 표시 |

최신 서버는 `active`를 생략하면 `true`로 처리하므로, 이력을 조회할 때는 `false`를 명시합니다.

### 신청 상태와 가게 상태

입점 목록의 탭 상태는 선택한 신청의 상태입니다. 상세 응답의 `approvalStatus`는 가게의 현재 승인 상태입니다. 반려 후 재신청하면 두 값이 달라질 수 있으므로 화면에 구분하여 표시합니다.

과거 반려 신청을 열었을 때 현재 가게가 재신청 대기라고 해서 과거 신청에 승인·반려 버튼을 보여 주지 않도록 처리합니다. 최종 처리 가능 여부는 서버의 PENDING 검사와 조건부 UPDATE가 판단합니다.

### 오류 표시와 페이지 범위

처리 모달과 제한 해제 화면에서 서버의 오류 메시지를 확인할 수 있도록 했습니다. 필드 오류도 표시하며, 목록의 마지막 항목을 처리해 페이지 수가 줄었을 때 빈 페이지에 남지 않도록 유효한 페이지 범위로 조정합니다.

### API가 제공하는 필드만 표시

현재 X-06은 처리된 신고의 `processedAt`과 `processNote`를 반환하지 않습니다. 해당 값을 실제 처리 이력인 것처럼 만들어 표시하지 않습니다. 처리 결과는 서버가 제공하는 신고 상태와 리뷰 숨김·작성자 제한 상태를 기준으로 확인합니다.

## 6. CORS와 실행 주소

기본 실행 조합은 화면 `http://localhost:3000`, API `http://localhost:4000`입니다. API는 `CORS_ORIGINS`의 허용 목록에 있는 화면 origin에 쿠키 포함 요청을 허용합니다.

- 브라우저 주소와 API 주소에서 `localhost`와 `127.0.0.1`을 섞지 않습니다.
- Next.js가 3001번으로 실행되면 기본 허용 origin과 달라집니다. 3000번을 사용하는 기존 개발 서버를 정리하거나 서버의 허용 origin을 변경해야 합니다.
- 노트북에서 다른 PC를 접속할 때 `localhost`는 노트북 자신을 가리킵니다. API 주소, 화면 주소, 허용 origin을 해당 PC의 주소로 함께 맞춰야 합니다.
- `http://localhost:4000`은 로컬 개발 주소입니다. 외부 서비스 배포 완료를 뜻하지 않습니다.

API 개발 명령은 `server/.env`를 자동으로 읽지 않으므로 개발 CORS 설정을 바꿔야 한다면 실행 프로세스의 환경변수로 전달합니다. 자세한 환경 설정은 [백엔드 안내](../../server/docs/BACKEND.md)를 따릅니다.

## 7. 현재 검증 범위

실제 HTTP 요청과 임시 SQLite를 사용하는 API 테스트 및 실제 API 모드의 전체 Next.js 빌드가 통과했습니다. 빌드한 화면 서버의 관리자 7개 경로와 사장·라이더 로그인 경로에서 HTTP 200 응답을 확인했고, 관리자 코드와 테스트 스크립트의 ESLint 검사도 오류·경고 없이 통과했습니다.

브라우저의 자동 클릭과 시각 검증은 실행 환경 제한으로 완료하지 못했습니다. 자세한 범위와 재현 명령은 [검증 기록](VALIDATION.md)을 확인합니다.
