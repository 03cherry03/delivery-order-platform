// CORS 공통 미들웨어 (화면 서버 :3000 → API 서버 :4000).
// 허용 origin 은 CORS_ORIGINS 환경변수(쉼표 구분), 기본 http://localhost:3000. "*" 는 쿠키 인증과 함께 쓸 수 없어 금지.
// 허용된 origin 에만 Allow-Origin(그 origin 그대로)·Allow-Credentials 를 준다. OPTIONS preflight 는 라우트까지 가지 않고 204.

const ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()).filter(Boolean);
if (ORIGINS.includes("*")) throw new Error("CORS_ORIGINS 에 * 를 쓸 수 없습니다. 화면 서버 주소를 적으세요.");

const METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const HEADERS = "Content-Type";

export function cors(req, res, next) {
  const origin = req.get("origin");
  const allowed = origin !== undefined && ORIGINS.includes(origin);
  res.vary("Origin");
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    if (allowed) {
      res.setHeader("Access-Control-Allow-Methods", METHODS);
      res.setHeader("Access-Control-Allow-Headers", HEADERS);
    }
    return res.status(204).end();
  }
  next();
}
