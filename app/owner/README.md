# 사장 화면 (/owner)

담당: 변진영 · 명세서: 사장·관리자 화면 API 명세서 (A·S·M·O·R·T)

## 주소

| 주소 | 화면 | API |
| --- | --- | --- |
| /owner/login | 로그인 | A-01 |
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

## 목업 모드

백엔드 API가 없어도 화면이 돌아가도록 `lib/owner/mock/`의 가짜 서버를 씁니다 (기본값).

- 테스트 계정: `owner@test.com` / `test1234`
- 목업 데이터는 브라우저 localStorage `owner-mock-db-v1`에 저장. 처음 상태로 돌리려면 그 키를 지운다.
- 시간이 지나면 새 주문 도착(40초), 10분 미접수 자동 취소, 라이더 배차(15초)·픽업·배달완료가 저절로 일어난다.

## 백엔드 붙이기

프로젝트 루트에 `.env.local`을 만들고 `NEXT_PUBLIC_USE_MOCK=false`를 넣으면 `app/api/...`(진짜 API)로 요청한다.
모든 요청은 `lib/owner/api.js`를 지나가며 함수 옆 주석이 명세서 ID다.

## 파일

- `app/owner/` 화면, `owner.css` 사장 화면 전용 스타일(`.owner-root` 안에서만 적용)
- `components/owner/` 버튼·배지·모달·토스트, 영업시간 입력, 가게 정보 폼
- `lib/owner/` API 함수, 코드값 라벨, 영업시간 변환, 목업 서버
