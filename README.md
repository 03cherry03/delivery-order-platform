# Delivery Order Platform

데이터베이스응용 과목의 5인 팀프로젝트입니다.

Node.js, Next.js, Express, SQLite로 고객·사장·라이더가 이용하는 배달 음식 주문 웹 서비스를 개발합니다.

화면과 API는 별도 프로세스로 실행합니다. 구조·실행 방법·화면 연결 방법은 [백엔드 안내](server/docs/BACKEND.md)에 정리했습니다.

## 주요 개발 기능

* **고객**: 가게·메뉴 검색 및 조회, 장바구니 관리, 주문·가상 결제, 주문 내역 조회, 리뷰 작성
* **사장**: 가게 영업 상태 관리, 메뉴·옵션 관리, 주문 접수 및 거절, 리뷰 답글 작성, 매출 통계 조회
* **라이더**: 배차 대기 주문 조회, 배차 수락, 배달 완료 처리

## 기술 스택

* **Runtime**: Node.js
* **Framework**: 화면 Next.js, API Express
* **Frontend**: React, HTML, CSS
* **Database**: SQLite
* **Version Control**: Git, GitHub

## 프로젝트 목표

ERD 설계와 정규화를 바탕으로 관계형 데이터베이스를 구축하고, SQL·제약조건·트랜잭션·VIEW·트리거를 웹 서비스에 적용합니다.

* **개발 인원**: 5명
* **개발 기간**: 약 4주
* **활용 데이터**: 행정안전부 착한가격업소 현황

## 개발 환경 및 실행 방법

### 개발 환경
- Node.js 24.x (24.22.2에서 테스트 완료)
- Next.js 16.4.5
- Express 5.3.0
- SQLite
- better-sqlite3 12.11.1

### 실행 방법
```sh
npm run dev:server   # 터미널 1: API :4000
npm run dev:web      # 터미널 2: 화면 :3000
```

두 명령은 모두 저장소 루트에서 실행합니다. 명령 하나가 서버 하나를 실행합니다.
동시 실행 스크립트는 없으므로 터미널 두 개를 사용합니다.
기존 `npm run dev`도 화면 서버만 실행합니다.

#### 처음 한 번 준비

저장소를 복제한 뒤 프로젝트 폴더에서 실행합니다.

```sh
git clone https://github.com/03cherry03/delivery-order-platform.git
cd delivery-order-platform
npm ci
npm run setup:server
npm run db:init
```

**DB 초기화 주의:** `npm run db:init`과 `npm run api:smoke`는 둘 다 기존 `server/delivery.db`를 삭제하고 다시 만듭니다. 실행 전에 API 서버를 끄고, 명령이 끝나면 다시 켜세요. 서버를 켠 채로 실행하면 서버가 삭제된 DB 파일을 계속 사용해 모든 쓰기 요청이 `500` 오류(`SQLITE_READONLY_DBMOVED`)로 실패합니다.

화면 환경변수는 루트의 `.env.example`을 `.env.local`로 복사합니다.

```sh
cp .env.example .env.local
```

PowerShell에서는 `Copy-Item .env.example .env.local`을 사용합니다.
기본 API 주소는 `http://localhost:4000`입니다. `NEXT_PUBLIC_USE_MOCK`을 설정하지 않거나 값이 `true`가 아니면 실제 API를 사용합니다. `NEXT_PUBLIC_USE_MOCK=true`일 때만 사장님·라이더·관리자 화면에서 목업 데이터를 사용합니다.
환경변수를 바꾸면 화면 개발 서버를 다시 켜고, 배포용 화면은 다시 빌드합니다.

#### 운영 실행

API는 `npm run start:server`로 실행합니다. 빌드는 필요 없습니다.
이 명령의 `--production` 플래그가 코드에서 `NODE_ENV=production`을 설정합니다.
환경변수 `NODE_ENV=production`으로도 같은 운영 모드를 선택할 수 있습니다.
운영 모드에서는 `SESSION_SECRET`이 없으면 서버가 아래 메시지를 출력하고 종료 코드 1로 끝납니다.

```text
API 서버를 시작하지 못했습니다: 운영 모드(NODE_ENV=production)에는 SESSION_SECRET 환경변수가 필요합니다.
```

먼저 아래 명령으로 긴 임의 문자열을 만듭니다.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

다음 세 방법 중 하나로 키를 전달합니다. 예시 문자열은 생성한 값으로 바꿉니다.

1. `server/.env` 파일을 만들고 `SESSION_SECRET=<긴 임의 문자열>` 한 줄을 저장한 뒤 루트에서 `npm run start:server`를 실행합니다. 이 파일은 Git에서 제외되며 운영 시작 명령만 읽습니다.
2. bash/zsh: `SESSION_SECRET="<긴 임의 문자열>" npm run start:server`
3. PowerShell: `$env:SESSION_SECRET="<긴 임의 문자열>"; npm run start:server`

화면은 다른 터미널에서 빌드한 뒤 실행합니다.

```sh
npm run build
npm run start:web
```

server 폴더에서 API를 직접 개발 실행하려면 `cd server && npm run dev`를 사용합니다.

#### 브라우저 접속

- 화면: `http://localhost:3000`
- API·Swagger UI: `http://localhost:4000/api-docs`
- 화면을 연결할 때는 브라우저에서 Express API로 직접 요청합니다. DB는 API 서버만 읽고 씁니다.

### 참고 사항
- Node.js 24를 사용합니다.
- DB 초기화는 `server/db/`의 스키마·VIEW·트리거·시연 데이터를 `server/delivery.db`에 적용합니다.
- seed 없이 초기화하려면 `npm run db:init -- --empty`를 사용합니다.
- 시연 계정 비밀번호는 모두 `test1234`입니다. 계정 목록은 [백엔드 안내](server/docs/BACKEND.md#시연-계정-npm-run-dbinit-후)에 있습니다.
- DB 파일과 로컬 환경 파일은 GitHub 업로드에서 제외됩니다.
- 운영 API에는 실제 화면 origin의 `CORS_ORIGINS`도 지정합니다. 운영 쿠키에 `Secure`가 붙으므로 HTTPS가 필요합니다.
- Windows PowerShell에서 npm 실행이 차단되면 `npm.cmd`를 사용합니다.
- 개발 의존성 관련 보안 경고는 PR에 별도 기록했습니다.