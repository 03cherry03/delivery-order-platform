# 관리자 화면

최신 `main`의 공통 API 서버와 SQLite를 사용하는 관리자 페이지입니다. 기존 민트·네이비 테마를 유지합니다.

처음 실행할 때는 루트의 [관리자 실행 안내](../../ADMIN_README.md)를 따릅니다.

## 화면 경로

| 경로 | 기능 |
|---|---|
| `/admin/login` | 로그인 및 관리자 역할 확인 |
| `/admin` | 관리자 요약 |
| `/admin/applications` | 입점 신청 조회·승인·반려 |
| `/admin/reports` | 리뷰 신고 조회·처리 |
| `/admin/restrictions` | 리뷰 작성 제한 조회·해제 |
| `/admin/orders` | 주문 검색·상세 조회·취소 |
| `/admin/members` | 회원 검색·리뷰 작성 제한 |

## API 연결

| 항목 | 설정 |
|---|---|
| 화면 서버 | Next.js, 기본 `http://localhost:3000` |
| API 서버 | Express, 기본 `http://localhost:4000` |
| API 클라이언트 | `lib/admin/api.js` |
| 인증 | 공통 `delivery_session` 쿠키, `credentials: 'include'` |
| 저장 위치 | 공통 API 서버의 `server/delivery.db` |
| 기본 모드 | 실제 API 호출 |

루트 `.env.local`은 다음과 같이 설정합니다.

```dotenv
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_USE_MOCK=false
```

`NEXT_PUBLIC_USE_MOCK=true`인 경우에만 관리자 별도 시연 데이터를 사용합니다. 실제 API 모드에서는 공통 SQLite의 조회 결과와 처리 결과가 화면에 반영됩니다.

## 구현 위치

- `app/admin`: 페이지 경로, 레이아웃, 테마 CSS.
- `components/admin`: 관리자 화면과 폼.
- `lib/admin/api.js`: A-01~03 및 X-00~14 API 요청.
- `lib/admin/hooks.js`: 조회·새로고침·페이지 처리.
- `lib/admin/mock`: 명시적으로 시연 모드를 선택했을 때의 데이터 처리.

API 서버의 실제 구현과 최신 계약은 `server/src/api` 및 `server/docs/api`에 있습니다. 관리자 프런트에서 SQLite를 직접 열지 않습니다.

## 연동 시 맞춘 부분

- 관리자 취소 사유가 `ETC`이면 별도 `reasonDetail`을 입력·전송합니다.
- 제한 이력 조회에 `active=false`를 사용합니다.
- 과거 입점 신청의 상태와 가게의 현재 승인 상태를 구분합니다.
- 서버의 입력 오류 메시지와 필드 오류를 표시합니다.
- 처리 후 목록 건수가 줄어든 경우 현재 페이지를 유효한 범위로 조정합니다.

상세 설명은 [API 연결 문서](../../docs/admin/API_INTEGRATION.md), 검증 범위는 [검증 기록](../../docs/admin/VALIDATION.md)을 확인합니다.
