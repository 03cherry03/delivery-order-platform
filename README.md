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
**1. GitHub 저장소 복제**

```powershell
git clone https://github.com/03cherry03/delivery-order-platform.git
```

**2. 프로젝트 폴더 이동**
```powershell
cd delivery-order-platform
```

**3. 터미널 1에서 화면 서버 실행 (저장소 루트)**

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

`.env.local`은 위 명령으로 만드는 로컬 설정 파일입니다.
예시 설정은 `NEXT_PUBLIC_API_BASE=http://localhost:4000`, `NEXT_PUBLIC_USE_MOCK=false`입니다.
환경변수를 바꾸면 화면 개발 서버를 다시 켭니다.

**4. 터미널 2에서 API 서버 실행 (저장소 루트에서 시작)**

```powershell
cd server
npm ci
npm run db:init
npm run dev
```

**5. 브라우저 접속**

- 화면: `http://localhost:3000`
- API·Swagger UI: `http://localhost:4000/api-docs`
- 화면을 연결할 때는 브라우저에서 Express API로 직접 요청합니다. DB는 API 서버만 읽고 씁니다.

### 참고 사항
- Node.js 24를 사용합니다.
- DB 초기화는 `server/db/`의 스키마·VIEW·트리거·시연 데이터를 `server/delivery.db`에 적용합니다.
- `npm run db:init`은 server 폴더에서 실행합니다. 기존 DB를 지우므로 API 서버를 끄고 초기화한 뒤 다시 켭니다.
- 시연 계정 비밀번호는 모두 `test1234`입니다. 계정 목록은 [백엔드 안내](server/docs/BACKEND.md#시연-계정-npm-run-dbinit-후)에 있습니다.
- DB 파일과 로컬 환경 파일은 GitHub 업로드에서 제외됩니다.
- 운영 API에는 `NODE_ENV=production`, 비밀 키 `SESSION_SECRET`, 실제 화면 origin의 `CORS_ORIGINS`를 지정합니다. 쿠키에 `Secure`가 붙으므로 HTTPS가 필요합니다.
- Windows PowerShell에서 npm 실행이 차단되면 `npm.cmd`를 사용합니다.
- 개발 의존성 관련 보안 경고는 PR에 별도 기록했습니다.