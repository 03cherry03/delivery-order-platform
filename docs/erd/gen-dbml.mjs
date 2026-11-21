// 물리 ERD(physical.dbml) 생성기. dbdiagram.com 에 붙여 넣는 DBML 을 만든다.
// 사용: node docs/erd/gen-dbml.mjs [SQL 폴더] > docs/erd/physical.dbml
//   SQL 폴더 기본값: server/db (schema.sql, views.sql, triggers.sql)
// server/delivery.db 는 건드리지 않는다. 메모리 DB 에 SQL 3개만 적용해 PRAGMA 로 구조를 읽는다.
// CHECK 와 주석은 PRAGMA 로 읽을 수 없어서 sqlite_master 에 남은 CREATE 문 원문에서 꺼낸다.
// 조건부(WHERE) UNIQUE 인덱스는 DBML 로 조건을 표현할 수 없으므로 unique 를 붙이지 않고 원문 SQL 을 note 로 남긴다.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const sqlDir = path.resolve(process.argv[2] ?? path.join(root, "server", "db"));
const Database = createRequire(path.join(root, "server", "package.json"))("better-sqlite3");

const db = new Database(":memory:");
for (const f of ["schema.sql", "views.sql", "triggers.sql"]) db.exec(readFileSync(path.join(sqlDir, f), "utf8"));
const schemaText = readFileSync(path.join(sqlDir, "schema.sql"), "utf8");

// 업무 영역별 묶음. 모든 테이블이 정확히 한 묶음에 들어가야 한다 (아래에서 검사).
const GROUPS = [
  ["회원", "#3498DB", ["TB_MBR", "TB_MBR_ADDR", "TB_RIDER"]],
  ["가게_메뉴", "#24BAB1", ["TB_STORE", "TB_STORE_HOURS", "TB_STORE_APRV", "TB_MENU_CTGR", "TB_MENU", "TB_MENU_OPT_GRP", "TB_MENU_OPT"]],
  ["장바구니", "#8E44AD", ["TB_CART", "TB_CART_DTL", "TB_CART_DTL_OPT"]],
  ["주문_결제", "#E67E22", ["TB_ORD", "TB_ORD_DTL", "TB_ORD_DTL_OPT", "TB_PAY", "TB_PNT_TXN"]],
  ["배달", "#2C3E50", ["TB_DLVR"]],
  ["리뷰_신고", "#C0392B", ["TB_RVW", "TB_RVW_REPLY", "TB_RVW_RPT", "TB_MBR_RSTR"]],
];

