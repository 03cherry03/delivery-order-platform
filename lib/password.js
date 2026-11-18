// 비밀번호 해시·검증 (Node 내장 crypto.scrypt, 추가 패키지 없음)
// 저장 형식: scrypt$<salt 16바이트 hex>$<해시 64바이트 hex>
// db/seed.sql의 샘플 계정(비밀번호 test1234)도 이 형식으로 만들었다.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false; // 탈퇴 회원은 MBR_PWD가 NULL
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(plain, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
