import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "delivery.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

export default db;