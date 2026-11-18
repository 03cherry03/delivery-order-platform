// route 공통: 응답 형식, 오류 변환, JSON 파싱, 작은 입력 검사 helper
// 성공 { success: true, data }, 실패 { success: false, error: { code, message, fields? } }

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function fail(status, code, message, fields) {
  throw new HttpError(status, code, message, fields);
}

export const invalid = (field, reason) => fail(400, "VALIDATION_ERROR", "입력값을 확인해 주세요.", { [field]: reason });
export const notFound = (message = "대상을 찾을 수 없습니다.") => fail(404, "NOT_FOUND", message);
export const forbidden = (message = "권한이 없습니다.") => fail(403, "FORBIDDEN", message);

// 성공 응답. 상태 코드나 헤더(Set-Cookie)가 필요할 때 route가 직접 반환한다
export function ok(data, { status = 200, headers } = {}) {
  return Response.json({ success: true, data: data ?? null }, { status, headers });
}
export const created = (data, options = {}) => ok(data, { ...options, status: 201 });

function errorResponse(status, code, message, fields) {
  const error = fields ? { code, message, fields } : { code, message };
  return Response.json({ success: false, error }, { status });
}

// route 함수 감싸기: fn({ request, params, query }) 의 반환값이 Response면 그대로, 아니면 200 { data }
export function handler(fn) {
  return async (request, context) => {
    try {
      const params = context?.params ? await context.params : {};
      const query = new URL(request.url).searchParams;
      const result = await fn({ request, params, query });
      return result instanceof Response ? result : ok(result);
    } catch (e) {
      if (e instanceof HttpError) return errorResponse(e.status, e.code, e.message, e.fields);
      // 서버 검사를 빠져나간 제약 위반: DB가 마지막 방어선
      if (e?.code === "SQLITE_CONSTRAINT_UNIQUE") return errorResponse(409, "CONFLICT", "이미 존재하는 데이터입니다.");
      if (typeof e?.code === "string" && e.code.startsWith("SQLITE_CONSTRAINT")) {
        return errorResponse(400, "VALIDATION_ERROR", "입력값이 데이터 규칙에 맞지 않습니다.");
      }
      console.error(e);
      return errorResponse(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  };
}

export async function readJson(request) {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // 아래에서 400
  }
  return fail(400, "VALIDATION_ERROR", "요청 본문은 JSON 객체여야 합니다.");
}

// ---- 입력 검사: 값이 없고 required가 아니면 undefined 반환 ----
const missing = (v) => v === undefined || v === null || v === "";

export function str(value, field, { required = true, max, min = 1, pattern, message } = {}) {
  if (missing(value)) return required ? invalid(field, "필수 값입니다.") : undefined;
  if (typeof value !== "string") return invalid(field, "문자열이어야 합니다.");
  const s = value.trim();
  if (s.length < min) return invalid(field, required ? "필수 값입니다." : `${min}자 이상이어야 합니다.`);
  if (max && s.length > max) return invalid(field, `최대 ${max}자입니다.`);
  if (pattern && !pattern.test(s)) return invalid(field, message ?? "형식이 올바르지 않습니다.");
  return s;
}

export function int(value, field, { required = true, min, max } = {}) {
  if (missing(value)) return required ? invalid(field, "필수 값입니다.") : undefined;
  const n = typeof value === "string" && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
  if (!Number.isSafeInteger(n)) return invalid(field, "정수여야 합니다.");
  if (min !== undefined && n < min) return invalid(field, `${min} 이상이어야 합니다.`);
  if (max !== undefined && n > max) return invalid(field, `${max} 이하여야 합니다.`);
  return n;
}

export function num(value, field, { required = true, min, max } = {}) {
  if (missing(value)) return required ? invalid(field, "필수 값입니다.") : undefined;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return invalid(field, "숫자여야 합니다.");
  if ((min !== undefined && n < min) || (max !== undefined && n > max)) return invalid(field, `${min}~${max} 범위여야 합니다.`);
  return n;
}

export function bool(value, field, { required = true } = {}) {
  if (missing(value)) return required ? invalid(field, "필수 값입니다.") : undefined;
  if (typeof value !== "boolean") return invalid(field, "true 또는 false여야 합니다.");
  return value;
}

export function oneOf(value, field, allowed, { required = true } = {}) {
  if (missing(value)) return required ? invalid(field, "필수 값입니다.") : undefined;
  if (!allowed.includes(value)) return invalid(field, `${allowed.join(", ")} 중 하나여야 합니다.`);
  return value;
}

export function intArray(value, field, { required = true, min = 1 } = {}) {
  if (missing(value)) return required ? invalid(field, "필수 값입니다.") : undefined;
  if (!Array.isArray(value)) return invalid(field, "배열이어야 합니다.");
  return value.map((v, i) => int(v, `${field}[${i}]`, { min }));
}

// 경로의 {id} 값
export const pathId = (value, field) => int(value, field, { min: 1 });

export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TEL = /^010-\d{4}-\d{4}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 페이지 목록: page 1부터, size 기본 20 최대 100
export function pageOf(query) {
  const page = int(query.get("page"), "page", { required: false, min: 1 }) ?? 1;
  const size = int(query.get("size"), "size", { required: false, min: 1, max: 100 }) ?? 20;
  return { page, size, offset: (page - 1) * size };
}
export const paged = ({ page, size }, items, totalCount) => ({ items, page, size, totalCount });
