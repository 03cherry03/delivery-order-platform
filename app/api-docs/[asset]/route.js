// GET /api-docs/<파일> — swagger-ui-dist 패키지의 정적 파일 중 허용한 것만 내려준다.
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const ASSETS = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "text/javascript; charset=utf-8",
  "favicon-32x32.png": "image/png",
  "favicon-16x16.png": "image/png",
};
const DIST = path.join(process.cwd(), "node_modules", "swagger-ui-dist");

export async function GET(request, { params }) {
  const { asset } = await params;
  const type = ASSETS[asset];
  if (!type) return new Response("Not Found", { status: 404 });
  return new Response(await readFile(path.join(DIST, asset)), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
  });
}
