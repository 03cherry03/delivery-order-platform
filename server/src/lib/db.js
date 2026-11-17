import Database from "better-sqlite3";
import path from "node:path";

// server/delivery.db — 어느 폴더에서 실행해도 같은 파일 (scripts/init-db.mjs 와 같은 경로)
const dbPath = path.join(import.meta.dirname, "..", "..", "delivery.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

export default db;