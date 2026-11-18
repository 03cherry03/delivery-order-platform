# 관리자 페이지 실행 및 API 연결 안내

관리자 페이지를 최신 `main`의 Express API와 SQLite 데이터베이스에 연결한 버전입니다. 기존 민트·네이비 화면 테마를 유지하며, 기본 설정에서는 실제 API를 호출합니다.

## 1. 사용할 압축파일

| 파일 | 용도 |
|---|---|
| `delivery-order-platform-main-with-admin-api.zip` | 최신 공통 프로젝트와 관리자 코드를 함께 실행할 때 사용하는 전체 파일 |
| `delivery-admin-api-update.zip` | 최신 `main`에 관리자 코드와 안내 문서만 추가할 때 사용하는 파일 |

전체 파일을 실행할 때는 압축을 풀고 **`package.json`과 `server` 폴더가 함께 있는 폴더**를 VS Code에서 엽니다. 아래 명령은 모두 이 프로젝트 루트에서 실행합니다.

업데이트 파일만 받은 경우에는 최신 `main` 프로젝트가 먼저 있어야 합니다. 압축 안의 `admin-api-update` 폴더를 열고, **그 안의 내용**을 기존 프로젝트 루트에 복사합니다.

## 2. 실행 구조

| 구성 | 실행 위치·주소 | 역할 |
|---|---|---|
| Next.js 화면 | `http://localhost:3000` | 관리자 화면 표시 |
| Express API | `http://localhost:4000` | 로그인, 조회, 승인, 신고 처리, 취소 |
| SQLite | `server/delivery.db` | 실제 조회·변경 결과 저장 |

화면과 API는 터미널 두 개에서 각각 실행합니다. `npm.cmd run dev`만 실행하면 Next.js 화면 서버만 켜집니다.

`localhost`는 지금 브라우저를 실행하는 컴퓨터를 뜻합니다. 위 주소는 같은 PC에서 화면과 API를 실행할 때 사용하는 로컬 주소입니다.

## 3. 처음 한 번 준비

### 3-1. Node.js 확인 및 패키지 설치

Node.js **24.x**를 사용합니다. VS Code 터미널에서 한 줄씩 실행하고, 오류 없이 끝나면 다음 명령으로 진행합니다.

```powershell
node -v
```

```powershell
npm.cmd ci
```

```powershell
npm.cmd run setup:server
```

`npm.cmd ci`는 화면 패키지를, `setup:server`는 API 서버 패키지를 설치합니다. 설치가 끝나도 서버는 아직 실행되지 않습니다.

### 3-2. 실제 API 모드 설정

루트에 `.env.local`이 없을 때만 다음 명령으로 예시 설정을 복사합니다.

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

`.env.local`을 열어 다음 두 값이 있는지 확인합니다. 이미 다른 설정이 있다면 필요한 두 값만 맞춥니다.

```dotenv
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_USE_MOCK=false
```

- `API_BASE`에는 `/api`를 붙이지 않습니다. 관리자 코드가 경로에 `/api`를 추가합니다.
- 환경변수를 바꾸면 Next.js 개발 서버를 껐다 켭니다.
- 배포용 빌드 후 값을 바꿨다면 다시 빌드합니다.
- 이번 관리자 코드는 환경변수가 없어도 기본적으로 실제 API를 사용하며, `NEXT_PUBLIC_USE_MOCK=true`를 명시한 경우에만 별도 시연 데이터 모드로 전환합니다.

### 3-3. SQLite 최초 생성

**새로 압축을 푼 프로젝트에 `server/delivery.db`가 없을 때만** 초기화합니다.

```powershell
if (-not (Test-Path server/delivery.db)) { npm.cmd run db:init }
```

초기화하면 테이블과 시연용 계정·가게·주문 데이터가 SQLite에 생성됩니다. 이 데이터는 실제 API로 조회하고 변경하는 초기 데이터입니다.

**`npm.cmd run db:init`을 다시 실행하면 기존 `server/delivery.db`가 삭제되고 초기 데이터로 바뀝니다.** 매번 서버를 켤 때 실행하지 마세요. 의도적으로 초기 상태로 되돌릴 때는 API 서버를 먼저 종료하고 실행합니다.

