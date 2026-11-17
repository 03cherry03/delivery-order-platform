// GET /api-docs/openapi.json — docs/api/openapi.json (생성물: npm run docs:openapi)
import spec from "@/docs/api/openapi.json";

export const runtime = "nodejs";

export function GET() {
  return Response.json(spec);
}
