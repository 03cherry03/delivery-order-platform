// DB 초기화: delivery.db 를 지우고 schema → views → triggers → seed 순서로 실행한다.
// 사용: npm run db:init  (seed 없이: npm run db:init -- --empty)
import Database from "better-sqlite3";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

const serverRoot = path.join(import.meta.dirname, "..");
const dbPath = path.join(serverRoot, "delivery.db"); // src/lib/db.js 와 같은 경로
const empty = process.argv.includes("--empty");
const files = ["schema.sql", "views.sql", "triggers.sql", ...(empty ? [] : ["seed.sql"])];

for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(dbPath + suffix, { force: true });

const db = new Database(dbPath);
try {
  db.pragma("foreign_keys = ON");
  for (const file of files) {
    db.exec(readFileSync(path.join(serverRoot, "db", file), "utf8"));
    console.log(`applied db/${file}`);
  }
  const violations = db.pragma("foreign_key_check");
  if (violations.length > 0) {
    console.error("foreign_key_check failed:", violations);
    process.exitCode = 1;
  }
  const counts = db
    .prepare("SELECT type, COUNT(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' GROUP BY type ORDER BY type")
    .all();
  console.log(`${dbPath}: ${counts.map((c) => `${c.n} ${c.type}`).join(", ")}`);
} finally {
  db.close();
}
