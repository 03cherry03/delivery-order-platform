import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const sqlDir = process.env.DB_SQL_DIR ?? fileURLToPath(new URL("../db/", import.meta.url));
const db = new Database(":memory:");
const time = "2026-11-15 12:00:00";
const pickupTime = "2026-11-15 12:20:00";
const completionTime = "2026-11-15 12:35:00";

function insert(table, values) {
  const columns = Object.keys(values);
  return Number(db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .run(...Object.values(values)).lastInsertRowid);
}

function member(role = "CUSTOMER", balance = 10000) {
  return insert("TB_MBR", {
    MBR_EMAIL: `db-check-${randomUUID()}@example.test`,
    MBR_PWD: "fixture-only",
    MBR_NM: "검증 회원",
    MBR_TELNO: "010-0000-0000",
    MBR_ROLE_CD: role,
    PNT_BAL_AMT: balance,
  });
}

function rider(status = "BUSY") {
  const id = member("RIDER");
  insert("TB_RIDER", { MBR_ID: id, RIDER_STTS: status, VHCL_TYPE_CD: "BICYCLE" });
  return id;
}

function fixture() {
  const customer = member();
  const owner = member("OWNER");
  const admin = member("ADMIN");
  let bizNo;
  do {
    const digits = String(randomInt(10000000000)).padStart(10, "0");
    bizNo = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  } while (db.prepare("SELECT 1 FROM TB_STORE WHERE BIZ_NO = ?").get(bizNo));
  const store = insert("TB_STORE", {
    OWNR_MBR_ID: owner, STORE_NM: "검증 가게", STORE_CTGR_CD: "KOREAN",
    BIZ_NO: bizNo, STORE_TELNO: "02-000-0000", STORE_ADDR: "서울 동작구",
    STORE_LAT: 37.496, STORE_LNG: 126.957, MIN_ORD_AMT: 0, DLVR_TIP_AMT: 2000,
    COOK_EST_MI: 20, STORE_OPER_STTS: "OPEN", STORE_APRV_STTS: "APPROVED",
  });
  insert("TB_STORE_APRV", {
    STORE_ID: store, STORE_APRV_STTS: "APPROVED", PRCSR_MBR_ID: admin, PRCS_DTTM: time,
  });
  const category = insert("TB_MENU_CTGR", { STORE_ID: store, CTGR_NM: "메인", CTGR_SEQ: 1 });
  const menu = insert("TB_MENU", {
    STORE_ID: store, CTGR_ID: category, MENU_NM: "검증 메뉴", MENU_AMT: 10000, MENU_SEQ: 1,
  });
  const group = insert("TB_MENU_OPT_GRP", { MENU_ID: menu, OPT_GRP_NM: "추가", MAX_SLCT_CNT: 2, OPT_GRP_SEQ: 1 });
  const options = [1000, 300].map((amount, index) => insert("TB_MENU_OPT", {
    OPT_GRP_ID: group, OPT_NM: `추가 ${index + 1}`, OPT_AMT: amount, OPT_SEQ: index + 1,
  }));
  return { customer, owner, admin, store, menu, options };
}

function order(f, { state = "WAIT", method = "CARD", customer = f.customer, quantity = 2, completedAt = completionTime } = {}) {
  const accepted = state !== "WAIT";
  const total = quantity * (10000 + 1000 + 300) + 7500;
  const id = insert("TB_ORD", {
    MBR_ID: customer, STORE_ID: f.store, ORD_DTTM: time,
    ORD_STTS: state === "CANCEL" ? "COOKING" : state,
    ORD_TOT_AMT: total, DLVR_TIP_AMT: 2000, DLVR_ADDR: "서울 동작구",
    DLVR_LAT: 37.496, DLVR_LNG: 126.957,
    ORD_RCPT_DTTM: accepted ? time : null, COOK_EST_MI: accepted ? 20 : null,
  });
  const detail = insert("TB_ORD_DTL", {
    ORD_ID: id, ORD_DTL_SEQ: 1, MENU_ID: f.menu, ORD_MENU_NM: "검증 메뉴", ORD_QTY: quantity, ORD_UPRC: 10000,
  });
  f.options.forEach((option, index) => insert("TB_ORD_DTL_OPT", {
    ORD_DTL_ID: detail, OPT_ID: option, ORD_OPT_GRP_NM: "추가", ORD_OPT_NM: `추가 ${index + 1}`,
    ORD_OPT_AMT: [1000, 300][index],
  }));
  insert("TB_ORD_DTL", {
    ORD_ID: id, ORD_DTL_SEQ: 2, MENU_ID: f.menu, ORD_MENU_NM: "검증 메뉴 소", ORD_QTY: 1, ORD_UPRC: 7500,
  });
  insert("TB_PAY", {
    ORD_ID: id, PAY_MTHD_CD: method, PAY_AMT: total + 2000, PAY_STTS: "APPROVED", PAY_APRV_DTTM: time,
  });
  let riderId = null;
  if (accepted) {
    riderId = rider(state === "DONE" ? "IDLE" : "BUSY");
    insert("TB_DLVR", {
      ORD_ID: id, RIDER_MBR_ID: riderId, DSPCH_DTTM: time,
      PKUP_DTTM: ["DONE", "DELIVERING"].includes(state) ? pickupTime : null,
      DLVR_CMPL_DTTM: state === "DONE" ? completedAt : null,
    });
  }
  if (state === "CANCEL") cancel(id, "OWNER", "CANNOT_COOK");
  return { id, customer, riderId, total, paid: total + 2000 };
}

