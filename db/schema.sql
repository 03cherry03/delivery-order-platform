-- =====================================================================
-- schema.sql  배달 음식 주문 플랫폼 DDL (SQLite, better-sqlite3)
-- 작성: 김한준  2026-11-17
--
-- 기준 (우선순위 순)
--   1. 라이더 API 명세서(11/14), 고객 API 명세서(11/14), 사장·관리자 API 명세서(11/12)
--   2. ERD 변경사항(11/12) 요청
--   3. ERD 초안 SQL(11/08)
--
-- 공통 규칙
--   * 모든 테이블은 STRICT 테이블이다. 선언한 타입과 다른 값이 들어오면 오류가 난다.
--   * 일시는 TEXT 'YYYY-MM-DD HH:MM:SS'(한국 시간), 시각은 TEXT 'HH:MM'으로 저장한다.
--     문자열 비교로 크기를 비교하므로 반드시 이 형식을 지킨다.
--   * REG_DTTM/MOD_DTTM은 기본값으로 현재 한국 시간이 들어간다.
--     SQLite에는 ON UPDATE가 없으므로 UPDATE할 때 MOD_DTTM은 앱(또는 트리거)이 직접 바꾼다.
--   * Y/N 컬럼은 TEXT 'Y'/'N', 금액은 원 단위 INTEGER, 좌표는 REAL.
--   * VARCHAR 길이는 SQLite가 지키지 않으므로 CHECK(length(...))로 도메인 길이를 강제한다.
--   * FK 검사는 lib/db.js의 PRAGMA foreign_keys = ON 으로 켜져 있어야 동작한다.
--   * 트리거·VIEW는 이 파일에 넣지 않는다(백엔드 담당과 협의 후 별도 파일).
-- =====================================================================

PRAGMA foreign_keys = ON;

-- 다시 만들 때를 위해 자식 테이블부터 지운다
DROP TABLE IF EXISTS TB_MBR_RSTR;
DROP TABLE IF EXISTS TB_RVW_RPT;
DROP TABLE IF EXISTS TB_RVW_REPLY;
DROP TABLE IF EXISTS TB_RVW;
DROP TABLE IF EXISTS TB_DLVR;
DROP TABLE IF EXISTS TB_PNT_TXN;
DROP TABLE IF EXISTS TB_PAY;
DROP TABLE IF EXISTS TB_ORD_DTL_OPT;
DROP TABLE IF EXISTS TB_ORD_DTL;
DROP TABLE IF EXISTS TB_ORD;
DROP TABLE IF EXISTS TB_CART_DTL_OPT;
DROP TABLE IF EXISTS TB_CART_DTL;
DROP TABLE IF EXISTS TB_CART;
DROP TABLE IF EXISTS TB_MENU_OPT;
DROP TABLE IF EXISTS TB_MENU_OPT_GRP;
DROP TABLE IF EXISTS TB_MENU;
DROP TABLE IF EXISTS TB_MENU_CTGR;
DROP TABLE IF EXISTS TB_STORE_APRV;
DROP TABLE IF EXISTS TB_STORE_HOURS;
DROP TABLE IF EXISTS TB_STORE;
DROP TABLE IF EXISTS TB_RIDER;
DROP TABLE IF EXISTS TB_MBR_ADDR;
DROP TABLE IF EXISTS TB_MBR;

-- ---------------------------------------------------------------------
-- 1. TB_MBR 회원
--   역할은 회원당 하나. 탈퇴하면 이름 '탈퇴회원', 전화·비밀번호 NULL, 이메일 변경(A-07).
-- ---------------------------------------------------------------------
CREATE TABLE TB_MBR (
  MBR_ID          INTEGER PRIMARY KEY AUTOINCREMENT,             -- 회원아이디
  MBR_EMAIL       TEXT    NOT NULL UNIQUE CHECK (length(MBR_EMAIL) <= 100),
  MBR_PWD         TEXT             CHECK (MBR_PWD IS NULL OR length(MBR_PWD) <= 255), -- 해시. 탈퇴 시 NULL
  MBR_NM          TEXT    NOT NULL CHECK (length(MBR_NM) BETWEEN 1 AND 50),
  MBR_TELNO       TEXT             CHECK (MBR_TELNO IS NULL OR length(MBR_TELNO) <= 20), -- 탈퇴 시 NULL
  MBR_ROLE_CD     TEXT    NOT NULL CHECK (MBR_ROLE_CD IN ('CUSTOMER', 'OWNER', 'RIDER', 'ADMIN')),
  MBR_STTS        TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK (MBR_STTS IN ('ACTIVE', 'WITHDRAWN')),
  PNT_BAL_AMT     INTEGER NOT NULL DEFAULT 0 CHECK (PNT_BAL_AMT >= 0), -- 포인트잔액. 차감은 조건부 UPDATE
  MBR_LOGIN_DTTM  TEXT,                                          -- 최종 로그인 일시
  MBR_WTHDR_DTTM  TEXT,                                          -- 회원탈퇴일시
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN          TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N')),
  -- 탈퇴 상태와 탈퇴일시는 항상 함께 있다
  CHECK ((MBR_STTS = 'WITHDRAWN') = (MBR_WTHDR_DTTM IS NOT NULL)),
  -- 활동 중인 회원은 비밀번호와 전화번호가 있어야 한다
  CHECK (MBR_STTS = 'WITHDRAWN' OR (MBR_PWD IS NOT NULL AND MBR_TELNO IS NOT NULL))
) STRICT;

