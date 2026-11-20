# 사장 화면 (/owner)

명세서: 사장·관리자 화면 API 명세서 (A·S·M·O·R·T)

## 주소

| 주소 | 화면 | API |
| --- | --- | --- |
| /login (`/owner/login`은 목업용) | 로그인 | A-01 |
| /owner/signup | 사장 회원가입 + 입점 신청 | A-06 |
| /owner/stores | 가게 선택 | A-04 |
| /owner/stores/new | 가게 추가 / `?reapply=ID` 재신청 | A-05 |
| /owner/account | 회원 탈퇴 | A-07 |
| /owner/{storeId}/orders | 주문 접수 (5초 폴링) | O-01~O-06 |
| /owner/{storeId}/menus | 메뉴·분류 관리 | M-01, M-05, M-06, M-13~M-17 |
| /owner/{storeId}/menus/{menuId} | 메뉴 등록(`new`)·수정·옵션 | M-02~M-04, M-07~M-12 |
| /owner/{storeId}/store | 가게 정보·영업시간 | S-01, S-02, S-04 (S-03은 위쪽 스위치) |
| /owner/{storeId}/reviews | 리뷰 답글·신고 | R-01~R-06 |
| /owner/{storeId}/sales | 매출 통계 | T-01, T-02 |

## 가짜 데이터 모드

`.env.local`에 `NEXT_PUBLIC_USE_MOCK=true`를 설정한 경우에만 `lib/owner/mock/`의 가짜 서버를 쓴다. 화면 개발 서버를 다시 켠 뒤 `/owner/login`에서 로그인한다.

- 테스트 계정: `owner@test.com` / `test1234`
- 목업 데이터는 브라우저 localStorage `owner-mock-db-v1`에 저장. 처음 상태로 돌리려면 그 키를 지운다.
- 시간이 지나면 새 주문 도착(40초), 10분 미접수 자동 취소, 라이더 배차(15초)·픽업·배달완료가 저절로 일어난다.

## 실제 API로 실행 (백엔드 연결)

백엔드는 `server/`의 Express 서버(:4000)다. 처음 한 번 준비하는 방법은 [백엔드 안내](../../server/docs/BACKEND.md)를 따른다.

```sh
npm run dev:server   # 터미널 1: API :4000
npm run dev:web      # 터미널 2: 화면 :3000
```

- `NEXT_PUBLIC_USE_MOCK`을 설정하지 않거나 `true` 외의 값으로 두면 실제 API를 사용한다. 기본 API 주소(`http://localhost:4000`)를 바꾸려면 루트 `.env.local`에 `NEXT_PUBLIC_API_BASE`를 설정한다.
- http://localhost:3000/login 에서 시연 계정으로 로그인 (비밀번호 모두 `test1234`)

| 계정 | 가게 | 확인할 수 있는 것 |
| --- | --- | --- |
| owner1@test.com 김치킨 | 숭실 바삭치킨(승인), 준비중 분식(승인대기) | 신규·조리중·배달중 주문, 메뉴·옵션, 리뷰·신고 |
| owner2@test.com 이피자 | 상도 화덕피자(승인), 반려된 커피집(반려) | 신규·픽업대기 주문, 반려 가게 재신청 |
| owner3@test.com 박한식 | 숭실 든든한식(승인) | 조리중 주문 |

- O-01 주문 목록과 R-06 내 신고 목록은 백엔드 문서대로 페이지 없이 배열로 받는다.
- `.env.local`은 개인 설정이라 커밋하지 않는다.

## 파일

- `app/owner/` 화면, `owner.css` 사장 화면 전용 스타일(`.owner-root` 안에서만 적용)
- `components/owner/` 버튼·배지·모달·토스트, 영업시간 입력, 가게 정보 폼
- `lib/owner/` API 함수, 코드값 라벨, 영업시간 변환, 목업 서버
