// 테이블 정의서(table-definition.md) 생성기. 컬럼마다 한글명·타입·NULL·기본값·키·CHECK·설명을 표로 만든다.
// 사용: node docs/erd/gen-dictionary.mjs [SQL 폴더] > docs/erd/table-definition.md  (Node 24, 내장 node:sqlite)
// 한글명은 컬럼명 약어를 아래 사전으로 풀어 붙인다. 어색한 이름은 NAME_OVERRIDE 에서 고친다.
// 설명은 schema.sql 의 컬럼 줄 끝 주석(-- …)이다.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "server/db";
const schema = readFileSync(path.join(dir, "schema.sql"), "utf8");
const db = new DatabaseSync(":memory:");
db.exec(schema);

const TABLE_NM = {
  TB_MBR: "회원", TB_MBR_ADDR: "회원주소", TB_RIDER: "라이더", TB_STORE: "가게", TB_STORE_HOURS: "가게영업시간",
  TB_STORE_APRV: "입점신청", TB_MENU_CTGR: "메뉴분류", TB_MENU: "메뉴", TB_MENU_OPT_GRP: "메뉴옵션그룹",
  TB_MENU_OPT: "메뉴옵션", TB_CART: "장바구니", TB_CART_DTL: "장바구니항목", TB_CART_DTL_OPT: "장바구니항목옵션",
  TB_ORD: "주문", TB_ORD_DTL: "주문상세", TB_ORD_DTL_OPT: "주문상세옵션", TB_PAY: "결제", TB_PNT_TXN: "포인트거래",
  TB_DLVR: "배달", TB_RVW: "리뷰", TB_RVW_REPLY: "리뷰답글", TB_RVW_RPT: "리뷰신고", TB_MBR_RSTR: "회원제한",
};
const WORD = {
  ACT: "활동", ACTR: "주체", ADDR: "주소", AMT: "금액", APLY: "신청", APRV: "승인", BAL: "잔액", BIZ: "사업자",
  CART: "장바구니", CD: "코드", CHRG: "충전", CLOSE: "종료", CMPL: "완료", CN: "내용", CNCL: "취소", CNSL: "상담",
  CNT: "수", COOK: "조리", CTGR: "분류", CUTLERY: "수저", DADDR: "상세주소", DAY: "요일", DEL: "삭제", DFLT: "기본",
  DLVR: "배달", DSPCH: "배차", DTL: "상세", DTTM: "일시", EMAIL: "이메일", END: "종료", EST: "예상", GRP: "그룹",
  HDN: "숨김", HOURS: "영업시간", ID: "ID", LAT: "위도", LNG: "경도", LOGIN: "로그인", M: "(m)", MAX: "최대",
  MBR: "회원", MEMO: "메모", MENU: "메뉴", MI: "(분)", MIN: "최소", MOD: "수정", MTHD: "수단", NM: "명", NO: "번호",
  OF: "", OPEN: "시작", OPER: "운영", OPT: "옵션", ORD: "주문", OWNR: "사장", PAY: "결제", PKUP: "픽업", PNT: "포인트",
  PRCS: "처리", PRCSR: "처리자", PWD: "비밀번호", QTY: "수량", RADIUS: "반경", RCPT: "접수", REF: "참조", REG: "등록",
  REPLY: "답글", RIDER: "라이더", RJCT: "반려", ROLE: "역할", RPT: "신고", RPTR: "신고자", RQRD: "필수", RQST: "요청",
  RSN: "사유", RSTR: "제한", RTNG: "평점", RVW: "리뷰", SALE: "판매", SEQ: "순서", SLCT: "선택", STORE: "가게",
  STRT: "시작", STTS: "상태", TELNO: "전화번호", TIP: "팁", TM: "시각", TOT: "합계", TXN: "거래", TYPE: "유형",
  UPRC: "단가", VHCL: "운송수단", WTHDR: "탈퇴", YN: "여부", ZIP: "우편번호",
};
const NAME_OVERRIDE = {
  MBR_NM: "회원이름", MBR_ADDR_NM: "주소별칭", MBR_ADDR: "도로명주소", MBR_DADDR: "상세주소", STORE_ADDR: "가게도로명주소",
  DLVR_ADDR: "배달도로명주소", DLVR_DADDR: "배달상세주소", STORE_CN: "가게소개", MENU_CN: "메뉴설명", ORD_UPRC: "주문단가",
  ORD_MENU_NM: "주문당시메뉴명", ORD_OPT_GRP_NM: "주문당시옵션그룹명", ORD_OPT_NM: "주문당시옵션명", ORD_OPT_AMT: "주문당시옵션금액",
  CNCL_PRCSR_MBR_ID: "취소처리관리자ID", PRCSR_MBR_ID: "처리관리자ID", OWNR_MBR_ID: "사장회원ID", RIDER_MBR_ID: "라이더회원ID",
  RPTR_MBR_ID: "신고자회원ID", DAY_OF_WEEK: "요일", COOK_EST_MI: "조리예상시간(분)", ACT_RADIUS_M: "활동반경(m)",
  PNT_BAL_AMT: "포인트잔액", RVW_HDN_YN: "숨김여부", RVW_RPT_CN: "신고내용", RVW_REPLY_CN: "답글내용",
  ORD_CNCL_RSN_CN: "취소사유상세", RJCT_RSN_CN: "반려사유", RSTR_RSN_CN: "제한사유", PRCS_CN: "처리내용", CNSL_MEMO_CN: "상담메모",
  CUTLERY_YN: "수저포크요청여부", STORE_RQST_CN: "가게요청사항", RIDER_RQST_CN: "라이더요청사항", BIZ_NO: "사업자등록번호",
  PAY_REF_NO: "결제참조번호", MBR_LOGIN_DTTM: "최근로그인일시",
};
const korName = (col) => NAME_OVERRIDE[col] ?? col.split("_").map((w) => WORD[w] ?? w).join("");
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");

