// /api-docs — Swagger UI. 개발·운영 모두 항상 연다. 외부 CDN 없이 swagger-ui-dist 패키지 파일을 이 서버가 내려준다.
// 명세: docs/api/openapi.json (docs/api/*.md 에서 npm run docs:openapi 로 생성, 손으로 고치지 않음)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Router } from "express";

const DIST = path.dirname(createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"));
const SPEC = path.join(import.meta.dirname, "..", "docs", "api", "openapi.json");
const ASSETS = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "text/javascript; charset=utf-8",
  "favicon-32x32.png": "image/png",
  "favicon-16x16.png": "image/png",
};

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

export const apiDocsRouter = Router();

apiDocsRouter.get("/api-docs", (req, res) => res.type("html").send(HTML));

// 명세는 요청마다 파일에서 읽는다(npm run docs:openapi 후 재시작 없이 반영)
apiDocsRouter.get("/api-docs/openapi.json", (req, res) => res.type("json").send(readFileSync(SPEC)));

apiDocsRouter.get("/api-docs/:asset", (req, res) => {
  const type = ASSETS[req.params.asset];
  if (!type) return res.status(404).type("text").send("Not Found");
  res.set({ "Content-Type": type, "Cache-Control": "public, max-age=3600" });
  res.send(readFileSync(path.join(DIST, req.params.asset)));
});
