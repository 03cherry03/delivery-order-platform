// DB 초기화: delivery.db를 지우고 db/schema.sql → db/seed.sql 순서로 실행한다.
//   npm run db:init            스키마 + 샘플 데이터
//   npm run db:init -- --empty 스키마만 (빈 테이블)
// 주의: 기존 delivery.db의 데이터는 모두 사라진다. 개발 서버(npm run dev)를 끄고 실행할 것.
import Database from "better-sqlite3";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dbPath = path.join(root, "delivery.db"); // lib/db.js와 같은 위치
const withSeed = !process.argv.includes("--empty");

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  rmSync(dbPath + suffix, { force: true });
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
console.log("스키마 생성 완료");

if (withSeed) {
  db.exec(readFileSync(path.join(root, "db", "seed.sql"), "utf8"));
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'TB_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  for (const t of tables) {
    const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get();
    console.log(`  ${t.padEnd(16)} ${n}`);
  }
  console.log("샘플 데이터 입력 완료 (모든 계정 비밀번호: test1234)");
}

const fkErrors = db.pragma("foreign_key_check");
if (fkErrors.length) {
  console.error("FK 오류:", fkErrors);
  process.exitCode = 1;
}
db.close();
