# Delivery Order Platform

데이터베이스응용 과목의 5인 팀프로젝트입니다.

Node.js, Next.js, SQLite를 활용하여 고객·사장·라이더가 이용하는 배달 음식 주문 웹 서비스를 개발합니다.

## 주요 개발 기능

* **고객**: 가게·메뉴 검색 및 조회, 장바구니 관리, 주문·가상 결제, 주문 내역 조회, 리뷰 작성
* **사장**: 가게 영업 상태 관리, 메뉴·옵션 관리, 주문 접수 및 거절, 리뷰 답글 작성, 매출 통계 조회
* **라이더**: 배차 대기 주문 조회, 배차 수락, 배달 완료 처리

## 기술 스택

* **Runtime**: Node.js
* **Framework**: Next.js
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

**3. 패키지 설치**
```powershell
npm ci
```

**4. 개발 서버 실행**
```powershell
npm run dev
```

**5. 웹사이트 접속**
브라우저에서 `http://localhost:3000`에 접속한다.

### SQLite 연결 확인
개발 서버 실행 후 아래 주소로 접속한다.

`http://localhost:3000/api/test-db`

`DB 연결 성공` 메시지가 출력되면 정상이다.

### 참고 사항
- SQLite DB 파일은 실행 환경에서 자동 생성된다.
- DB 파일은 `.gitignore`를 통해 GitHub 업로드에서 제외된다.
- 실제 회원·가게·주문 테이블은 확정된 DB 스키마에 따라 생성할 예정이다.
- Windows PowerShell에서 npm 실행이 차단될 경우 `npm.cmd`, `npx.cmd`를 사용할 수 있다.
- 개발 의존성 관련 보안 경고는 PR에 별도 기록하였다.