## 4. 화면 열기

### 터미널 1: API 서버

프로젝트 루트에서 실행한 뒤 이 터미널을 켜 둡니다.

```powershell
npm.cmd run dev:server
```

`API server ... http://localhost:4000` 메시지가 나오면 API 서버가 실행된 것입니다.

### 터미널 2: 화면 서버

VS Code에서 새 터미널을 열고, 같은 프로젝트 루트에서 실행합니다.

```powershell
npm.cmd run dev:web
```

브라우저에서 다음 주소를 엽니다.

**[관리자 로그인 열기](http://localhost:3000/admin/login)**

| 항목 | 초기 계정 |
|---|---|
| 이메일 | `admin@test.com` |
| 비밀번호 | `test1234` |

이 계정은 `db:init`으로 생성되는 **SQLite의 실제 관리자 계정**입니다. 별도로 사용하던 DB에 이 계정이 없다면 해당 DB에 등록된 관리자 계정을 사용해야 합니다.

로그인 후 입점 신청 목록으로 이동합니다. `/admin`에서 관리자 요약도 볼 수 있습니다. API 문서는 [http://localhost:4000/api-docs](http://localhost:4000/api-docs)에서 확인할 수 있습니다.

## 5. 관리자 화면과 연동 기능

| 화면 주소 | 기능 |
|---|---|
| `/admin/login` | 공통 로그인 API로 관리자 인증 |
| `/admin` | 대기 입점 신청·신고·활성 리뷰 제한 건수 |
| `/admin/applications` | 입점 신청 조회·승인·반려 |
| `/admin/reports` | 리뷰 신고 조회·숨김 또는 기각·작성자 제한 |
| `/admin/restrictions` | 현재 제한·해제 이력 조회 및 제한 해제 |
| `/admin/orders` | 주문 검색·상세 조회·관리자 취소 |
| `/admin/members` | 회원 검색 및 고객의 리뷰 작성 제한 |

## 6. 연결 후 확인할 순서

아래 데이터는 **초기화 직후** 기준입니다. 직접 처리한 뒤에는 건수와 상태가 바뀌는 것이 정상입니다.

1. 관리자 계정으로 로그인하고 요약 건수가 표시되는지 확인합니다. 초기에는 대기 신청 1건, 대기 신고 1건, 활성 제한 1건입니다.
2. 입점 신청 4번을 열어 가게·사장 정보가 보이는지 확인합니다. 승인 또는 반려 후 해당 탭에서 다시 조회합니다.
3. 리뷰 신고 1번을 열어 신고 내용·리뷰·주문·작성자 정보를 확인합니다.
4. 제한 목록의 `전체`와 `해제` 탭에서 기존 해제 이력이 표시되는지 확인합니다.
5. 주문 검색에 `3`을 입력합니다. 조리 중 주문에서 기타 사유를 선택하면 **기타 상세 사유와 상담 메모를 각각 입력**해야 합니다.
6. 화면을 새로고침해 변경한 결과가 유지되는지 확인합니다.

주문 6번은 포인트 결제·배달 중 주문이므로 취소 시 포인트 환불과 라이더 대기 복귀를 함께 확인할 수 있습니다. 취소·승인·신고 처리는 실제 SQLite 데이터를 변경합니다.

여러 역할을 동시에 확인할 때는 서로 다른 브라우저나 일반 창과 시크릿 창을 사용합니다. 같은 브라우저의 일반 탭들은 로그인 쿠키를 공유하므로 사장으로 로그인하면 기존 관리자 로그인도 바뀝니다.

## 7. GitHub 웹에서 올리기

관리자 코드만 올릴 때는 **`delivery-admin-api-update.zip`**을 사용합니다.

1. GitHub에서 `server` 폴더와 최신 API 코드가 있는 `main`을 선택합니다.
2. `package.json`, `app`, `server`가 보이는 저장소 최상위로 이동합니다.
3. 업데이트 압축을 풀고 `admin-api-update` 폴더를 엽니다.
4. GitHub의 `main`에서 `Add file → Upload files`를 선택합니다.
5. `admin-api-update` **안에 있는 내용**을 올립니다. `app/admin`, `components/admin`, `lib/admin`, `docs/admin`, 관리자 테스트 스크립트, `ADMIN_README.md`가 저장소의 해당 경로에 추가되어야 합니다.
6. 변경 목록을 확인한 뒤 `main`에 커밋합니다. 예: `Connect admin pages to the shared API`.

압축파일 자체나 바깥의 `admin-api-update` 폴더를 통째로 올려 한 단계 더 중첩시키지 마세요. 저장소 루트에서 `app/admin`이 바로 보여야 합니다.

기존 `app/owner`, `app/rider`, `server`, 루트 `package.json`·잠금파일·`.env.example`·`README.md`는 공통 프로젝트의 원본을 사용합니다. 업데이트 파일은 관리자 관련 파일을 추가하는 용도입니다.

실행하면서 생성된 `node_modules`, `.next`, `.env.local`, `server/delivery.db`는 업로드 대상에 넣지 않습니다.

## 8. 자주 막히는 부분

| 상황 | 확인할 내용 |
|---|---|
| 화면만 열리고 로그인에 실패함 | 터미널 1에서 `dev:server`도 실행 중인지 확인합니다. |
| 이전 시연 화면처럼 보임 | `.env.local`의 `NEXT_PUBLIC_USE_MOCK=false`를 확인하고 화면 서버를 다시 켭니다. |
| `Failed to fetch` 또는 네트워크 오류 | API 주소·실행 상태와 CORS를 확인합니다. 기본 조합은 화면 `http://localhost:3000`, API `http://localhost:4000`입니다. |
| 화면 주소가 `3001`로 바뀜 | 기본 API는 `http://localhost:3000`을 허용합니다. 3000번을 사용 중인 기존 화면 서버를 종료하고 다시 실행하거나 API의 허용 origin을 실제 주소에 맞춰야 합니다. |
| 로그인 후 401 | 쿠키가 만료되었거나 유효하지 않을 수 있습니다. 두 서버를 같은 `localhost` 표기로 열고 다시 로그인합니다. |
| 403 | 현재 로그인한 계정의 역할이 ADMIN인지 확인합니다. |
| 기타 사유 취소가 400 | 기타 상세 사유와 상담 메모가 모두 입력되었는지 확인합니다. |
| 처리할 때 409 | 다른 화면에서 먼저 처리했거나 현재 상태가 바뀌었을 수 있습니다. 새로 조회합니다. |

노트북에서 집 PC의 서버를 열려면 `localhost` 대신 집 PC의 같은 네트워크 주소를 사용하고, 화면의 API 주소와 서버의 허용 origin도 함께 맞춰야 합니다. 위 기본 설정은 **각 컴퓨터에서 직접 실행하는 경우**를 기준으로 합니다.

## 9. 검증 결과 및 개발 문서

- 실제 API 클라이언트와 임시 Express·SQLite 서버를 연결한 테스트: **18개 API, 20개 검증 그룹 통과**.
- 실제 API 모드의 Next.js 전체 빌드 통과: 관리자 7개 경로와 기존 사장·라이더 경로 포함.
- 관리자 파일과 API 테스트 스크립트의 ESLint 검사: 오류 0개·경고 0개.
- 빌드한 Next.js 서버에서 관리자 7개 경로와 기존 사장·라이더 로그인 경로의 HTTP 200 응답 확인.
- 최신 `main`의 원본 200개 파일은 해시 비교 결과 모두 동일합니다. 관리자 테마 CSS도 이전 관리자 버전과 동일합니다.
- 실행 환경 제한으로 브라우저 자동 클릭과 화면의 시각 검증은 완료하지 못했습니다. HTTP·데이터베이스 검증 및 빌드 결과와 구분해 기록했습니다.

자세한 내용:

- [API 연결 구조와 변경 사항](docs/admin/API_INTEGRATION.md)
- [검증 범위와 재실행 방법](docs/admin/VALIDATION.md)
- [현재 관리자 API 계약](server/docs/api/admin.md)
- [공통 인증 API 계약](server/docs/api/auth.md)
- [백엔드 실행 안내](server/docs/BACKEND.md)
