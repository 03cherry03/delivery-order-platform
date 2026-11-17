import db from "#lib/db";
import { requireRole } from "#lib/auth";
import { handler, pathId, readJson } from "#lib/http";
import { saveStoreApplication, storeInput } from "#lib/members";



export const PUT = handler(async ({ request, params }) => {
  const owner = requireRole(request, "OWNER");
  const storeId = pathId(params.storeId, "storeId");
  const data = storeInput(await readJson(request));
  return db.transaction(() => saveStoreApplication(owner.MBR_ID, data, storeId)).immediate();
});
