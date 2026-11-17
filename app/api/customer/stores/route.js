import db from "@/lib/db";
import { handler, pathId, oneOf, str, pageOf, paged } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { distanceM, DELIVERY_RANGE_M } from "@/lib/server/geo";
import { customerAddress, STORE_COLUMNS, storeSummary } from "@/lib/server/customer-stores";

export const runtime = "nodejs";

export const GET = handler(({ request, query }) => {
  const me = requireRole(request, "CUSTOMER");
  const address = customerAddress(me.MBR_ID, pathId(query.get("addressId"), "addressId"));
  const category = oneOf(query.get("categoryCode"), "categoryCode", ["CHICKEN", "PIZZA", "KOREAN", "CHINESE", "JAPANESE", "SNACK", "CAFE", "ETC"], { required: false });
  const sort = oneOf(query.get("sort"), "sort", ["DEFAULT", "RATING", "REVIEW-COUNT", "DELIVERY_TIP"], { required: false }) ?? "DEFAULT";
  const keyword = str(query.get("keyword"), "keyword", { required: false });
  const pg = pageOf(query);
  const conditions = ["s.DEL_YN = 'N'", "s.STORE_APRV_STTS = 'APPROVED'"];
  const values = [];
  if (category !== undefined) { conditions.push("s.STORE_CTGR_CD = ?"); values.push(category); }
  if (keyword !== undefined) { conditions.push("instr(s.STORE_NM, ?) > 0"); values.push(keyword); }
  const stores = db.prepare(`SELECT ${STORE_COLUMNS} FROM TB_STORE s
    JOIN V_STORE_RATING r ON r.STORE_ID = s.STORE_ID WHERE ${conditions.join(" AND ")}`).all(...values)
    .map((store) => ({ ...store, actualDistance: distanceM(address.MBR_LAT, address.MBR_LNG, store.lat, store.lng) }))
    .filter((store) => store.actualDistance <= DELIVERY_RANGE_M);
  stores.sort((a, b) => {
    if (a.isOpenNow !== b.isOpenNow) return b.isOpenNow - a.isOpenNow;
    let difference = 0;
    if (sort === "DEFAULT") difference = a.actualDistance - b.actualDistance;
    if (sort === "RATING") difference = Number(a.avgRating === null) - Number(b.avgRating === null) || (b.avgRating ?? 0) - (a.avgRating ?? 0);
    if (sort === "REVIEW-COUNT") difference = b.reviewCount - a.reviewCount;
    if (sort === "DELIVERY_TIP") difference = a.deliveryTip - b.deliveryTip;
    return difference || a.storeId - b.storeId;
  });
  return paged(pg, stores.slice(pg.offset, pg.offset + pg.size).map((store) => storeSummary(store, address, store.actualDistance)), stores.length);
});
