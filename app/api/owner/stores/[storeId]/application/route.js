import db from "@/lib/db";
import { requireRole } from "@/lib/server/auth";
import { handler, pathId, readJson } from "@/lib/server/http";
import { saveStoreApplication, storeInput } from "@/lib/server/members";

export const runtime = "nodejs";

export const PUT = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const data = storeInput(await readJson(request));
  return db.transaction(() => saveStoreApplication(owner.MBR_ID, data, storeId)).immediate();
});
