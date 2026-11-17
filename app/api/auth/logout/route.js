import { clearSessionCookie, requireRole } from "@/lib/server/auth";
import { handler, ok } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = handler(({ request }) => {
  requireRole(request);
  return ok(null, { headers: { "Set-Cookie": clearSessionCookie() } });
});
