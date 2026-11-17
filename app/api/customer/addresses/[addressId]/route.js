import db from "@/lib/db";
import { handler, readJson, str, num, pathId, invalid } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { customerAddress } from "@/lib/server/customer-stores";

export const runtime = "nodejs";

export const PATCH = handler(async ({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const id = pathId(params.addressId, "addressId");
  const body = await readJson(request);
  const updates = [];
  const values = [];
  const fields = { addressName: ["MBR_ADDR_NM", 30], address: ["MBR_ADDR", 200], zipCode: ["MBR_ZIP", 5] };
  for (const [field, [column, max]] of Object.entries(fields)) {
    if (body[field] === undefined) continue;
    values.push(str(body[field], field, { max, ...(field === "zipCode" ? { pattern: /^\d{5}$/ } : {}) }));
    updates.push(`${column} = ?`);
  }
  if (body.addressDetail !== undefined) {
    values.push(body.addressDetail === "" ? "" : str(body.addressDetail, "addressDetail", { min: 0, max: 100 }));
    updates.push("MBR_DADDR = ?");
  }
  if (body.address !== undefined && (body.lat === undefined || body.lng === undefined)) invalid("lat", "주소 변경 시 lat, lng가 모두 필요합니다.");
  for (const [field, column, min, max] of [["lat", "MBR_LAT", -90, 90], ["lng", "MBR_LNG", -180, 180]]) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "number") invalid(field, "숫자여야 합니다.");
    values.push(num(body[field], field, { min, max }));
    updates.push(`${column} = ?`);
  }
  if (!updates.length) invalid("body", "수정할 필드가 필요합니다.");
  return db.transaction(() => {
    customerAddress(me.MBR_ID, id);
    db.prepare(`UPDATE TB_MBR_ADDR SET ${updates.join(", ")} WHERE MBR_ADDR_ID = ?`).run(...values, id);
    return db.prepare("SELECT MBR_ADDR_ID AS addressId, MBR_ADDR_NM AS addressName, MBR_DADDR AS addressDetail FROM TB_MBR_ADDR WHERE MBR_ADDR_ID = ?").get(id);
  })();
});

export const DELETE = handler(({ request, params }) => {
  const me = requireRole(request, "CUSTOMER");
  const id = pathId(params.addressId, "addressId");
  return db.transaction(() => {
    const address = customerAddress(me.MBR_ID, id);
    db.prepare("UPDATE TB_MBR_ADDR SET DEL_YN = 'Y', DFLT_YN = 'N' WHERE MBR_ADDR_ID = ?").run(id);
    if (address.DFLT_YN === "Y") {
      const replacement = db.prepare("SELECT MBR_ADDR_ID FROM TB_MBR_ADDR WHERE MBR_ID = ? AND DEL_YN = 'N' ORDER BY REG_DTTM DESC, MBR_ADDR_ID DESC LIMIT 1").get(me.MBR_ID);
      if (replacement) db.prepare("UPDATE TB_MBR_ADDR SET DFLT_YN = 'Y' WHERE MBR_ADDR_ID = ?").run(replacement.MBR_ADDR_ID);
    }
    const current = db.prepare("SELECT MBR_ADDR_ID FROM TB_MBR_ADDR WHERE MBR_ID = ? AND DEL_YN = 'N' AND DFLT_YN = 'Y'").get(me.MBR_ID);
    return { deletedAddressId: id, newDefaultAddressId: current?.MBR_ADDR_ID ?? null };
  })();
});