CREATE INDEX IX_MBR_ROLE_STTS ON TB_MBR (MBR_ROLE_CD, MBR_STTS);

-- ---------------------------------------------------------------------
-- 2. TB_MBR_ADDR 회원주소 (회원 1 : N)
-- ---------------------------------------------------------------------
CREATE TABLE TB_MBR_ADDR (
  MBR_ADDR_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID       INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  MBR_ADDR_NM  TEXT    NOT NULL CHECK (length(MBR_ADDR_NM) BETWEEN 1 AND 30), -- 주소 별칭
  MBR_ADDR     TEXT    NOT NULL CHECK (length(MBR_ADDR) BETWEEN 1 AND 200),   -- 도로명 주소
  MBR_DADDR    TEXT             CHECK (MBR_DADDR IS NULL OR length(MBR_DADDR) <= 100),
  MBR_ZIP      TEXT    NOT NULL CHECK (length(MBR_ZIP) = 5 AND MBR_ZIP GLOB '[0-9][0-9][0-9][0-9][0-9]'),
  MBR_LAT      REAL    NOT NULL CHECK (MBR_LAT BETWEEN -90 AND 90),             -- 11/12 변경: NOT NULL
  MBR_LNG      REAL    NOT NULL CHECK (MBR_LNG BETWEEN -180 AND 180),
  DFLT_YN      TEXT    NOT NULL DEFAULT 'N' CHECK (DFLT_YN IN ('Y', 'N')),     -- 기본 배송지
  REG_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN       TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

CREATE INDEX IX_MBR_ADDR_MBR ON TB_MBR_ADDR (MBR_ID, DEL_YN);
-- 회원당 (삭제되지 않은) 기본 배송지는 최대 1개
CREATE UNIQUE INDEX UX_MBR_ADDR_DFLT ON TB_MBR_ADDR (MBR_ID) WHERE DFLT_YN = 'Y' AND DEL_YN = 'N';

-- ---------------------------------------------------------------------
-- 3. TB_RIDER 라이더 (TB_MBR 1 : 1, MBR_ID가 PK이자 FK)
--   DLV_AREA_CN 삭제, ACT_RADIUS_M 추가(라이더 명세서). RIDER_STTS는 IDLE/BUSY.
--   라이더 위치는 저장하지 않고 숭실대 좌표(37.4963, 126.9575)를 서버 상수로 쓴다.
-- ---------------------------------------------------------------------
CREATE TABLE TB_RIDER (
  MBR_ID        INTEGER PRIMARY KEY REFERENCES TB_MBR (MBR_ID),
  RIDER_STTS    TEXT    NOT NULL DEFAULT 'IDLE' CHECK (RIDER_STTS IN ('IDLE', 'BUSY')),
  VHCL_TYPE_CD  TEXT    NOT NULL CHECK (VHCL_TYPE_CD IN ('WALK', 'BICYCLE', 'MOTORCYCLE', 'CAR', 'OTHER')),
  ACT_RADIUS_M  INTEGER NOT NULL DEFAULT 3000 CHECK (ACT_RADIUS_M BETWEEN 500 AND 5000), -- 활동반경(m)
  REG_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;

-- ---------------------------------------------------------------------
-- 4. TB_STORE 가게
--   OPER_STRT_TM/OPER_END_TM → TB_STORE_HOURS, DLVR_EST_MI → COOK_EST_MI(기본 조리시간)
--   STORE_OPER_STTS는 OPEN/PAUSED만 저장(CLOSED는 조회 때 계산)
--   STORE_APRV_STTS는 현재 승인 상태. TB_STORE_APRV와 같은 트랜잭션에서 갱신
-- ---------------------------------------------------------------------
CREATE TABLE TB_STORE (
  STORE_ID         INTEGER PRIMARY KEY AUTOINCREMENT,
  OWNR_MBR_ID      INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),   -- 사장회원아이디
  STORE_NM         TEXT    NOT NULL CHECK (length(STORE_NM) BETWEEN 1 AND 50),
  STORE_CTGR_CD    TEXT    NOT NULL CHECK (STORE_CTGR_CD IN
                     ('CHICKEN', 'PIZZA', 'KOREAN', 'CHINESE', 'JAPANESE', 'SNACK', 'CAFE', 'ETC')), -- 임시 코드표
  BIZ_NO           TEXT    NOT NULL UNIQUE
                     CHECK (BIZ_NO GLOB '[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'),     -- 000-00-00000
  STORE_TELNO      TEXT    NOT NULL CHECK (length(STORE_TELNO) BETWEEN 1 AND 20),
  STORE_ADDR       TEXT    NOT NULL CHECK (length(STORE_ADDR) BETWEEN 1 AND 200),
  STORE_DADDR      TEXT             CHECK (STORE_DADDR IS NULL OR length(STORE_DADDR) <= 100),
  STORE_LAT        REAL    NOT NULL CHECK (STORE_LAT BETWEEN -90 AND 90),
  STORE_LNG        REAL    NOT NULL CHECK (STORE_LNG BETWEEN -180 AND 180),
  MIN_ORD_AMT      INTEGER NOT NULL CHECK (MIN_ORD_AMT >= 0),
  DLVR_TIP_AMT     INTEGER NOT NULL CHECK (DLVR_TIP_AMT >= 0),
  COOK_EST_MI      INTEGER NOT NULL CHECK (COOK_EST_MI >= 1),       -- 기본 조리시간(분)
  STORE_CN         TEXT             CHECK (STORE_CN IS NULL OR length(STORE_CN) <= 1000), -- 가게 소개
  STORE_OPER_STTS  TEXT    NOT NULL DEFAULT 'PAUSED' CHECK (STORE_OPER_STTS IN ('OPEN', 'PAUSED')),
  STORE_APRV_STTS  TEXT    NOT NULL DEFAULT 'PENDING' CHECK (STORE_APRV_STTS IN ('PENDING', 'APPROVED', 'REJECTED')),
  REG_DTTM         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN           TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N')),
  -- 승인된 가게만 영업(OPEN)할 수 있다 (S-03 STORE_NOT_APPROVED)
  CHECK (STORE_OPER_STTS = 'PAUSED' OR STORE_APRV_STTS = 'APPROVED')
) STRICT;

CREATE INDEX IX_STORE_OWNR ON TB_STORE (OWNR_MBR_ID, DEL_YN);
CREATE INDEX IX_STORE_SRCH ON TB_STORE (STORE_APRV_STTS, DEL_YN, STORE_CTGR_CD);
CREATE INDEX IX_STORE_NM   ON TB_STORE (STORE_NM);

-- ---------------------------------------------------------------------
-- 5. TB_STORE_HOURS 가게영업시간 (신규, 가게 1 : N)
--   한 요일에 행이 여러 개면 브레이크 타임, 행이 없는 요일은 휴무.
--   자정을 넘는 영업은 두 요일로 나눠 저장(금 18:00~24:00 + 토 00:00~02:00).
--   같은 요일 시간대 겹침 검사는 서버(INVALID_HOURS)에서 한다.
-- ---------------------------------------------------------------------
CREATE TABLE TB_STORE_HOURS (
  STORE_HOURS_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID        INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  DAY_OF_WEEK     INTEGER NOT NULL CHECK (DAY_OF_WEEK BETWEEN 0 AND 6),        -- 0(일)~6(토)
  OPEN_TM         TEXT    NOT NULL CHECK (OPEN_TM GLOB '[0-2][0-9]:[0-5][0-9]' AND OPEN_TM <= '23:59'),
  CLOSE_TM        TEXT    NOT NULL CHECK (CLOSE_TM GLOB '[0-2][0-9]:[0-5][0-9]' AND CLOSE_TM <= '24:00'),
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (CLOSE_TM > OPEN_TM)                                                    -- 종료가 시작보다 늦어야 함
) STRICT;

CREATE INDEX IX_STORE_HOURS_STORE ON TB_STORE_HOURS (STORE_ID, DAY_OF_WEEK);

-- ---------------------------------------------------------------------
-- 6. TB_STORE_APRV 가게승인 (입점 신청·승인/반려 이력, 재신청 시 새 행)
-- ---------------------------------------------------------------------
CREATE TABLE TB_STORE_APRV (
  STORE_APRV_ID    INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID         INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  STORE_APRV_STTS  TEXT    NOT NULL DEFAULT 'PENDING' CHECK (STORE_APRV_STTS IN ('PENDING', 'APPROVED', 'REJECTED')),
  APLY_DTTM        TEXT    NOT NULL,                                         -- 신청일시
  PRCSR_MBR_ID     INTEGER REFERENCES TB_MBR (MBR_ID),                       -- 처리 관리자
  PRCS_DTTM        TEXT,                                                     -- 처리일시
  RJCT_RSN_CN      TEXT    CHECK (RJCT_RSN_CN IS NULL OR length(RJCT_RSN_CN) <= 300),
  REG_DTTM         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 대기 중이면 처리 정보가 없고, 처리됐으면 처리자·처리일시가 있다
  CHECK ((STORE_APRV_STTS = 'PENDING') = (PRCS_DTTM IS NULL)),
  CHECK (STORE_APRV_STTS = 'PENDING' OR PRCSR_MBR_ID IS NOT NULL),
  -- 반려에는 사유가 있어야 한다 (X-04)
  CHECK (STORE_APRV_STTS <> 'REJECTED' OR RJCT_RSN_CN IS NOT NULL)
) STRICT;

CREATE INDEX IX_STORE_APRV_STORE ON TB_STORE_APRV (STORE_ID, APLY_DTTM);
CREATE INDEX IX_STORE_APRV_STTS  ON TB_STORE_APRV (STORE_APRV_STTS, APLY_DTTM);

-- ---------------------------------------------------------------------
-- 7. TB_MENU_CTGR 메뉴분류 (신규, 가게 1 : N, 분류 1 : N 메뉴)
--   같은 가게 안 분류명 중복 금지는 서버에서 검사(논리 삭제 때문, DUPLICATE_CATEGORY)
-- ---------------------------------------------------------------------
CREATE TABLE TB_MENU_CTGR (
  CTGR_ID   INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID  INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  CTGR_NM   TEXT    NOT NULL CHECK (length(CTGR_NM) BETWEEN 1 AND 50),
  CTGR_SEQ  INTEGER NOT NULL CHECK (CTGR_SEQ >= 1),
  REG_DTTM  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN    TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N')),
  UNIQUE (CTGR_ID, STORE_ID)            -- 메뉴의 (CTGR_ID, STORE_ID) 복합 FK 대상
) STRICT;

CREATE INDEX IX_MENU_CTGR_STORE ON TB_MENU_CTGR (STORE_ID, DEL_YN, CTGR_SEQ);

-- ---------------------------------------------------------------------
-- 8. TB_MENU 메뉴
--   MENU_CTGR_NM → CTGR_ID. (CTGR_ID, STORE_ID) 복합 FK로 "다른 가게의 분류" 지정을 막는다.
-- ---------------------------------------------------------------------
CREATE TABLE TB_MENU (
  MENU_ID         INTEGER PRIMARY KEY AUTOINCREMENT,
  STORE_ID        INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  CTGR_ID         INTEGER NOT NULL,
  MENU_NM         TEXT    NOT NULL CHECK (length(MENU_NM) BETWEEN 1 AND 50),
  MENU_AMT        INTEGER NOT NULL CHECK (MENU_AMT >= 0),
  MENU_CN         TEXT             CHECK (MENU_CN IS NULL OR length(MENU_CN) <= 300),
  MENU_SEQ        INTEGER NOT NULL CHECK (MENU_SEQ >= 1),
  MENU_SALE_STTS  TEXT    NOT NULL DEFAULT 'ON_SALE' CHECK (MENU_SALE_STTS IN ('ON_SALE', 'SOLD_OUT')),
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN          TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N')),
  FOREIGN KEY (CTGR_ID, STORE_ID) REFERENCES TB_MENU_CTGR (CTGR_ID, STORE_ID)
) STRICT;

CREATE INDEX IX_MENU_CTGR_SEQ ON TB_MENU (CTGR_ID, MENU_SEQ);
CREATE INDEX IX_MENU_SALE     ON TB_MENU (STORE_ID, MENU_SALE_STTS, DEL_YN);

-- ---------------------------------------------------------------------
-- 9. TB_MENU_OPT_GRP 메뉴옵션그룹 (메뉴 1 : N)
--   순서 인덱스는 UNIQUE가 아님(논리 삭제·순서 변경 충돌 방지, 11/12 변경)
-- ---------------------------------------------------------------------
CREATE TABLE TB_MENU_OPT_GRP (
  OPT_GRP_ID    INTEGER PRIMARY KEY AUTOINCREMENT,
  MENU_ID       INTEGER NOT NULL REFERENCES TB_MENU (MENU_ID),
  OPT_GRP_NM    TEXT    NOT NULL CHECK (length(OPT_GRP_NM) BETWEEN 1 AND 50),
  RQRD_YN       TEXT    NOT NULL DEFAULT 'N' CHECK (RQRD_YN IN ('Y', 'N')),
  MAX_SLCT_CNT  INTEGER NOT NULL DEFAULT 1 CHECK (MAX_SLCT_CNT >= 1),
  OPT_GRP_SEQ   INTEGER NOT NULL CHECK (OPT_GRP_SEQ >= 1),
  REG_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN        TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

CREATE INDEX IX_OPT_GRP_MENU_SEQ ON TB_MENU_OPT_GRP (MENU_ID, OPT_GRP_SEQ);

-- ---------------------------------------------------------------------
-- 10. TB_MENU_OPT 메뉴옵션 (옵션 그룹 1 : N)
-- ---------------------------------------------------------------------
CREATE TABLE TB_MENU_OPT (
  OPT_ID      INTEGER PRIMARY KEY AUTOINCREMENT,
  OPT_GRP_ID  INTEGER NOT NULL REFERENCES TB_MENU_OPT_GRP (OPT_GRP_ID),
  OPT_NM      TEXT    NOT NULL CHECK (length(OPT_NM) BETWEEN 1 AND 50),
  OPT_AMT     INTEGER NOT NULL DEFAULT 0 CHECK (OPT_AMT >= 0),   -- 추가 금액
  OPT_SEQ     INTEGER NOT NULL CHECK (OPT_SEQ >= 1),
  REG_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN      TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

CREATE INDEX IX_OPT_GRP_OPT_SEQ ON TB_MENU_OPT (OPT_GRP_ID, OPT_SEQ);

-- ---------------------------------------------------------------------
-- 11~13. 장바구니 (회원당 1개, 한 가게 메뉴만)
--   항목·옵션은 ON DELETE CASCADE: 장바구니(또는 항목)를 지우면 아래 행도 함께 지워진다(C-16, C-17).
-- ---------------------------------------------------------------------
CREATE TABLE TB_CART (
  CART_ID   INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID    INTEGER NOT NULL UNIQUE REFERENCES TB_MBR (MBR_ID),
  STORE_ID  INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  REG_DTTM  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;

CREATE TABLE TB_CART_DTL (
  CART_DTL_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  CART_ID      INTEGER NOT NULL REFERENCES TB_CART (CART_ID) ON DELETE CASCADE,
  MENU_ID      INTEGER NOT NULL REFERENCES TB_MENU (MENU_ID),
  CART_QTY     INTEGER NOT NULL DEFAULT 1 CHECK (CART_QTY >= 1),
  REG_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
) STRICT;

CREATE INDEX IX_CART_DTL_MENU ON TB_CART_DTL (CART_ID, MENU_ID);

CREATE TABLE TB_CART_DTL_OPT (
  CART_DTL_OPT_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  CART_DTL_ID      INTEGER NOT NULL REFERENCES TB_CART_DTL (CART_DTL_ID) ON DELETE CASCADE,
  OPT_ID           INTEGER NOT NULL REFERENCES TB_MENU_OPT (OPT_ID),
  REG_DTTM         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (CART_DTL_ID, OPT_ID)
) STRICT;

-- ---------------------------------------------------------------------
-- 14. TB_ORD 주문
--   상태: WAIT → COOKING → READY(조리완료·픽업대기) → DELIVERING → DONE, 또는 CANCEL
--   ORD_RQST_CN → STORE_RQST_CN + RIDER_RQST_CN, 배달지 좌표 스냅샷, 취소 정보 코드화
-- ---------------------------------------------------------------------
CREATE TABLE TB_ORD (
  ORD_ID             INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID             INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),     -- 주문 고객
  STORE_ID           INTEGER NOT NULL REFERENCES TB_STORE (STORE_ID),
  ORD_DTTM           TEXT    NOT NULL,                                -- 주문 요청 일시
  ORD_STTS           TEXT    NOT NULL DEFAULT 'WAIT'
                       CHECK (ORD_STTS IN ('WAIT', 'COOKING', 'READY', 'DELIVERING', 'DONE', 'CANCEL')),
  ORD_TOT_AMT        INTEGER NOT NULL CHECK (ORD_TOT_AMT >= 0),       -- 메뉴+옵션 합계(배달팁 제외)
  DLVR_TIP_AMT       INTEGER NOT NULL CHECK (DLVR_TIP_AMT >= 0),      -- 주문 시점 배달팁
  STORE_RQST_CN      TEXT    CHECK (STORE_RQST_CN IS NULL OR length(STORE_RQST_CN) <= 300), -- 가게 요청사항
  RIDER_RQST_CN      TEXT    CHECK (RIDER_RQST_CN IS NULL OR length(RIDER_RQST_CN) <= 300), -- 라이더 요청사항
  CUTLERY_YN         TEXT    NOT NULL DEFAULT 'N' CHECK (CUTLERY_YN IN ('Y', 'N')),          -- 일회용 수저
  DLVR_ADDR          TEXT    NOT NULL CHECK (length(DLVR_ADDR) BETWEEN 1 AND 200),           -- 배달지 스냅샷
  DLVR_DADDR         TEXT    CHECK (DLVR_DADDR IS NULL OR length(DLVR_DADDR) <= 100),
  DLVR_LAT           REAL    NOT NULL CHECK (DLVR_LAT BETWEEN -90 AND 90),
  DLVR_LNG           REAL    NOT NULL CHECK (DLVR_LNG BETWEEN -180 AND 180),
  ORD_RCPT_DTTM      TEXT,                                            -- 사장 접수 일시
  COOK_EST_MI        INTEGER CHECK (COOK_EST_MI IS NULL OR COOK_EST_MI >= 1), -- 이 주문의 조리 예상분
  ORD_CNCL_DTTM      TEXT,                                            -- 취소 일시
  CNCL_ACTR_CD       TEXT    CHECK (CNCL_ACTR_CD IN ('CUSTOMER', 'OWNER', 'SYSTEM', 'ADMIN')), -- 취소 주체
  CNCL_RSN_CD        TEXT    CHECK (CNCL_RSN_CD IN ('OUT_OF_STOCK', 'BUSY', 'CLOSING', 'CANNOT_COOK',
                                                    'NO_RESPONSE', 'CUSTOMER_REQUEST', 'STORE_ISSUE',
                                                    'DELIVERY_FAIL', 'ETC')),
  ORD_CNCL_RSN_CN    TEXT    CHECK (ORD_CNCL_RSN_CN IS NULL OR length(ORD_CNCL_RSN_CN) <= 300), -- 기타 사유 상세
  CNCL_PRCSR_MBR_ID  INTEGER REFERENCES TB_MBR (MBR_ID),              -- 고객센터 취소 처리 관리자
  CNSL_MEMO_CN       TEXT    CHECK (CNSL_MEMO_CN IS NULL OR length(CNSL_MEMO_CN) <= 300),       -- 상담 메모
  REG_DTTM           TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM           TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 취소 상태 ⇔ 취소일시·취소주체가 있음
  CHECK ((ORD_STTS = 'CANCEL') = (ORD_CNCL_DTTM IS NOT NULL)),
  CHECK ((ORD_STTS = 'CANCEL') = (CNCL_ACTR_CD IS NOT NULL)),
  -- 접수 이후 상태는 접수일시와 조리 예상분이 있어야 함 (D-04 expectedReadyAt 계산)
  CHECK (ORD_STTS IN ('WAIT', 'CANCEL') OR (ORD_RCPT_DTTM IS NOT NULL AND COOK_EST_MI IS NOT NULL)),
  -- 고객센터(ADMIN) 취소는 처리 관리자와 상담 메모가 있어야 함 (X-13)
  CHECK (CNCL_ACTR_CD IS NOT 'ADMIN' OR (CNCL_PRCSR_MBR_ID IS NOT NULL AND CNSL_MEMO_CN IS NOT NULL))
) STRICT;

CREATE INDEX IX_ORD_MBR_DTTM   ON TB_ORD (MBR_ID, ORD_DTTM);
CREATE INDEX IX_ORD_STORE_STTS ON TB_ORD (STORE_ID, ORD_STTS, ORD_DTTM);
CREATE INDEX IX_ORD_STTS_DTTM  ON TB_ORD (ORD_STTS, ORD_DTTM);   -- 10분 자동 취소 대상 조회

-- ---------------------------------------------------------------------
-- 15. TB_ORD_DTL 주문상세 (메뉴명·단가 스냅샷, 단가는 옵션 제외)
-- ---------------------------------------------------------------------
CREATE TABLE TB_ORD_DTL (
  ORD_DTL_ID   INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID       INTEGER NOT NULL REFERENCES TB_ORD (ORD_ID),
  ORD_DTL_SEQ  INTEGER NOT NULL CHECK (ORD_DTL_SEQ >= 1),
  MENU_ID      INTEGER NOT NULL REFERENCES TB_MENU (MENU_ID),
  ORD_MENU_NM  TEXT    NOT NULL CHECK (length(ORD_MENU_NM) BETWEEN 1 AND 50),
  ORD_QTY      INTEGER NOT NULL CHECK (ORD_QTY >= 1),
  ORD_UPRC     INTEGER NOT NULL CHECK (ORD_UPRC >= 0),
  REG_DTTM     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (ORD_ID, ORD_DTL_SEQ)
) STRICT;

-- ---------------------------------------------------------------------
-- 16. TB_ORD_DTL_OPT 주문상세옵션 (옵션 그룹명·옵션명·추가금액 스냅샷)
-- ---------------------------------------------------------------------
CREATE TABLE TB_ORD_DTL_OPT (
  ORD_DTL_OPT_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_DTL_ID      INTEGER NOT NULL REFERENCES TB_ORD_DTL (ORD_DTL_ID),
  OPT_ID          INTEGER NOT NULL REFERENCES TB_MENU_OPT (OPT_ID),
  ORD_OPT_GRP_NM  TEXT    NOT NULL CHECK (length(ORD_OPT_GRP_NM) BETWEEN 1 AND 50), -- 11/12 추가
  ORD_OPT_NM      TEXT    NOT NULL CHECK (length(ORD_OPT_NM) BETWEEN 1 AND 50),
  ORD_OPT_AMT     INTEGER NOT NULL CHECK (ORD_OPT_AMT >= 0),
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (ORD_DTL_ID, OPT_ID)
) STRICT;

-- ---------------------------------------------------------------------
-- 17. TB_PAY 결제 (주문당 1건, 결제금액 = 주문총금액 + 배달팁)
-- ---------------------------------------------------------------------
CREATE TABLE TB_PAY (
  PAY_ID         INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID         INTEGER NOT NULL UNIQUE REFERENCES TB_ORD (ORD_ID),
  PAY_MTHD_CD    TEXT    NOT NULL CHECK (PAY_MTHD_CD IN ('CARD', 'KAKAO', 'NAVER', 'POINT')),
  PAY_AMT        INTEGER NOT NULL CHECK (PAY_AMT >= 0),
  PAY_STTS       TEXT    NOT NULL DEFAULT 'READY' CHECK (PAY_STTS IN ('READY', 'APPROVED', 'CANCELED')),
  PAY_REF_NO     TEXT    CHECK (PAY_REF_NO IS NULL OR length(PAY_REF_NO) <= 100), -- 외부 결제/포인트 거래 참조
  PAY_APRV_DTTM  TEXT,
  PAY_CNCL_DTTM  TEXT,
  REG_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (PAY_STTS = 'READY' OR PAY_APRV_DTTM IS NOT NULL),
  CHECK ((PAY_STTS = 'CANCELED') = (PAY_CNCL_DTTM IS NOT NULL))
) STRICT;

-- ---------------------------------------------------------------------
-- 18. TB_PNT_TXN 포인트거래 (원장. 금액은 양수, 유형으로 증감 판단)
--   CHARGE·REFUND = 증가, USE·EXPIRE(탈퇴 소멸) = 감소
-- ---------------------------------------------------------------------
CREATE TABLE TB_PNT_TXN (
  PNT_TXN_ID       INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID           INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  ORD_ID           INTEGER REFERENCES TB_ORD (ORD_ID),
  PNT_TXN_TYPE_CD  TEXT    NOT NULL CHECK (PNT_TXN_TYPE_CD IN ('CHARGE', 'USE', 'REFUND', 'EXPIRE')),
  PNT_TXN_AMT      INTEGER NOT NULL CHECK (PNT_TXN_AMT > 0),
  PNT_BAL_AMT      INTEGER NOT NULL CHECK (PNT_BAL_AMT >= 0),          -- 거래 직후 잔액
  CHRG_MTHD_CD     TEXT    CHECK (CHRG_MTHD_CD IN ('CARD', 'KAKAO', 'NAVER')),
  PNT_TXN_STTS     TEXT    NOT NULL DEFAULT 'COMPLETED' CHECK (PNT_TXN_STTS IN ('READY', 'COMPLETED', 'CANCELED')),
  PNT_TXN_DTTM     TEXT    NOT NULL,
  REG_DTTM         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 충전수단은 충전일 때만 있다
  CHECK ((PNT_TXN_TYPE_CD = 'CHARGE') = (CHRG_MTHD_CD IS NOT NULL)),
  -- 사용·환불은 주문과 연결된다
  CHECK (PNT_TXN_TYPE_CD NOT IN ('USE', 'REFUND') OR ORD_ID IS NOT NULL)
) STRICT;

CREATE INDEX IX_PNT_TXN_MBR_DTTM ON TB_PNT_TXN (MBR_ID, PNT_TXN_DTTM);
CREATE INDEX IX_PNT_TXN_ORD      ON TB_PNT_TXN (ORD_ID);

-- ---------------------------------------------------------------------
-- 19. TB_DLVR 배달 (주문당 1건)
--   사장이 접수(O-03)할 때 라이더 없이 생성(= 배차 요청). DLVR_STTS는 삭제(11/12 변경).
--   배차 여부 = RIDER_MBR_ID, 픽업 여부 = PKUP_DTTM, 완료 여부 = DLVR_CMPL_DTTM
-- ---------------------------------------------------------------------
CREATE TABLE TB_DLVR (
  DLVR_ID         INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID          INTEGER NOT NULL UNIQUE REFERENCES TB_ORD (ORD_ID),
  RIDER_MBR_ID    INTEGER REFERENCES TB_RIDER (MBR_ID),               -- 배차 전 NULL
  DSPCH_DTTM      TEXT,                                               -- 배차 일시
  PKUP_DTTM       TEXT,                                               -- 픽업 일시
  DLVR_CMPL_DTTM  TEXT,                                               -- 배달 완료 일시
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 라이더와 배차일시는 함께 들어간다
  CHECK ((RIDER_MBR_ID IS NULL) = (DSPCH_DTTM IS NULL)),
  -- 배차 → 픽업 → 완료 순서로만 기록된다
  CHECK (PKUP_DTTM IS NULL OR DSPCH_DTTM IS NOT NULL),
  CHECK (DLVR_CMPL_DTTM IS NULL OR PKUP_DTTM IS NOT NULL)
) STRICT;

CREATE INDEX IX_DLVR_RIDER_CMPL ON TB_DLVR (RIDER_MBR_ID, DLVR_CMPL_DTTM);  -- 현재 배달, 배달 내역
CREATE INDEX IX_DLVR_RIDER_REG  ON TB_DLVR (RIDER_MBR_ID, REG_DTTM);        -- 배차 대기(RIDER_MBR_ID IS NULL)

-- ---------------------------------------------------------------------
-- 20. TB_RVW 리뷰 (배달완료 주문당 1건, 삭제 후 재작성 불가)
--   RVW_CN은 NULL 허용(11/12 변경). 가게 평점은 저장하지 않고 조회 때 계산.
-- ---------------------------------------------------------------------
CREATE TABLE TB_RVW (
  RVW_ID      INTEGER PRIMARY KEY AUTOINCREMENT,
  ORD_ID      INTEGER NOT NULL UNIQUE REFERENCES TB_ORD (ORD_ID),
  RVW_RTNG    INTEGER NOT NULL CHECK (RVW_RTNG BETWEEN 1 AND 5),
  RVW_CN      TEXT    CHECK (RVW_CN IS NULL OR length(RVW_CN) <= 1000),
  RVW_HDN_YN  TEXT    NOT NULL DEFAULT 'N' CHECK (RVW_HDN_YN IN ('Y', 'N')),  -- 관리자 숨김
  REG_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN      TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

CREATE INDEX IX_RVW_PUBLIC ON TB_RVW (RVW_HDN_YN, DEL_YN, REG_DTTM);

-- ---------------------------------------------------------------------
-- 21. TB_RVW_REPLY 리뷰답글 (리뷰당 1건, 다시 달 때는 삭제된 행을 되살림)
-- ---------------------------------------------------------------------
CREATE TABLE TB_RVW_REPLY (
  RVW_REPLY_ID  INTEGER PRIMARY KEY AUTOINCREMENT,
  RVW_ID        INTEGER NOT NULL UNIQUE REFERENCES TB_RVW (RVW_ID),
  OWNR_MBR_ID   INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  RVW_REPLY_CN  TEXT    NOT NULL CHECK (length(RVW_REPLY_CN) BETWEEN 1 AND 1000),
  REG_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  MOD_DTTM      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  DEL_YN        TEXT    NOT NULL DEFAULT 'N' CHECK (DEL_YN IN ('Y', 'N'))
) STRICT;

-- ---------------------------------------------------------------------
-- 22. TB_RVW_RPT 리뷰신고 (같은 회원은 같은 리뷰를 한 번만)
-- ---------------------------------------------------------------------
CREATE TABLE TB_RVW_RPT (
  RVW_RPT_ID      INTEGER PRIMARY KEY AUTOINCREMENT,
  RVW_ID          INTEGER NOT NULL REFERENCES TB_RVW (RVW_ID),
  RPTR_MBR_ID     INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),        -- 신고자
  RVW_RPT_RSN_CD  TEXT    NOT NULL CHECK (RVW_RPT_RSN_CD IN ('ABUSE', 'FALSE', 'UNRELATED', 'ETC')), -- 11/12 추가
  RVW_RPT_CN      TEXT    NOT NULL CHECK (length(RVW_RPT_CN) BETWEEN 1 AND 300),
  RVW_RPT_STTS    TEXT    NOT NULL DEFAULT 'PENDING' CHECK (RVW_RPT_STTS IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  PRCSR_MBR_ID    INTEGER REFERENCES TB_MBR (MBR_ID),                 -- 처리 관리자
  PRCS_DTTM       TEXT,
  PRCS_CN         TEXT    CHECK (PRCS_CN IS NULL OR length(PRCS_CN) <= 300), -- 처리 사유
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (RVW_ID, RPTR_MBR_ID),
  -- 처리된 신고는 처리자·처리일시·처리 사유가 있다 (X-07 note 필수)
  CHECK (RVW_RPT_STTS = 'PENDING'
         OR (PRCSR_MBR_ID IS NOT NULL AND PRCS_DTTM IS NOT NULL AND PRCS_CN IS NOT NULL))
) STRICT;

CREATE INDEX IX_RVW_RPT_STTS ON TB_RVW_RPT (RVW_RPT_STTS, REG_DTTM);

-- ---------------------------------------------------------------------
-- 23. TB_MBR_RSTR 회원제한 (리뷰 작성 제한 이력)
--   해제(X-10)는 RSTR_END_DTTM을 지금으로 기록. NULL이면 해제 전까지 제한.
-- ---------------------------------------------------------------------
CREATE TABLE TB_MBR_RSTR (
  MBR_RSTR_ID     INTEGER PRIMARY KEY AUTOINCREMENT,
  MBR_ID          INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),        -- 제한 대상 고객
  RVW_RPT_ID      INTEGER REFERENCES TB_RVW_RPT (RVW_RPT_ID),         -- 근거 신고
  RSTR_TYPE_CD    TEXT    NOT NULL CHECK (RSTR_TYPE_CD IN ('REVIEW_WRITE')),
  RSTR_STRT_DTTM  TEXT    NOT NULL,
  RSTR_END_DTTM   TEXT,
  RSTR_RSN_CN     TEXT    NOT NULL CHECK (length(RSTR_RSN_CN) BETWEEN 1 AND 300),
  PRCSR_MBR_ID    INTEGER NOT NULL REFERENCES TB_MBR (MBR_ID),
  REG_DTTM        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (RSTR_END_DTTM IS NULL OR RSTR_END_DTTM >= RSTR_STRT_DTTM)
) STRICT;

CREATE INDEX IX_MBR_RSTR_ACTIVE ON TB_MBR_RSTR (MBR_ID, RSTR_TYPE_CD, RSTR_END_DTTM);
