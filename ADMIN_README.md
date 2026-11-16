# 관리자 페이지 - main 기반 실행본

## 1. 이 파일의 기준

업로드한 `delivery-order-platform-main.zip`을 기준으로 관리자 파일만 추가했습니다.
`feature/owner-pages`의 사장 화면은 포함하지 않습니다. 사장 코드 없이 단독으로 설치하고 실행하는 전체 프로젝트입니다.

- `package.json`, `package-lock.json`: main 원본 그대로. 패키지나 버전을 변경하지 않았습니다.
- `app/page.js`, `app/layout.js`, `app/globals.css`, `next.config.mjs`, `lib/db.js`: main 원본 그대로.
- 기존 파일 중 `.gitignore`만 로컬 환경파일과 DB 산출물 제외 규칙을 추가했습니다.
- `app/admin`, `components/admin`, `lib/admin`에 관리자 화면와 API 호출 코드를 분리했습니다.

**기본은 시연(목업) 모드입니다. 실제 관리자 API 백엔드와 SQLite 업무 테이블은 포함되지 않습니다.**

## 2. 내 PC에서 실행

원본 프로젝트 안내와 같이 Node.js 24.x를 사용합니다. 첫 설치에는 인터넷이 필요합니다.

1. ZIP을 완전히 압축 해제합니다.
2. `package.json`이 보이는 폴더에서 터미널을 엽니다.
3. 다음 명령을 한 줄씩 실행합니다.

```powershell
npm.cmd ci
npm.cmd run dev
```

Windows에서는 `START_ADMIN.cmd`를 더블클릭해도 됩니다. 첫 실행 시 패키지를 설치하고 빈 포트로 개발 서버를 시작합니다.

서버의 `Ready` 메시지를 확인한 후 브라우저에서 엽니다:

```text
http://localhost:3000/admin/login
```

터미널에 다른 포트가 나오면 그 포트로 접속하세요. **`/`는 main의 기본 홈 화면이며, 관리자는 `/admin/login`으로 접속합니다.**

| 항목 | 입력값 |
|---|---|
| 이메일 | `admin@test.com` |
| 비밀번호 | `test1234` |

이 계정은 가상 시연용입니다. 종료할 때는 터미널에서 `Ctrl+C`를 누릅니다.

## 3. 화면과 API

| 경로 | 기능 | API |
|---|---|---|
| `/admin/login` | 관리자 로그인 | A-01~A-03 |
| `/admin` | 운영 대시보드 | X-00 |
| `/admin/applications` | 입점 신청 조회·승인·반려 | X-01~X-04 |
| `/admin/reports` | 리뷰 신고 처리 | X-05~X-07 |
| `/admin/restrictions` | 리뷰 작성 제한·해제 | X-08~X-10 |
| `/admin/orders` | 주문 검색·상세·취소 | X-11~X-13 |
| `/admin/members` | 회원 검색 | X-14 |

## 4. GitHub 브랜치

**새 브랜치의 Source는 `main`, 이름은 `feature/admin-pages`로 설정합니다. main에 직접 업로드하는 뜻이 아닙니다.**

GitHub Code 화면에서 main 선택 > 새 브랜치 생성 > Source main 확인 > 관리자 브랜치에 파일 업로드 순서입니다.
이미 다른 Source로 브랜치를 만들었다면 그 위에 올리지 말고 main에서 새 이름의 브랜치를 만드세요. 작업물이 있는 기존 브랜치를 임의로 삭제하지 않습니다.

ZIP 자체나 바깥 폴더가 아니라 **`package.json`이 있는 위치의 내용물**을 저장소 최상위에 올립니다.
실행 후 생긴 `node_modules`, `.next`, `.env.local`, DB 파일은 올리지 않습니다. 웹 업로드에서도 직접 제외해 주세요.

## 5. 시연 데이터와 실제 API

기본 설정은 `NEXT_PUBLIC_USE_MOCK=true`입니다. 관리자 시연 데이터는 브라우저 `localStorage`의 `delivery-admin-main-demo-v1`에 저장됩니다.
사장 목업과 같은 키를 쓰지 않으므로 **두 화면의 시연 데이터는 자동 공유되지 않습니다.**
나중에 공통 백엔드에 연결하면 두 화면이 같은 SQLite 업무 데이터를 사용하게 됩니다.

실제 API가 준비된 다음 `.env.local`을 만들어 다음과 같이 설정합니다.

```dotenv
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_BASE=
```

같은 Next.js 서버의 `/api/auth/...`, `/api/admin/...`를 호출합니다. 별도 서버면 공통 API 기본 주소를 입력하세요.
**설정만 바꾸면 API나 DB 테이블이 생성되는 것은 아닙니다.** 인증·권한·트랜잭션은 백엔드에서 구현해야 합니다.
`/api/test-db`는 main에 있던 SQLite 연결 테스트만 수행합니다.

## 6. 테마

참고: https://www.getdesign.kr/services/baemin
기존 관리자 화면의 민트색·네이비·둥근 카드 테마를 유지했습니다. `app/admin/baemin-theme.css`는 이전 버전과 동일합니다.
공식 배민 서비스가 아닌 수업용 프로젝트입니다.

## 7. 검증 범위

```powershell
node scripts/test-admin-mock.mjs
npm.cmd run build
```

목업·API 요청 테스트 24개 그룹과 JS/JSX/MJS 33개 파일의 구문·로컬 import 검사를 통과했습니다.
작업 환경에서 npm 레지스트리 DNS 연결이 실패하여 실제 Next.js 전체 설치·빌드는 검증하지 못했습니다. 팀 PC에서 위 build 명령으로 최종 확인해 주세요.
상세 결과: `docs/admin/TEST_REPORT.md`, `docs/admin/base-comparison.json`.
