import db from "@/lib/db";
import { handler, readJson, str, num, bool, invalid, created } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = handler(({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  return db.prepare(`SELECT MBR_ADDR_ID AS addressId, MBR_ADDR_NM AS addressName,
    MBR_ADDR AS address, MBR_DADDR AS addressDetail, MBR_ZIP AS zipCode,
    MBR_LAT AS lat, MBR_LNG AS lng, DFLT_YN AS isDefault
    FROM TB_MBR_ADDR WHERE MBR_ID = ? AND DEL_YN = 'N'
    ORDER BY DFLT_YN DESC, REG_DTTM DESC, MBR_ADDR_ID DESC`).all(me.MBR_ID)
    .map((address) => ({ ...address, isDefault: address.isDefault === "Y" }));
});

export const POST = handler(async ({ request }) => {
  const me = requireRole(request, "CUSTOMER");
  const body = await readJson(request);
  const name = str(body.addressName, "addressName", { max: 30 });
  const address = str(body.address, "address", { max: 200 });
  const detail = body.addressDetail === undefined ? null : body.addressDetail === "" ? "" : str(body.addressDetail, "addressDetail", { min: 0, max: 100 });
  const zip = str(body.zipCode, "zipCode", { pattern: /^\d{5}$/ });
  if (typeof body.lat !== "number") invalid("lat", "숫자여야 합니다.");
  if (typeof body.lng !== "number") invalid("lng", "숫자여야 합니다.");
  const lat = num(body.lat, "lat", { min: -90, max: 90 });
  const lng = num(body.lng, "lng", { min: -180, max: 180 });
  const requestedDefault = body.isDefault === undefined ? false : bool(body.isDefault, "isDefault");
  const result = db.transaction(() => {
    const exists = db.prepare("SELECT 1 FROM TB_MBR_ADDR WHERE MBR_ID = ? AND DEL_YN = 'N' LIMIT 1").get(me.MBR_ID);
    const isDefault = !exists || requestedDefault;
    if (isDefault) db.prepare("UPDATE TB_MBR_ADDR SET DFLT_YN = 'N' WHERE MBR_ID = ? AND DEL_YN = 'N' AND DFLT_YN = 'Y'").run(me.MBR_ID);
    const row = db.prepare(`INSERT INTO TB_MBR_ADDR
      (MBR_ID, MBR_ADDR_NM, MBR_ADDR, MBR_DADDR, MBR_ZIP, MBR_LAT, MBR_LNG, DFLT_YN)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(me.MBR_ID, name, address, detail, zip, lat, lng, isDefault ? "Y" : "N");
    return { addressId: Number(row.lastInsertRowid), isDefault };
  })();
  return created(result);
});
