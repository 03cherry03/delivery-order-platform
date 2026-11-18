# DB (SQLite) — 스키마와 샘플 데이터

담당: 김한준 · 2026-11-17

## 파일

| 파일 | 내용 |
| --- | --- |
| `db/schema.sql` | 테이블 23개, FK, CHECK·UNIQUE 제약조건, 인덱스 (STRICT 테이블) |
| `db/seed.sql` | 샘플 데이터 (회원 12, 가게 4, 주문 10 등) |
| `scripts/init-db.mjs` | `delivery.db`를 지우고 스키마 → 샘플 데이터 순서로 실행 |
| `lib/password.js` | 비밀번호 해시·검증 (`hashPassword`, `verifyPassword`). 샘플 계정도 이 형식 |

## 실행

`package.json`의 `scripts`에 한 줄 추가:

```json
"db:init": "node scripts/init-db.mjs"
```

```
npm run db:init            # 스키마 + 샘플 데이터
npm run db:init -- --empty # 스키마만
```

- 기존 `delivery.db`는 지워진다. `npm run dev`를 끈 상태에서 실행한다.
- 샘플 계정 비밀번호는 모두 `test1234`.
  admin@test.com, owner1~3@test.com, rider1~3@test.com, user1~5@test.com

## 기준

1. 라이더(11/14)·고객(11/14)·사장·관리자(11/12) API 명세서
2. ERD 변경사항(11/12)
3. ERD 초안 SQL(11/08)

## ERD 초안에서 바뀐 점

| 테이블 | 변경 |
| --- | --- |
| TB_STORE_HOURS | 신규. 요일별 영업시간(여러 구간 = 브레이크 타임, 행 없는 요일 = 휴무) |
| TB_MENU_CTGR | 신규. 메뉴 분류. TB_MENU.MENU_CTGR_NM → CTGR_ID |
| TB_MBR | PNT_BAL_AMT, MBR_WTHDR_DTTM 추가. MBR_STTS는 ACTIVE/WITHDRAWN. MBR_PWD·MBR_TELNO는 탈퇴 때문에 NULL 허용 |
| TB_MBR_ADDR | MBR_LAT, MBR_LNG NOT NULL |
| TB_RIDER | DLV_AREA_CN 삭제, ACT_RADIUS_M(기본 3000, 500~5000) 추가. RIDER_STTS는 IDLE/BUSY |
| TB_STORE | OPER_STRT_TM/OPER_END_TM 삭제, DLVR_EST_MI → COOK_EST_MI, STORE_CN·STORE_APRV_STTS 추가, 좌표 NOT NULL, 영업 상태는 OPEN/PAUSED |
| TB_ORD | ORD_RQST_CN → STORE_RQST_CN + RIDER_RQST_CN. CUTLERY_YN, DLVR_LAT/LNG, CNCL_ACTR_CD, CNCL_RSN_CD, CNCL_PRCSR_MBR_ID, CNSL_MEMO_CN 추가. READY = 조리완료·픽업대기 |
| TB_ORD_DTL_OPT | ORD_OPT_GRP_NM 추가 |
| TB_DLVR | DLVR_STTS 삭제. 사장 접수(O-03) 때 라이더 없이 생성. 인덱스 (RIDER_MBR_ID, DLVR_CMPL_DTTM), (RIDER_MBR_ID, REG_DTTM) |
| TB_PNT_TXN | 유형에 EXPIRE(탈퇴 소멸) 추가 |
| TB_RVW | RVW_CN NULL 허용 |
| TB_RVW_RPT | RVW_RPT_RSN_CD(ABUSE/FALSE/UNRELATED/ETC) 추가 |
| 옵션 순서 인덱스 | UNIQUE → 일반 인덱스 |
| 타입 | MySQL 타입 → SQLite STRICT (INTEGER, REAL, TEXT). 일시는 TEXT 'YYYY-MM-DD HH:MM:SS' |

## 백엔드가 알아야 할 것

- **MOD_DTTM 자동 갱신 없음.** SQLite에 ON UPDATE가 없다. UPDATE할 때 `MOD_DTTM = datetime('now','localtime')`를 같이 넣거나 트리거를 만든다.
- **일시 형식.** 모든 일시는 `YYYY-MM-DD HH:MM:SS`(한국 시간) 문자열. 문자열 비교로 순서를 판단하므로 형식을 지킨다.
- **기본 배송지는 회원당 하나(부분 UNIQUE 인덱스).** 기본 주소를 바꿀 때는 같은 트랜잭션에서 기존 주소를 'N'으로 먼저 바꾸고 새 주소를 'Y'로 바꾼다.
- **장바구니는 ON DELETE CASCADE.** `DELETE FROM TB_CART WHERE CART_ID=?` 한 번에 항목·옵션까지 지워진다(`foreign_keys = ON` 필요, lib/db.js에 이미 있음).
- **메뉴 분류는 같은 가게 것만.** TB_MENU의 (CTGR_ID, STORE_ID)가 TB_MENU_CTGR를 복합 FK로 참조한다.
- **상태 조합을 DB가 검사한다.** 예: CANCEL이면 취소일시·취소주체 필수, COOKING 이후는 접수일시·조리예상분 필수, 관리자 취소는 처리자·상담메모 필수, 승인 안 된 가게는 OPEN 불가, 배차 → 픽업 → 완료 순서.
- **트리거·VIEW는 이 파일에 없다.** 필요하면 `db/views.sql`, `db/triggers.sql`로 따로 만들고 init 스크립트에 추가한다.

## 정한 것 (팀 확인 필요)

1. **라이더 활동 기준 좌표 컬럼(ACT_BASE_LAT/LNG)은 넣지 않았다.** ERD 변경사항(11/12)에는 있지만, 더 나중에 나온 라이더 명세서(11/14)는 위치를 저장하지 않고 숭실대 좌표(37.4963, 126.9575)를 서버 상수로 쓴다.
2. **RIDER_STTS는 컬럼으로 유지했다(IDLE/BUSY).** 라이더 명세서에서 '보류'였지만 세 명세서 모두 이 컬럼을 읽고 쓴다.
3. **가게 카테고리 코드는 임시값이다.** CHICKEN, PIZZA, KOREAN, CHINESE, JAPANESE, SNACK, CAFE, ETC (사장 화면 codes.js와 같음). 착한가격업소 데이터를 넣을 때 확정한다.
4. **운송수단은 OTHER까지 허용했다.** 라이더 가입(D-01)은 4개만 받지만 ERD 초안과 사장 화면 라벨에 OTHER가 있다.
5. **비밀번호 해시는 Node 내장 crypto.scrypt.** 추가 패키지 없이 `lib/password.js`를 쓴다. bcrypt 등 다른 방식으로 바꾸면 seed.sql의 해시도 다시 만들어야 한다.
6. **가게 소개(STORE_CN) 길이는 1000자로 정했다.** 명세서에 길이가 없다.
