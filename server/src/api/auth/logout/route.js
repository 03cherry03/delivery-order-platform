import { clearSessionCookie, requireRole } from "#lib/auth";
import { handler, ok } from "#lib/http";



export const POST = handler(({ request }) => {
  requireRole(request);
  return ok(null, { headers: { "Set-Cookie": clearSessionCookie() } });
});
