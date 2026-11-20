import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roleOfPath, safeNext } from './session.js';

for (const path of ['/owner/stores', '/owner/stores?tab=all#top']) {
  test(`safeNext allows ${path} for OWNER`, () => {
    assert.equal(safeNext(path, 'OWNER'), path);
  });
}

for (const path of [
  '/rider/history',
  '//evil.com',
  '/owner/\\stores',
  'https://evil.com/owner',
  '/owner/login',
  '/owner/login?x',
  '/owner/login#y',
  '/owner/signup',
  '/owner/signup?x',
  '/owner/signup#y',
]) {
  test(`safeNext rejects ${path} for OWNER`, () => {
    assert.equal(safeNext(path, 'OWNER'), null);
  });
}

for (const [path, role] of [
  ['/rider', 'RIDER'],
  ['/rider/history', 'RIDER'],
  ['/rider?x=1', 'RIDER'],
  ['/riderx', null],
  [42, null],
]) {
  test(`roleOfPath(${JSON.stringify(path)}) returns ${role}`, () => {
    assert.equal(roleOfPath(path), role);
  });
}