const q = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`; // DBML 한 줄 문자열
const qq = (s) => `'''\n${s.replace(/'''/g, "\\'''")}\n'''`; // DBML 여러 줄 문자열
const objects = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid").all();
const tables = objects.filter((o) => o.type === "table" && o.name !== "sqlite_sequence");
const views = objects.filter((o) => o.type === "view");
const triggers = objects.filter((o) => o.type === "trigger");
const indexSql = new Map(objects.filter((o) => o.type === "index").map((o) => [o.name, o.sql]));

// 괄호 짝을 맞춰 최상위 쉼표로 나눈다 (문자열 안의 괄호·쉼표는 무시)
function splitTop(s) {
  const out = [];
  let depth = 0, inStr = false, cur = "";
  for (const ch of s) {
    if (ch === "'") inStr = !inStr;
    if (!inStr && ch === "(") depth++;
    if (!inStr && ch === ")") depth--;
    if (!inStr && depth === 0 && ch === ",") { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// 문자열 밖의 -- 주석을 떼어 낸다. [코드, 주석]
function cutComment(line) {
  let inStr = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === "'") inStr = !inStr;
    if (!inStr && line[i] === "-" && line[i + 1] === "-") return [line.slice(0, i), line.slice(i + 2).trim()];
  }
  return [line, ""];
}
// "CHECK (" 뒤 괄호 안 식을 모두 꺼낸다
function checksIn(s) {
  const out = [];
  const re = /\bCHECK\s*\(/gi;
  while (re.exec(s)) {
    let depth = 1, i = re.lastIndex, inStr = false;
    for (; i < s.length && depth; i++) {
      if (s[i] === "'") inStr = !inStr;
      else if (!inStr && s[i] === "(") depth++;
      else if (!inStr && s[i] === ")") depth--;
    }
    out.push(s.slice(re.lastIndex, i - 1).replace(/\s+/g, " ").trim());
    re.lastIndex = i;
  }
  return out;
}
// CREATE TABLE 바로 위의 "-- n 이름" 줄
function tableTitle(name) {
  const lines = schemaText.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^CREATE TABLE ${name} \\(`).test(l));
  const prev = at > 0 ? lines[at - 1] : "";
  return prev.startsWith("--") ? prev.replace(/^--\s*/, "") : "";
}

function parseTable(sql) {
  const colComment = {};
  const tableComments = [];
  const codeLines = [];
  for (const raw of sql.split("\n")) {
    const [code, comment] = cutComment(raw);
    codeLines.push(code);
    if (!comment) continue;
    const first = code.trim().split(/\s+/)[0];
    if (first && /^[A-Z_][A-Z0-9_]*$/.test(first) && !["CHECK", "UNIQUE"].includes(first)) colComment[first] = comment;
    else if (!code.trim()) tableComments.push(comment);
  }
  const code = codeLines.join("\n");
  const body = code.slice(code.indexOf("(") + 1, code.lastIndexOf(")"));
  const colChecks = {}, tableChecks = [], autoInc = new Set();
  for (const item of splitTop(body)) {
    const head = item.split(/\s+/)[0].toUpperCase();
    if (head === "CHECK") tableChecks.push(...checksIn(item));
    else if (head === "UNIQUE" || head === "PRIMARY" || head === "FOREIGN") continue;
    else {
      colChecks[head] = checksIn(item);
      if (/AUTOINCREMENT/i.test(item)) autoInc.add(head);
    }
  }
  return { colComment, tableComments, colChecks, tableChecks, autoInc };
}

function dflt(v) {
  if (v === null) return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  if (/^'.*'$/.test(v)) return v;
  return "`" + v.replace(/^\((.*)\)$/s, "$1") + "`";
}

const stats = { tables: 0, fks: 0, indexes: 0, partialUnique: 0, checks: 0, views: views.length, triggers: triggers.length };
const out = [];
const refs = [];
out.push(`// 배달 주문 플랫폼 물리 ERD (SQLite). docs/erd/gen-dbml.mjs 로 생성. 직접 고치지 말고 SQL 을 고친 뒤 다시 생성한다.`);
out.push(`Project delivery_order_platform {\n  database_type: 'SQLite'\n  Note: ${qq("배달 주문 플랫폼 물리 데이터 모델.\n원본: server/db/schema.sql, views.sql, triggers.sql\n테이블은 STRICT, 일시는 TEXT 'YYYY-MM-DD HH:MM:SS', 금액은 원 단위 INTEGER.\nVIEW 는 VIEW 묶음의 가상 테이블로, 트리거는 테이블 note 와 메모로 표시한다.")}\n}\n`);

for (const t of tables) {
  stats.tables++;
  const p = parseTable(t.sql);
  const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
  const idxList = db.prepare(`PRAGMA index_list(${t.name})`).all();
  const singleUnique = new Set();
  const idxLines = [];
  for (const ix of idxList) {
    if (ix.origin === "pk") continue;
    const ixCols = db.prepare(`PRAGMA index_info(${ix.name})`).all().map((c) => c.name);
    const target = ixCols.length === 1 ? ixCols[0] : `(${ixCols.join(", ")})`;
    if (ix.origin === "u") {
      if (ixCols.length === 1) singleUnique.add(ixCols[0]);
      else idxLines.push(`    ${target} [unique, note: ${q("UNIQUE 제약")}]`);
      continue;
    }
    stats.indexes++;
    const sql = indexSql.get(ix.name);
    if (ix.partial) {
      if (ix.unique) stats.partialUnique++;
      const why = ix.unique ? "조건부 UNIQUE: WHERE 조건을 만족하는 행 사이에서만 유일" : "조건부 인덱스";
      idxLines.push(`    ${target} [name: ${q(ix.name)}, note: ${q(`${why}. ${sql}`)}]`);
    } else {
      idxLines.push(`    ${target} [name: ${q(ix.name)}${ix.unique ? ", unique" : ""}]`);
    }
  }
  // 카디널리티 (dbdiagram 검사 규칙에 맞춤). FK 가 UNIQUE·단일 PK 면 1:1, 아니면 다대일.
  // 다대일: `자식.FK > 부모` (NULL 허용이면 >?, 오른쪽 ? = 왼쪽 FK 가 NULL 허용).
  // 1:1: DBML 은 `-` 의 두 번째 컬럼을 FK 로 보므로 `부모 - 자식.FK` 순서로 쓴다.
  // 조건부 UNIQUE 는 일부 행에만 적용되므로 1:1 로 보지 않는다.
  const pkCols = cols.filter((c) => c.pk);
  const oneToOne = new Set([...singleUnique, ...(pkCols.length === 1 ? [pkCols[0].name] : [])]);
  for (const fk of db.prepare(`PRAGMA foreign_key_list(${t.name})`).all()) {
    stats.fks++;
    const col = cols.find((c) => c.name === fk.from);
    const nullable = !col.notnull && !col.pk; // INTEGER PRIMARY KEY 는 notnull=0 으로 나오지만 NULL 이 될 수 없다
    const del = fk.on_delete && fk.on_delete !== "NO ACTION" ? ` [delete: ${fk.on_delete.toLowerCase()}]` : "";
    if (!oneToOne.has(fk.from)) refs.push(`Ref: ${t.name}.${fk.from} >${nullable ? "?" : ""} ${fk.table}.${fk.to}${del}`);
    else if (nullable) throw new Error(`NULL 허용 1:1 FK 표기는 검증하지 않았다: ${t.name}.${fk.from}`);
    else refs.push(`Ref: ${fk.table}.${fk.to} - ${t.name}.${fk.from}${del}`);
  }
  const trg = triggers.filter((tr) => tr.tbl_name === t.name).map((tr) => tr.name);
  const noteParts = [tableTitle(t.name), ...p.tableComments];
  if (trg.length) noteParts.push(`트리거: ${trg.join(", ")}`);
  out.push(`Table ${t.name} {`);
  for (const c of cols) {
    const s = [];
    if (c.pk) s.push("pk");
    if (p.autoInc.has(c.name)) s.push("increment");
    if (c.notnull && !c.pk) s.push("not null");
    if (singleUnique.has(c.name)) s.push("unique");
    const d = dflt(c.dflt_value);
    if (d !== null) s.push(`default: ${d}`);
    for (const ck of p.colChecks[c.name] ?? []) { s.push(`check: \`${ck}\``); stats.checks++; }
    if (p.colComment[c.name]) s.push(`note: ${q(p.colComment[c.name])}`);
    out.push(`  ${c.name} ${c.type}${s.length ? ` [${s.join(", ")}]` : ""}`);
  }
  if (p.tableChecks.length) {
    out.push("  checks {");
    for (const ck of p.tableChecks) { out.push(`    \`${ck}\``); stats.checks++; }
    out.push("  }");
  }
  if (idxLines.length) out.push("  indexes {", ...idxLines, "  }");
  out.push(`  Note: ${q(noteParts.filter(Boolean).join(" / "))}`);
  out.push("}\n");
}

// VIEW: 가상 테이블. 원본 테이블과는 FK 가 아니므로 선을 긋지 않고 note 에 원본과 정의를 적는다.
for (const v of views) {
  const cols = db.prepare(`PRAGMA table_info(${v.name})`).all();
  const bases = [...new Set([...v.sql.matchAll(/\b(?:FROM|JOIN)\s+(TB_[A-Z_]+)/g)].map((m) => m[1]))];
  out.push(`Table ${v.name} [headercolor: #7F8C8D] {`);
  for (const c of cols) out.push(`  ${c.name} ${c.type || "expr"}`);
  out.push(`  Note: ${qq(`VIEW (가상 테이블, 저장하지 않음)\n원본: ${bases.join(", ")}\n\n${v.sql}`)}`);
  out.push("}\n");
}

out.push(...refs, "");

const grouped = new Set();
for (const [name, color, members] of GROUPS) {
  for (const m of members) {
    if (!tables.some((t) => t.name === m)) throw new Error(`GROUPS 에 없는 테이블: ${m}`);
    grouped.add(m);
  }
  out.push(`TableGroup ${name} [color: ${color}] {`, ...members.map((m) => `  ${m}`), "}\n");
}
const missing = tables.map((t) => t.name).filter((n) => !grouped.has(n));
if (missing.length) throw new Error(`묶음에 없는 테이블: ${missing.join(", ")}`);
out.push(`TableGroup VIEW [color: #7F8C8D, note: 'VIEW (가상 테이블)'] {`, ...views.map((v) => `  ${v.name}`), "}\n");

// 트리거 메모
const modTrg = triggers.filter((t) => /_MOD_DTTM$/.test(t.name));
const bizTrg = triggers.filter((t) => !/_MOD_DTTM$/.test(t.name));
out.push(`Note triggers_business {\n  ${qq(`업무 트리거 ${bizTrg.length}개\n\n${bizTrg.map((t) => t.sql).join("\n\n")}`)}\n}\n`);
out.push(`Note triggers_mod_dttm {\n  ${qq(`수정 시각 트리거 ${modTrg.length}개 (AFTER UPDATE, MOD_DTTM 을 직접 바꾸지 않았으면 현재 시각 기록)\n${modTrg.map((t) => `${t.name} ON ${t.tbl_name}`).join("\n")}`)}\n}`);

process.stdout.write(out.join("\n") + "\n");
console.error(JSON.stringify(stats));