function cancel(id, actor = "CUSTOMER", reason = "CUSTOMER_REQUEST") {
  db.prepare(`UPDATE TB_ORD SET ORD_STTS = 'CANCEL', ORD_CNCL_DTTM = ?,
    CNCL_ACTR_CD = ?, CNCL_RSN_CD = ? WHERE ORD_ID = ?`).run(time, actor, reason, id);
}

function balance(id) {
  return db.prepare("SELECT PNT_BAL_AMT FROM TB_MBR WHERE MBR_ID = ?").get(id).PNT_BAL_AMT;
}

function assertCanceled(o) {
  const payment = db.prepare("SELECT PAY_STTS, PAY_CNCL_DTTM FROM TB_PAY WHERE ORD_ID = ?").get(o.id);
  assert.equal(payment.PAY_STTS, "CANCELED", "cancelled order payment must be CANCELED");
  assert.match(payment.PAY_CNCL_DTTM ?? "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "cancelled payment needs PAY_CNCL_DTTM");
}

function assertRefund(o, expectedBalance) {
  const rows = db.prepare("SELECT * FROM TB_PNT_TXN WHERE ORD_ID = ?").all(o.id);
  assert.equal(rows.length, 1, "POINT order must have exactly one refund");
  assert.equal(rows[0].PNT_TXN_TYPE_CD, "REFUND");
  assert.equal(rows[0].MBR_ID, o.customer);
  assert.equal(rows[0].PNT_TXN_AMT, o.paid, "refund amount must equal payment including delivery tip");
  assert.equal(rows[0].PNT_BAL_AMT, expectedBalance, "refund ledger must record the resulting balance");
}

function pointCancellation() {
  const f = fixture();
  const o = order(f, { method: "POINT" });
  const before = balance(f.customer);
  cancel(o.id);
  assertCanceled(o);
  assert.equal(balance(f.customer), before + o.paid, "POINT cancellation must return payment to member balance");
  assertRefund(o, before + o.paid);
}

function cardCancellation() {
  const f = fixture();
  const o = order(f);
  const before = balance(f.customer);
  cancel(o.id);
  assertCanceled(o);
  assert.equal(balance(f.customer), before, "CARD cancellation must not change point balance");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM TB_PNT_TXN WHERE ORD_ID = ?").get(o.id).n, 0, "CARD order must not have point transactions");
}

function riderCancellation() {
  const f = fixture();
  const o = order(f, { state: "COOKING" });
  const control = order(f, { state: "COOKING" });
  assert.equal(db.prepare("SELECT RIDER_STTS FROM TB_RIDER WHERE MBR_ID = ?").get(o.riderId).RIDER_STTS, "BUSY");
  assert.notEqual(o.riderId, control.riderId);
  cancel(o.id, "OWNER", "CANNOT_COOK");
  assert.equal(db.prepare("SELECT RIDER_STTS FROM TB_RIDER WHERE MBR_ID = ?").get(o.riderId).RIDER_STTS, "IDLE", "cancelled delivery rider must become IDLE");
  assert.equal(db.prepare("SELECT RIDER_STTS FROM TB_RIDER WHERE MBR_ID = ?").get(control.riderId).RIDER_STTS, "BUSY", "unrelated active delivery rider must remain BUSY");
}

function multiRowCancellation() {
  const f = fixture();
  const points = [order(f, { method: "POINT", quantity: 1 }), order(f, { method: "POINT", quantity: 3 })];
  const card = order(f);
  const before = balance(f.customer);
  const ids = [...points, card].map((o) => o.id);
  const changed = db.prepare(`UPDATE TB_ORD SET ORD_STTS = 'CANCEL', ORD_CNCL_DTTM = ?,
    CNCL_ACTR_CD = 'SYSTEM', CNCL_RSN_CD = 'NO_RESPONSE' WHERE ORD_ID IN (?, ?, ?)`)
    .run(time, ...ids).changes;
  assert.equal(changed, 3, "one statement must cancel all three WAIT orders");
  for (const o of [...points, card]) assertCanceled(o);
  assert.equal(balance(f.customer), before + points.reduce((sum, o) => sum + o.paid, 0));
  const ledger = db.prepare(`SELECT ORD_ID, PNT_BAL_AMT FROM TB_PNT_TXN
    WHERE ORD_ID IN (?, ?) ORDER BY PNT_TXN_ID`).all(...points.map((o) => o.id));
  assert.equal(ledger.length, 2, "multi-row cancellation must refund both POINT orders exactly once");
  let running = before;
  for (const row of ledger) {
    const o = points.find((point) => point.id === row.ORD_ID);
    assert.ok(o, "refund must belong to one of the cancelled POINT orders");
    running += o.paid;
    assertRefund(o, running);
    assert.equal(row.PNT_BAL_AMT, running, "same-member refunds must chain balances in ledger order");
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM TB_PNT_TXN WHERE ORD_ID = ?").get(card.id).n, 0, "multi-row CARD cancellation must not create a refund");
}

function modificationTimestamps() {
  const f = fixture();
  const o = order(f);
  for (const [table, key, id, column] of [
    ["TB_ORD", "ORD_ID", o.id, "STORE_RQST_CN"],
    ["TB_MBR", "MBR_ID", f.customer, "MBR_NM"],
  ]) {
    const get = () => db.prepare(`SELECT MOD_DTTM FROM ${table} WHERE ${key} = ?`).get(id).MOD_DTTM;
    db.prepare(`UPDATE ${table} SET MOD_DTTM = ? WHERE ${key} = ?`).run("2000-01-01 00:00:00", id);
    assert.equal(get(), "2000-01-01 00:00:00", `${table} must keep an explicitly set MOD_DTTM`);
    db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${key} = ?`).run("검증 변경", id);
    const modified = get();
    assert.notEqual(modified, "2000-01-01 00:00:00", `${table} plain update must refresh MOD_DTTM`);
    const delta = db.prepare("SELECT abs(unixepoch(?) - unixepoch(datetime('now', 'localtime'))) AS seconds").get(modified).seconds;
    assert.ok(delta !== null && delta <= 3, `${table} MOD_DTTM must be within three seconds of current localtime`);
    db.prepare(`UPDATE ${table} SET MOD_DTTM = ?, ${column} = ? WHERE ${key} = ?`)
      .run("2001-02-03 04:05:06", "검증 명시 변경", id);
    assert.equal(get(), "2001-02-03 04:05:06", `${table} must keep explicit MOD_DTTM alongside other changes`);
  }
}

function storeRatingView() {
  const f = fixture();
  for (const [rating, hidden, deleted] of [[5, "N", "N"], [4, "N", "N"], [1, "Y", "N"], [1, "N", "Y"]]) {
    const o = order(f, { state: "DONE" });
    insert("TB_RVW", { ORD_ID: o.id, RVW_RTNG: rating, RVW_HDN_YN: hidden, DEL_YN: deleted });
  }
  assert.deepEqual(db.prepare("SELECT AVG_RTNG, RVW_CNT FROM V_STORE_RATING WHERE STORE_ID = ?").get(f.store),
    { AVG_RTNG: 4.5, RVW_CNT: 2 }, "rating view must exclude hidden and deleted reviews");
  const empty = fixture();
  assert.deepEqual(db.prepare("SELECT AVG_RTNG, RVW_CNT FROM V_STORE_RATING WHERE STORE_ID = ?").get(empty.store),
    { AVG_RTNG: null, RVW_CNT: 0 }, "rating view must retain stores with zero reviews");
}

function doneOrderView() {
  const f = fixture();
  const done = [order(f, { state: "DONE", quantity: 1 }),
    order(f, { state: "DONE", quantity: 3, completedAt: "2026-11-16 00:05:00" })];
  order(f, { state: "CANCEL" });
  order(f, { state: "DELIVERING" });
  const rows = db.prepare("SELECT * FROM V_DONE_ORDER WHERE STORE_ID = ? ORDER BY ORD_ID").all(f.store);
  assert.deepEqual(rows.map((row) => row.ORD_ID), done.map((o) => o.id), "done-order view must contain only DONE orders");
  for (const row of rows) {
    assert.equal(row.SALES_DT, db.prepare("SELECT date(?) AS day").get(row.DLVR_CMPL_DTTM).day);
  }
  assert.deepEqual(rows.map((row) => row.SALES_DT), ["2026-11-15", "2026-11-16"]);
  const t01 = db.prepare("SELECT SUM(ORD_TOT_AMT) AS total FROM V_DONE_ORDER WHERE STORE_ID = ?").get(f.store).total;
  const t02 = db.prepare(`SELECT SUM(d.ORD_QTY * (d.ORD_UPRC + COALESCE(opts.amount, 0))) AS total
    FROM TB_ORD o JOIN TB_ORD_DTL d ON d.ORD_ID = o.ORD_ID
    LEFT JOIN (SELECT ORD_DTL_ID, SUM(ORD_OPT_AMT) AS amount FROM TB_ORD_DTL_OPT GROUP BY ORD_DTL_ID) opts
      ON opts.ORD_DTL_ID = d.ORD_DTL_ID
    WHERE o.STORE_ID = ? AND o.ORD_STTS = 'DONE'`).get(f.store).total;
  assert.equal(t01, t02, "T-01 sales total must equal T-02 quantity × (unit price + options), excluding tips");
  assert.equal(t01, done.reduce((sum, o) => sum + o.total, 0));
}

function constraintRejections() {
  const f = fixture();
  const riderId = rider("IDLE");
  assert.equal(db.prepare("SELECT VHCL_TYPE_CD FROM TB_RIDER WHERE MBR_ID = ?").get(riderId).VHCL_TYPE_CD, "BICYCLE");
  assert.throws(() => db.prepare("UPDATE TB_RIDER SET VHCL_TYPE_CD = 'OTHER' WHERE MBR_ID = ?").run(riderId),
    /CHECK constraint failed/, "rider vehicle OTHER must be rejected");
  const o = order(f);
  cancel(o.id);
  assert.equal(db.prepare("SELECT ORD_STTS FROM TB_ORD WHERE ORD_ID = ?").get(o.id).ORD_STTS, "CANCEL");
  assert.throws(() => db.prepare("UPDATE TB_ORD SET ORD_CNCL_DTTM = NULL WHERE ORD_ID = ?").run(o.id),
    /CHECK constraint failed/, "CANCEL order without cancellation datetime must be rejected");
  const address = {
    MBR_ID: f.customer, MBR_ADDR_NM: "집", MBR_ADDR: "서울 동작구", MBR_ZIP: "06978",
    MBR_LAT: 37.496, MBR_LNG: 126.957, DFLT_YN: "Y",
  };
  const first = insert("TB_MBR_ADDR", address);
  const second = insert("TB_MBR_ADDR", { ...address, MBR_ADDR_NM: "학교", DFLT_YN: "N" });
  assert.notEqual(first, second, "a non-default second address must be accepted");
  assert.throws(() => db.prepare("UPDATE TB_MBR_ADDR SET DFLT_YN = 'Y' WHERE MBR_ADDR_ID = ?").run(second),
    /UNIQUE constraint failed/, "second live default address for the same member must be rejected");
}

try {
  db.pragma("foreign_keys = ON");
  for (const file of ["schema.sql", "views.sql", "triggers.sql"]) {
    db.exec(readFileSync(path.join(sqlDir, file), "utf8"));
  }
  const seed = path.join(sqlDir, "seed.sql");
  if (existsSync(seed)) db.exec(readFileSync(seed, "utf8"));
  for (const scenario of [pointCancellation, cardCancellation, riderCancellation, multiRowCancellation,
    modificationTimestamps, storeRatingView, doneOrderView, constraintRejections]) {
    scenario();
    console.log(`ok - ${scenario.name}`);
  }
} finally {
  db.close();
}