// 괄호 안의 내용을 깊이를 세며 꺼낸다. s[i] 는 여는 괄호
const inParens = (s, i) => {
  for (let d = 0, j = i; j < s.length; j++) {
    if (s[j] === "(") d++;
    else if (s[j] === ")" && --d === 0) return s.slice(i + 1, j);
  }
  throw new Error(`괄호 짝 없음: ${s}`);
};

// schema.sql 의 테이블 본문을 최상위 쉼표로 정의 단위로 나눈다. 정의마다 앞 주석 줄과 줄 끝 주석을 함께 돌려준다
function parseBlock(table) {
  const m = schema.match(new RegExp(`CREATE TABLE ${table} \\(\\n([\\s\\S]*?)\\n\\) STRICT;`));
  const defs = [];
  let cur = { sql: "", comments: [], note: "" }, depth = 0, note = "";
  for (const raw of m[1].split("\n")) {
    const line = raw.trim();
    if (line.startsWith("--")) { note = line.slice(2).trim(); continue; }
    const at = line.indexOf("--");
    const body = at >= 0 ? line.slice(0, at).trim() : line;
    if (at >= 0) cur.comments.push(line.slice(at + 2).trim());
    if (!cur.sql) { cur.note = note; note = ""; }
    cur.sql += (cur.sql ? " " : "") + body;
    for (const ch of body) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
    if (depth === 0 && cur.sql.endsWith(",")) {
      cur.sql = cur.sql.slice(0, -1);
      defs.push(cur);
      cur = { sql: "", comments: [], note: "" };
    }
  }
  if (cur.sql) defs.push(cur);
  const cols = {}, tableChecks = [];
  for (const d of defs) {
    if (d.sql.startsWith("CHECK (")) tableChecks.push(d);
    else if (!d.sql.startsWith("UNIQUE (")) {
      const k = d.sql.indexOf("CHECK (");
      cols[d.sql.split(/\s+/)[0]] = { comment: [d.note, ...d.comments].filter(Boolean).join(" "), check: k >= 0 ? inParens(d.sql, k + 6).replace(/\s+/g, " ") : "" };
    }
  }
  return { cols, tableChecks };
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'TB_%' ORDER BY rowid").all().map((r) => r.name);
const out = [];
out.push("# 테이블 정의서", "");
out.push("물리 데이터 모델의 테이블 23개를 컬럼 단위로 정리한 표다. 설계 규칙, 제약조건 요약, 인덱스, DDL 전문은 `physical.md`에 있다.", "");
out.push("- 기준: `server/db/schema.sql`. 이 파일은 `gen-dictionary.mjs`가 만든다. 손으로 고치지 말고 생성기를 다시 실행한다.");
out.push("- 키: `PK` 기본 키, `FK → 테이블` 외래 키, `UK` UNIQUE(복합이면 함께 묶인 컬럼을 적음)");
out.push("- NULL: `N` = NOT NULL, `Y` = NULL 허용");
out.push("- 모든 테이블은 `STRICT`다. 일시 컬럼은 `TEXT 'YYYY-MM-DD HH:MM:SS'`, 금액은 원 단위 `INTEGER`다.", "");

let colTotal = 0;
tables.forEach((t, i) => {
  const info = db.prepare(`SELECT * FROM pragma_table_info('${t}')`).all();
  const fks = db.prepare(`SELECT * FROM pragma_foreign_key_list('${t}')`).all();
  const uniques = db.prepare(`SELECT name FROM pragma_index_list('${t}') WHERE "unique" = 1 AND origin = 'u'`).all()
    .map((r) => db.prepare(`SELECT name FROM pragma_index_info('${r.name}') ORDER BY seqno`).all().map((c) => c.name));
  const { cols, tableChecks } = parseBlock(t);
  out.push(`## ${i + 1}. ${t} (${TABLE_NM[t]})`, "");
  out.push("| No | 컬럼 | 한글명 | 타입 | NULL | 기본값 | 키 | CHECK | 설명 |", "|---|---|---|---|---|---|---|---|---|");
  info.forEach((c, j) => {
    const keys = [];
    if (c.pk) keys.push("PK");
    for (const f of fks.filter((f) => f.from === c.name)) keys.push(`FK → ${f.table}${f.on_delete !== "NO ACTION" ? ` (${f.on_delete})` : ""}`);
    for (const u of uniques.filter((u) => u.includes(c.name))) keys.push(u.length === 1 ? "UK" : `UK (${u.join(", ")})`);
    const p = cols[c.name] ?? {};
    out.push(`| ${j + 1} | \`${c.name}\` | ${korName(c.name)} | ${c.type} | ${c.notnull || c.pk ? "N" : "Y"} | ${cell(c.dflt_value)} | ${keys.join("<br>")} | ${p.check ? `\`${cell(p.check)}\`` : ""} | ${cell(p.comment)} |`);
  });
  colTotal += info.length;
  if (tableChecks.length) {
    out.push("", "테이블 CHECK:", "");
    let last = null;
    for (const c of tableChecks) {
      const n = c.note || last; // 주석 한 줄 아래 CHECK 여러 개는 같은 묶음
      if (n && n !== last) out.push(`- ${n}`);
      last = n;
      out.push(`${n ? "  " : ""}- \`${c.sql}\``);
    }
  }
  const idx = db.prepare(`SELECT name, partial FROM pragma_index_list('${t}') WHERE origin = 'c'`).all();
  if (idx.length) {
    out.push("", "인덱스:", "");
    for (const ix of idx) {
      const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(ix.name).sql;
      out.push(`- \`${sql.replace(/^CREATE (UNIQUE )?INDEX /, "")}\`${ix.partial ? " (조건부 UNIQUE)" : ""}`);
    }
  }
  out.push("");
});
process.stdout.write(out.join("\n"));
console.error(JSON.stringify({ tables: tables.length, columns: colTotal }));
