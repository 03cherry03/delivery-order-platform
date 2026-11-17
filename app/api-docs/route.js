// GET /api-docs — Swagger UI. 정적 파일은 npm 패키지 swagger-ui-dist 에서 같은 주소로 내려준다(외부 CDN 없음).
// 명세는 /api-docs/openapi.json (docs/api/*.md 에서 npm run docs:openapi 로 생성). 개발·운영 모두 항상 연다.
export const runtime = "nodejs";

const HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>배달 주문 플랫폼 API 문서</title>
  <link rel="stylesheet" href="/api-docs/swagger-ui.css">
  <link rel="icon" type="image/png" href="/api-docs/favicon-32x32.png">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api-docs/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout",
      deepLinking: true,
      validatorUrl: null,
      withCredentials: true
    });
  </script>
</body>
</html>
`;

export function GET() {
  return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
