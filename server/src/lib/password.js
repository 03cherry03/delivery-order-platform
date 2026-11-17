import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// 저장 형식: scrypt$<salt hex>$<hash hex> (Node 기본 scrypt 파라미터, 64바이트 키)
const KEY_LEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === KEY_LEN && timingSafeEqual(actual, expected);
}
