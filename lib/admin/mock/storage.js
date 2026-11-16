// Browser-only demo persistence, not a SQLite database or production transaction.
// Independent key keeps this feature usable from main without any owner files.
import { createSeed } from './seed';

export const ADMIN_DEMO_STORAGE_KEY = 'delivery-admin-main-demo-v1';
let memoryDatabase = null;

function valid(value) {
  return value && Array.isArray(value.users) && Array.isArray(value.stores)
    && Array.isArray(value.orders) && Array.isArray(value.reviews)
    && Array.isArray(value.reports) && value.seq && value.hours;
}

function load() {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(ADMIN_DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (valid(parsed)) memoryDatabase = parsed;
      }
    } catch { /* In restricted browsers, keep the in-memory demo available. */ }
  }
  if (!memoryDatabase) memoryDatabase = createSeed();
  return memoryDatabase;
}

function save() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ADMIN_DEMO_STORAGE_KEY, JSON.stringify(memoryDatabase)); }
  catch { /* Storage disabled or full: changes last until page refresh. */ }
}

export function withAdminMockDatabase(handler) {
  load();
  const before = structuredClone(memoryDatabase);
  try {
    const result = handler(memoryDatabase);
    save();
    return result;
  } catch (error) {
    memoryDatabase = before;
    save();
    throw error;
  }
}

export function resetMockDatabase() {
  memoryDatabase = createSeed();
  save();
}
