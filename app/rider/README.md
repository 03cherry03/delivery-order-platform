# 라이더 화면 (/rider)

라이더 화면 API 명세서(D-01~D-09)와 공통 인증(A-01~A-03)을 따라 만든 라이더용 화면입니다.
사장 화면(`app/owner`)과 같은 방식으로 만들었습니다: 백엔드가 없어도 브라우저 안의 가짜 서버(목업)로 전체 흐름을 돌려 볼 수 있고, 백엔드가 붙으면 환경 변수 하나로 진짜 `/api`를 부릅니다.

## 실행

```
npm run dev
```

`.env.local` 없이(또는 `NEXT_PUBLIC_USE_MOCK=true`로) 실행하면 목업 모드다. http://localhost:3000/rider/login 에서 아래 계정으로 로그인합니다. (비밀번호 모두 `test1234`, 로그인 화면의 버튼을 누르면 자동 입력)

| 계정 | 처음 상태 | 확인할 수 있는 것 |
| --- | --- | --- |
| rider1@test.com 최라이더 | 배차 대기(IDLE), 오토바이, 반경 3km | 배차 요청 2건 수락 → 픽업 → 배달 완료, 지난 내역 30여 건 |
| rider2@test.com 정라이더 | 배달 중(BUSY), 주문 9 픽업함 | 바로 [배달 완료] |
| rider3@test.com 한라이더 | 배달 중(BUSY), 주문 8 조리 완료 | 바로 [픽업 완료], 반경 1km라 먼 가게는 목록에 안 보임 |

사람·가게·주문 번호는 `db/seed.sql`(실제 DB 샘플 데이터)과 맞췄습니다.

## 화면

| 주소 | 화면 | 쓰는 API |
| --- | --- | --- |
| /rider/login | 로그인. 배달 중이면 현재 배달로, 아니면 배차 대기로 | A-01, D-02 |
| /rider/signup | 라이더 회원가입 (운송수단, 활동 반경) | D-01, A-01 |
| /rider | 배차 대기 목록, 5초마다 새로고침. 수락 전에 확인 창 | D-04, D-05 |
| /rider/current | 현재 배달, 10초마다 새로고침. READY일 때만 [픽업 완료], DELIVERING일 때만 [배달 완료] | D-06, D-07, D-08 |
| /rider/history | 배달 내역, 오늘 건수·배달팁 합계, 20건씩 더 보기 | D-09 |
| /rider/me | 운송수단·활동 반경 수정(배달 중엔 막힘), 로그아웃, 회원 탈퇴(비밀번호 확인, 배달 중엔 막힘) | D-02, D-03, A-02, A-07 |

오류는 명세서대로 `error.message`를 토스트로 보여 주고, `error.code`로 다음 행동을 나눕니다.
- `ALREADY_DISPATCHED`, `ORDER_ALREADY_PROCESSED` → 목록·현재 배달을 다시 불러옴
- `RIDER_BUSY` → 내 상태를 다시 불러옴
- `NOT_READY`, `NOT_PICKED_UP` → 현재 배달을 다시 불러옴
- `PASSWORD_MISMATCH`, `HAS_ACTIVE_ORDERS` → 탈퇴 창 안에 메시지 표시
- 보고 있던 배달이 D-06에서 `null`로 바뀌면(내가 완료한 게 아니면) "주문이 취소되었다"고 알림
- 401·403 → 로그인 화면으로

## 목업(가짜 서버)에서 저절로 일어나는 일

- 조리중 주문은 조리 완료 예정 시각이 되면 READY로 바뀝니다 (사장이 조리 완료를 누른 것처럼)
- 대기 중인 요청이 3건보다 적으면 45초마다 새 요청이 들어옵니다
- 새 요청 중 일부는 1분쯤 뒤 다른 라이더가 가져갑니다 (목록에서 사라짐)
- 데이터는 브라우저 localStorage(`rider-mock-db-v1`)에 저장됩니다. 처음 상태로 돌리려면 [내 정보] 아래 "목업 데이터 처음 상태로"

## 실제 API로 실행 (server/ Express)

루트 README 순서대로 `npm run setup:server` → `npm run db:init`을 하고, `.env.example`을 `.env.local`로 복사한 뒤 터미널 두 개에서 `npm run dev:server`, `npm run dev:web`을 켠다. `.env.local`의 `NEXT_PUBLIC_USE_MOCK=false`이면 화면 위 "목업 모드" 띠가 사라지고 `http://localhost:4000/api/...`를 부른다(세션 쿠키, `credentials: 'include'`).

server/db/seed.sql 기준 라이더 계정 (비밀번호 test1234)

| 계정 | 처음 상태 | 확인할 수 있는 것 |
| --- | --- | --- |
| rider1@test.com | 배달 중, 배차받은 주문이 조리중 | 픽업 버튼 비활성, 탈퇴 막힘 |
| rider2@test.com | 배달 중, 조리 완료(READY) | [픽업 완료] → [배달 완료] |
| rider3@test.com | 픽업 후 배달 중 | [배달 완료], 이후 탈퇴 가능 |
| rider4@test.com | 배차 대기, 도보·반경 0.5km | 반경을 넓혀 배차 대기 목록 확인·수락 |

D-04는 명세서 메모대로 `lat`, `lng`을 보내지 않는다. 서버가 숭실대 좌표(37.4963, 126.9575)를 쓴다.

## 파일

```
app/rider/
  layout.js            .rider-root 범위, 폰트, 토스트
  rider.css            라이더 화면 스타일 전부 (rd- 접두어, 사장 화면과 같은 토큰)
  login/ signup/       로그인 안 한 화면
  (app)/               로그인한 화면 (괄호 폴더는 주소에 안 나옴)
    layout.js          헤더 + 아래 탭 (components/rider/RiderShell.js)
    page.js            배차 대기
    current/ history/ me/
components/rider/      ui.js(버튼·카드·모달·토스트), RiderShell.js, RadiusField.js
lib/rider/
  api.js               API 함수 (함수 옆 주석 = 명세서 ID)
  hooks.js             useRider(D-02 + 로그인 확인), useLoad(폴링), useNow
  codes.js             코드값 라벨, 상수, 폴링 간격
  format.js            금액·시간·거리 표시
  mock/                가짜 서버(server.js)와 처음 데이터(seed.js)
```

팀 공용 파일(`app/layout.js`, `app/globals.css`, `package.json`)은 건드리지 않았습니다.
