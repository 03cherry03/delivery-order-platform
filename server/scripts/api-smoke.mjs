// Production authentication requires SESSION_SECRET; give the child its own key without changing shared configuration.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const external = Boolean(process.env.SMOKE_BASE_URL);
const base = new URL(process.env.SMOKE_BASE_URL || "http://localhost:4100");
const cookies = new Map();
const password = "test1234";
const runId = `${Date.now()}-${process.pid}`;
const address = {
  addressName: "Smoke", address: "서울특별시 동작구 상도로 369",
  addressDetail: "101호", zipCode: "06978", lat: 37.4963, lng: 126.9575,
};
let currentStep = "setup";
let lastRequest = "(none)";
let lastResponse = "(none)";
let server;
let serverLog = "";
let addressId;
let storeId;
let owner;
let customerId;
let cartItems;

async function step(name, fn) {
  currentStep = name;
  const result = await fn();
  console.log(`ok - ${name}`);
  return result;
}

async function api(method, path, { as, body, headers = {} } = {}) {
  lastRequest = `${method} ${path}${as ? ` as ${as}` : ""}${body === undefined ? "" : ` ${JSON.stringify(body)}`}\nHeaders: ${JSON.stringify(headers)}`;
  lastResponse = "(no response)";
  if (cookies.has(as)) headers.cookie = cookies.get(as);
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(new URL(path, base), {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000), redirect: "manual",
  });
  const setCookies = response.headers.getSetCookie();
  for (const value of setCookies) {
    const session = value.match(/^delivery_session=([^;]*)/);
    if (session && as) {
      if (session[1]) cookies.set(as, session[0]);
      else cookies.delete(as);
    }
  }
  const text = await response.text();
  lastResponse = `HTTP ${response.status}\nHeaders: ${JSON.stringify(Object.fromEntries(response.headers))}\n${text}`;
  let json;
  if (response.status !== 204) {
    try { json = JSON.parse(text); }
    catch { assert.fail("API response must be JSON"); }
  }
  return { status: response.status, json, setCookies, headers: response.headers };
}

function expectOk(response, status = 200) {
  assert.equal(response.status, status, "HTTP status");
  assert.equal(response.json.success, true, "success envelope");
  assert.ok(Object.hasOwn(response.json, "data"), "data field");
  return response.json.data;
}

function expectFail(response, status, code) {
  assert.equal(response.status, status, "HTTP status");
  assert.equal(response.json.success, false, "failure envelope");
  assert.equal(response.json.error?.code, code, "error code");
  assert.equal(typeof response.json.error.message, "string");
  return response.json.error;
}

async function login(as, email = `${as}@test.com`, role) {
  const response = await api("POST", "/api/auth/login", { as, body: { email, password } });
  const me = expectOk(response);
  assert.ok(response.setCookies.some((value) => /^delivery_session=[^;]/.test(value)), "session cookie");
  assert.ok(cookies.has(as), "cookie jar captured session");
  assert.ok(Number.isInteger(me.memberId) && me.memberId > 0);
  assert.equal(typeof me.name, "string");
  if (role) assert.equal(me.role, role);
  return me;
}

async function authentication() {
  for (const [as, role] of [["admin", "ADMIN"], ["owner1", "OWNER"], ["rider1", "RIDER"], ["customer1", "CUSTOMER"]]) {
    await step(`A-01/A-03 ${role} login and me`, async () => {
      const me = await login(as, `${as}@test.com`, role);
      assert.deepEqual(expectOk(await api("GET", "/api/auth/me", { as })), me);
    });
  }
  await step("A-01 wrong password", async () => {
    expectFail(await api("POST", "/api/auth/login", {
      body: { email: "customer1@test.com", password: "wrong-password" },
    }), 401, "LOGIN_FAILED");
  });
}

async function cors() {
  const origin = "http://localhost:3000";
  const disallowed = "http://evil.example";
  const allowHeaders = [
    "access-control-allow-origin", "access-control-allow-credentials",
    "access-control-allow-methods", "access-control-allow-headers",
  ];
  const preflight = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
  };
  await step("cors: allowed preflight", async () => {
    const response = await api("OPTIONS", "/api/auth/login", { headers: { ...preflight, Origin: origin } });
    assert.equal(response.status, 204, "preflight status");
    assert.deepEqual(
      [...response.headers.keys()].filter((name) => name.startsWith("access-control-")),
      [...allowHeaders].sort(),
      "exactly the four CORS allow headers",
    );
    assert.equal(response.headers.get(allowHeaders[0]), origin);
    assert.equal(response.headers.get(allowHeaders[1]), "true");
    const methods = response.headers.get(allowHeaders[2]).split(",").map((value) => value.trim());
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      assert.ok(methods.includes(method), `preflight allows ${method}`);
    }
    assert.ok(response.headers.get(allowHeaders[3]).split(",").map((value) => value.trim()).includes("Content-Type"));
  });
  await step("cors: disallowed preflight", async () => {
    const response = await api("OPTIONS", "/api/auth/login", { headers: { ...preflight, Origin: disallowed } });
    assert.equal(response.status, 204, "preflight status");
    for (const name of allowHeaders) assert.equal(response.headers.get(name), null, `${name} must be absent`);
  });
  let memberId;
  await step("cors: allowed credentialed login", async () => {
    const response = await api("POST", "/api/auth/login", {
      as: "cors", headers: { Origin: origin }, body: { email: "customer1@test.com", password },
    });
    memberId = expectOk(response).memberId;
    assert.ok(Number.isInteger(memberId) && memberId > 0);
    assert.equal(response.headers.get(allowHeaders[0]), origin, "allow origin must not be *");
    assert.equal(response.headers.get(allowHeaders[1]), "true");
    assert.ok(cookies.has("cors"), "login cookie captured");
  });
  await step("cors: allowed cookie authenticates me", async () => {
    const response = await api("GET", "/api/auth/me", { as: "cors", headers: { Origin: origin } });
    assert.equal(expectOk(response).memberId, memberId);
  });
  await step("cors: disallowed real request", async () => {
    const response = await api("GET", "/api/auth/me", { as: "cors", headers: { Origin: disallowed } });
    expectOk(response);
    assert.equal(response.headers.get(allowHeaders[0]), null, "allow origin must be absent");
  });
}

async function permissions() {
  await step("permissions: anonymous customer route", async () => {
    expectFail(await api("GET", "/api/customer/addresses"), 401, "UNAUTHORIZED");
  });
  await step("permissions: customer on owner route", async () => {
    expectFail(await api("GET", "/api/owner/stores", { as: "customer1" }), 403, "FORBIDDEN");
  });
  await step("permissions: customer on admin route", async () => {
    expectFail(await api("GET", "/api/admin/summary", { as: "customer1" }), 403, "FORBIDDEN");
  });
  await step("permissions: owner1 on owner2 store", async () => {
    expectFail(await api("GET", "/api/owner/stores/2", { as: "owner1" }), 403, "FORBIDDEN");
  });
}

async function validation() {
  await step("C-02 invalid zip code", async () => {
    const error = expectFail(await api("POST", "/api/customer/addresses", {
      as: "customer1", body: { ...address, zipCode: "bad" },
    }), 400, "VALIDATION_ERROR");
    assert.ok(error.fields && Object.keys(error.fields).length > 0, "validation fields");
    assert.ok(Object.hasOwn(error.fields, "zipCode"), "zipCode field error");
  });
  await step("C-07 invalid charge multiple", async () => {
    const error = expectFail(await api("POST", "/api/customer/points/charges", {
      as: "customer1", body: { amount: 15000, method: "CARD" },
    }), 400, "VALIDATION_ERROR");
    assert.ok(error.fields && Object.keys(error.fields).length > 0);
  });
}

async function prepareShopping() {
  await step("A-06/D-01 create isolated customer and IDLE rider", async () => {
    for (const [as, role] of [["shopper", "CUSTOMER"], ["courier", "RIDER"]]) {
      const email = `smoke-${as}-${runId}@test.com`;
      const body = { role, email, password, name: `Smoke ${as}`, tel: "010-1234-5678" };
      if (role === "RIDER") Object.assign(body, { vehicleType: "BICYCLE", actRadiusM: 5000 });
      const created = expectOk(await api("POST", "/api/auth/signup", { body }), 201);
      assert.equal(created.role, role);
      const me = await login(as, email, role);
      assert.equal(me.memberId, created.memberId);
      if (as === "shopper") customerId = me.memberId;
    }
    const rider = expectOk(await api("GET", "/api/rider/me", { as: "courier" }));
    assert.equal(rider.riderStatus, "IDLE");
    assert.equal(rider.currentDeliveryId, null);
  });
  await step("C-02 create delivery address", async () => {
    const created = expectOk(await api("POST", "/api/customer/addresses", { as: "shopper", body: address }), 201);
    addressId = created.addressId;
    assert.ok(Number.isInteger(addressId) && addressId > 0);
    assert.equal(created.isDefault, true);
  });
  await step("C-08/S-04/S-03 choose approved open seed store", async () => {
    const stores = expectOk(await api("GET", `/api/customer/stores?addressId=${addressId}&size=100`, { as: "shopper" }));
    let store = stores.items.find((item) => [1, 2, 3].includes(item.storeId) && item.isOpenNow && item.canOrder);
    if (!store) {
      store = stores.items.find((item) => item.storeId === 1);
      assert.ok(store, "approved seed store 1 must be visible");
      const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, open: "00:00", close: "24:00" }));
      const saved = expectOk(await api("PUT", "/api/owner/stores/1/hours", { as: "owner1", body: { hours } }));
      assert.deepEqual(saved.hours, hours);
      assert.equal(expectOk(await api("PATCH", "/api/owner/stores/1/oper-status", {
        as: "owner1", body: { operStatus: "OPEN" },
      })).operStatus, "OPEN");
    }
    storeId = store.storeId;
    owner = `owner${storeId}`;
    if (!cookies.has(owner)) await login(owner, `${owner}@test.com`, "OWNER");
    const detail = expectOk(await api("GET", `/api/customer/stores/${storeId}?addressId=${addressId}`, { as: "shopper" }));
    assert.equal(detail.canOrder, true);
    assert.equal(detail.isOpenNow, true);
  });
  await step("C-10/C-11 choose sale menus and required options", async () => {
    const categories = expectOk(await api("GET", `/api/customer/stores/${storeId}/menus`, { as: "shopper" }));
    const menus = categories.flatMap((category) => category.menus).filter((menu) => menu.saleStatus === "ON_SALE");
    assert.ok(menus.length > 0, "sale menu exists");
    cartItems = [];
    for (const menu of menus.slice(0, 2)) {
      const detail = expectOk(await api("GET", `/api/customer/stores/${storeId}/menus/${menu.menuId}`, { as: "shopper" }));
      const optionIds = detail.optionGroups.flatMap((group) => {
        if (!group.required) return [];
        assert.ok(group.options.length > 0, "required group has an option");
        return [group.options[0].optionId];
      });
      cartItems.push({ storeId, menuId: menu.menuId, quantity: 2, optionIds });
    }
  });
}

async function placeOrder(payMethod) {
  expectOk(await api("DELETE", "/api/customer/cart", { as: "shopper" }));
  for (const body of cartItems) {
    const item = expectOk(await api("POST", "/api/customer/cart/items", { as: "shopper", body }), 201);
    assert.equal(item.quantity, body.quantity);
    assert.ok(item.cartItemId > 0);
  }
  const preview = expectOk(await api("POST", "/api/customer/orders/preview", {
    as: "shopper", body: { addressId, payMethod },
  }));
  assert.equal(preview.storeId, storeId);
  assert.equal(preview.canOrder, true);
  assert.equal(preview.items.length, cartItems.length);
  assert.equal(preview.orderTotal, preview.items.reduce((sum, item) => sum + item.lineTotal, 0));
  assert.equal(preview.payAmount, preview.orderTotal + preview.deliveryTip);
  const order = expectOk(await api("POST", "/api/customer/orders", {
    as: "shopper", body: { addressId, payMethod, storeRequest: `smoke-${runId}`, riderRequest: "문 앞에 놓아 주세요", cutlery: false },
  }), 201);
  assert.equal(order.status, "WAIT");
  assert.equal(order.payMethod, payMethod);
  assert.equal(order.paymentStatus, "APPROVED");
  assert.equal(order.orderTotal, preview.orderTotal);
  assert.equal(order.payAmount, preview.payAmount);
  assert.ok(order.orderId > 0 && order.autoCancelAt && order.orderedAt);
  return order;
}

async function acceptOrder(order) {
  const accepted = expectOk(await api("POST", `/api/owner/stores/${storeId}/orders/${order.orderId}/accept`, {
    as: owner, body: { cookMinutes: 15 },
  }));
  assert.equal(accepted.orderId, order.orderId);
  assert.equal(accepted.status, "COOKING");
  assert.equal(accepted.cookMinutes, 15);
  assert.ok(accepted.acceptedAt);
}

async function dispatchOrder(order) {
  const requests = expectOk(await api("GET", "/api/rider/dispatch-requests", { as: "courier" }));
  const request = requests.find((item) => item.orderId === order.orderId);
  assert.ok(request, "new order is in dispatch requests");
  assert.equal(request.orderStatus, "COOKING");
  const delivery = expectOk(await api("POST", `/api/rider/deliveries/${request.deliveryId}/accept`, { as: "courier" }));
  assert.equal(delivery.orderId, order.orderId);
  assert.equal(delivery.orderStatus, "COOKING");
  assert.ok(delivery.dispatchedAt);
  const rider = expectOk(await api("GET", "/api/rider/me", { as: "courier" }));
  assert.equal(rider.riderStatus, "BUSY");
  assert.equal(rider.currentDeliveryId, request.deliveryId);
  return request.deliveryId;
}

async function mainFlow() {
  await prepareShopping();
  const order = await step("C-14/C-18/C-19 CARD order WAIT", () => placeOrder("CARD"));
  await step("O-01 owner sees new WAIT order", async () => {
    const orders = expectOk(await api("GET", `/api/owner/stores/${storeId}/orders?status=WAIT`, { as: owner }));
    const found = orders.find((item) => item.orderId === order.orderId);
    assert.ok(found, "new order appears");
    assert.equal(found.status, "WAIT");
    assert.equal(found.payAmount, order.payAmount);
  });
  await step("O-03 accept order COOKING", () => acceptOrder(order));
  const deliveryId = await step("D-04/D-05/D-02 dispatch order and rider BUSY", () => dispatchOrder(order));
  await step("O-05 cooked READY", async () => {
    const cooked = expectOk(await api("POST", `/api/owner/stores/${storeId}/orders/${order.orderId}/cooked`, { as: owner }));
    assert.equal(cooked.status, "READY");
    assert.equal(cooked.orderId, order.orderId);
  });
  await step("D-07 pickup DELIVERING", async () => {
    const picked = expectOk(await api("POST", `/api/rider/deliveries/${deliveryId}/pickup`, { as: "courier" }));
    assert.equal(picked.orderStatus, "DELIVERING");
    assert.equal(picked.orderId, order.orderId);
    assert.ok(picked.pickedUpAt);
  });
  const completed = await step("D-08/C-21/D-02 complete DONE and rider IDLE", async () => {
    const result = expectOk(await api("POST", `/api/rider/deliveries/${deliveryId}/complete`, { as: "courier" }));
    assert.equal(result.deliveryId, deliveryId);
    assert.ok(result.completedAt);
    const detail = expectOk(await api("GET", `/api/customer/orders/${order.orderId}`, { as: "shopper" }));
    assert.equal(detail.status, "DONE");
    assert.equal(detail.deliveredAt, result.completedAt);
    assert.equal(detail.canReview, true);
    const rider = expectOk(await api("GET", "/api/rider/me", { as: "courier" }));
    assert.equal(rider.riderStatus, "IDLE");
    assert.equal(rider.currentDeliveryId, null);
    return result;
  });
  const review = await step("C-24 customer review", async () => {
    const result = expectOk(await api("POST", `/api/customer/orders/${order.orderId}/review`, {
      as: "shopper", body: { rating: 5, content: `Smoke review ${runId}` },
    }), 201);
    assert.equal(result.orderId, order.orderId);
    assert.equal(result.rating, 5);
    assert.ok(result.reviewId > 0);
    return result;
  });
  const content = `Smoke reply ${runId}`;
  await step("R-02 owner reply", async () => {
    const reply = expectOk(await api("POST", `/api/owner/stores/${storeId}/reviews/${review.reviewId}/reply`, {
      as: owner, body: { content },
    }), 201);
    assert.equal(reply.content, content);
    assert.ok(reply.replyId > 0);
  });
  for (const [prefix, as, id] of [["customer", "shopper", "C-12"], ["owner", owner, "R-01"]]) {
    await step(`${id} review and reply visible`, async () => {
      const reviews = expectOk(await api("GET", `/api/${prefix}/stores/${storeId}/reviews?size=100`, { as }));
      const found = reviews.items.find((item) => item.reviewId === review.reviewId);
      assert.ok(found, "review visible");
      assert.equal(found.content, review.content);
      assert.equal(found.reply?.content, content);
      assert.equal(found.rating, 5);
    });
  }
  await step("T-01/T-02 today's sales include order and reconcile", async () => {
    const today = completed.completedAt.slice(0, 10);
    const range = `from=${today}&to=${today}`;
    const sales = expectOk(await api("GET", `/api/owner/stores/${storeId}/sales?unit=day&${range}`, { as: owner }));
    assert.ok(sales.summary.orderCount >= 1);
    assert.ok(sales.summary.salesAmount >= order.orderTotal, "sales include this order amount, excluding delivery tip");
    assert.equal(sales.rows.find((row) => row.period === today)?.salesAmount, sales.summary.salesAmount);
    const menus = expectOk(await api("GET", `/api/owner/stores/${storeId}/sales/menus?${range}`, { as: owner }));
    assert.equal(menus.reduce((sum, menu) => sum + menu.salesAmount, 0), sales.summary.salesAmount);
  });
  const reviewPath = `/api/customer/reviews/${review.reviewId}`;
  const edited = await step("C-25 customer edits review", async () => {
    const content = `Smoke edited review ${runId}`;
    const updated = expectOk(await api("PATCH", reviewPath, { as: "shopper", body: { rating: 4, content } }));
    assert.equal(updated.reviewId, review.reviewId);
    assert.equal(updated.rating, 4);
    assert.equal(updated.content, content);
    return updated;
  });
  const reportsPath = "/api/admin/review-reports";
  const report = await step("R-05 owner reports review", async () => {
    const result = expectOk(await api("POST", `/api/owner/stores/${storeId}/reviews/${review.reviewId}/report`, {
      as: owner, body: { reason: "ETC", content: `Smoke report ${runId}` },
    }), 201);
    assert.ok(result.reportId > 0);
    assert.equal(result.status, "PENDING");
    const detail = expectOk(await api("GET", `${reportsPath}/${result.reportId}`, { as: "admin" }));
    assert.equal(detail.reviewDeleted, false);
    return result;
  });
  await step("C-26 customer deletes reported review", async () => {
    assert.deepEqual(expectOk(await api("DELETE", reviewPath, { as: "shopper" })), { reviewId: review.reviewId, deleted: true });
  });
  await step("X-05/X-06 pending report retains the deleted review", async () => {
    const reports = expectOk(await api("GET", `${reportsPath}?status=PENDING`, { as: "admin" }));
    const item = reports.find((item) => item.reportId === report.reportId);
    assert.ok(item, "report remains in pending list");
    assert.equal(item.reviewId, review.reviewId);
    assert.equal(item.reviewDeleted, true);
    const detail = expectOk(await api("GET", `${reportsPath}/${report.reportId}`, { as: "admin" }));
    assert.equal(detail.status, "PENDING");
    assert.equal(detail.reviewDeleted, true);
    assert.equal(detail.review.reviewId, review.reviewId);
    assert.equal(detail.review.content, edited.content);
  });
}

async function riderHistorySummary() {
  await step("D-09 rider weekly/monthly tips include completed delivery regardless of page", async () => {
    const path = "/api/rider/deliveries/history?size=1";
    // 서버와 같은 현지 시간으로 오늘 날짜를 독립적으로 계산한다 (자정 경계 대비 조회 전후 둘 다).
    const localDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const startDay = localDay(new Date());
    const history = expectOk(await api("GET", path, { as: "courier" }));
    assert.equal(history.totalCount, 1);
    assert.equal(history.items.length, 1);
    const [delivery] = history.items;
    const order = expectOk(await api("GET", `/api/customer/orders/${delivery.orderId}`, { as: "shopper" }));
    assert.equal(delivery.deliveryTip, order.deliveryTip);
    assert.equal(delivery.completedAt, order.deliveredAt);

    const emptyPage = expectOk(await api("GET", `${path}&page=2`, { as: "courier" }));
    const endDay = localDay(new Date());
    assert.equal(emptyPage.totalCount, 1);
    assert.deepEqual(emptyPage.items, []);
    const day = delivery.completedAt.slice(0, 10);
    const weekOf = (d) => {
      const date = new Date(`${d}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); // 월요일 시작
      const from = date.toISOString().slice(0, 10);
      date.setUTCDate(date.getUTCDate() + 6);
      return { from, to: date.toISOString().slice(0, 10) };
    };
    const monthOf = (d) => {
      const date = new Date(`${d.slice(0, 7)}-01T00:00:00Z`);
      const from = date.toISOString().slice(0, 10);
      date.setUTCMonth(date.getUTCMonth() + 1, 0);
      return { from, to: date.toISOString().slice(0, 10) };
    };
    for (const { summary: { thisWeek, thisMonth } } of [history, emptyPage]) {
      for (const [period, of] of [[thisWeek, weekOf], [thisMonth, monthOf]]) {
        const expected = [of(startDay), of(endDay)];
        assert.ok(expected.some((e) => e.from === period.from && e.to === period.to), `period ${period.from}~${period.to} is the current one`);
        // 완료일이 그 기간에 속하면 1건, 완료 뒤 자정을 넘겨 기간이 바뀌었으면 0건이다.
        const count = Number(period.from <= day && day <= period.to);
        assert.equal(period.count, count);
        assert.equal(period.tipAmount, count * order.deliveryTip);
      }
    }
  });
}

async function points() {
  return expectOk(await api("GET", "/api/customer/points?size=100", { as: "shopper" }));
}

async function cancellationAndRefund() {
  const beforeCharge = await step("C-06 balance before charge", () => points());
  await step("C-07 charge points", async () => {
    const charge = expectOk(await api("POST", "/api/customer/points/charges", {
      as: "shopper", body: { amount: 1000000, method: "CARD" },
    }), 201);
    assert.equal(charge.type, "CHARGE");
    assert.equal(charge.amount, 1000000);
    assert.equal(charge.balance, beforeCharge.balance + charge.amount);
    assert.equal(charge.status, "COMPLETED");
  });
  const before = await step("C-06 balance before POINT order", () => points());
  const order = await step("C-19 POINT order", () => placeOrder("POINT"));
  await step("C-22/C-06 customer cancel refunds POINT exactly once", async () => {
    assert.equal((await points()).balance, before.balance - order.payAmount);
    const canceled = expectOk(await api("POST", `/api/customer/orders/${order.orderId}/cancel`, { as: "shopper" }));
    assert.equal(canceled.status, "CANCEL");
    assert.equal(canceled.cancelActor, "CUSTOMER");
    assert.equal(canceled.cancelReason, "CUSTOMER_REQUEST");
    assert.equal(canceled.refunded, true);
    const after = await points();
    assert.equal(after.balance, before.balance);
    const refunds = after.items.filter((item) => item.orderId === order.orderId && item.type === "REFUND");
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].amount, order.payAmount);
    assert.equal(refunds[0].balanceAfter, before.balance);
  });
  const card = await step("C-19 CARD order for owner rejection", () => placeOrder("CARD"));
  await step("O-04/C-21 CARD rejection cancels without point REFUND", async () => {
    const rejected = expectOk(await api("POST", `/api/owner/stores/${storeId}/orders/${card.orderId}/reject`, {
      as: owner, body: { reason: "BUSY" },
    }));
    assert.equal(rejected.status, "CANCEL");
    const detail = expectOk(await api("GET", `/api/customer/orders/${card.orderId}`, { as: "shopper" }));
    assert.equal(detail.status, "CANCEL");
    assert.equal(detail.cancelActor, "OWNER");
    assert.equal(detail.cancelReason, "BUSY");
    const after = await points();
    assert.equal(after.balance, before.balance);
    assert.equal(after.items.some((item) => item.orderId === card.orderId && item.type === "REFUND"), false);
  });
}

async function dispatchedCancel() {
  const order = await step("C-19 order for dispatched cancellation", () => placeOrder("CARD"));
  await step("O-03 accept before dispatched cancellation", () => acceptOrder(order));
  await step("D-05 dispatch before cancellation", () => dispatchOrder(order));
  await step("X-13/D-02 admin cancellation releases rider", async () => {
    const canceled = expectOk(await api("POST", `/api/admin/orders/${order.orderId}/cancel`, {
      as: "admin", body: { reason: "STORE_ISSUE", counselNote: `Smoke cancellation ${runId}` },
    }));
    assert.equal(canceled.status, "CANCEL");
    assert.equal(canceled.refunded, true);
    const rider = expectOk(await api("GET", "/api/rider/me", { as: "courier" }));
    assert.equal(rider.riderStatus, "IDLE");
    assert.equal(rider.currentDeliveryId, null);
    const detail = expectOk(await api("GET", `/api/customer/orders/${order.orderId}`, { as: "shopper" }));
    assert.equal(detail.status, "CANCEL");
    assert.equal(detail.cancelActor, "ADMIN");
  });
}

async function expiry() {
  if (external && !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
    console.log("skip - 10-minute expiry: external server is not localhost");
    return;
  }
  const { default: Database } = await import("better-sqlite3");
  let db;
  try { db = new Database(fileURLToPath(new URL("../delivery.db", import.meta.url)), { fileMustExist: true }); }
  catch (error) {
    if (!external) throw error;
    console.log("skip - 10-minute expiry: local delivery.db is unavailable");
    return;
  }
  try {
    const localCustomer = db.prepare("SELECT MBR_ID FROM TB_MBR WHERE MBR_ID = ? AND MBR_EMAIL = ? AND MBR_STTS = 'ACTIVE'")
      .get(customerId, `smoke-shopper-${runId}@test.com`);
    if (external && !localCustomer) {
      console.log("skip - 10-minute expiry: localhost server uses a different database");
      return;
    }
    for (const payMethod of ["CARD", "POINT"]) {
      const before = await step(`C-06 balance before ${payMethod} expiry`, () => points());
      const order = await step(`C-19 ${payMethod} order for expiry`, () => placeOrder(payMethod));
      await step(`O-03/C-21 ${payMethod} 10-minute expiry commits SYSTEM cancellation`, async () => {
        const changed = db.prepare(`UPDATE TB_ORD SET ORD_DTTM = datetime('now','localtime','-11 minutes')
          WHERE ORD_ID = ? AND MBR_ID = ? AND STORE_RQST_CN = ? AND ORD_STTS = 'WAIT'`)
          .run(order.orderId, customerId, `smoke-${runId}`);
        assert.equal(changed.changes, 1, "age only this run's WAIT order in the same database");
        expectFail(await api("POST", `/api/owner/stores/${storeId}/orders/${order.orderId}/accept`, {
          as: owner, body: { cookMinutes: 15 },
        }), 409, "ORDER_ALREADY_PROCESSED");
        const detail = expectOk(await api("GET", `/api/customer/orders/${order.orderId}`, { as: "shopper" }));
        assert.equal(detail.status, "CANCEL");
        assert.equal(detail.cancelActor, "SYSTEM");
        assert.equal(detail.cancelReason, "NO_RESPONSE");
        const after = await points();
        assert.equal(after.balance, before.balance);
        const refunds = after.items.filter((item) => item.orderId === order.orderId && item.type === "REFUND");
        assert.equal(refunds.length, payMethod === "POINT" ? 1 : 0);
        if (payMethod === "POINT") assert.equal(refunds[0].amount, order.payAmount);
      });
    }
  } finally { db.close(); }
}

async function withdrawnEmail() {
  const email = `smoke-withdraw-${runId}@test.com`;
  const body = { role: "CUSTOMER", email, password, name: "Smoke withdrawal", tel: "010-1234-5678" };
  const first = await step("A-06 signup before withdrawal", async () => {
    const result = expectOk(await api("POST", "/api/auth/signup", { body }), 201);
    assert.equal(result.role, "CUSTOMER");
    await login("withdraw", email, "CUSTOMER");
    return result;
  });
  await step("A-07 withdraw clears session", async () => {
    const result = expectOk(await api("DELETE", "/api/auth/me", { as: "withdraw", body: { password } }));
    assert.ok(result.withdrawnAt);
    assert.equal(result.expiredPoint, 0);
    assert.equal(cookies.has("withdraw"), false);
    expectFail(await api("GET", "/api/auth/me", { as: "withdraw" }), 401, "UNAUTHORIZED");
  });
  await step("A-06/A-01 withdrawn email creates new member and logs in", async () => {
    const result = expectOk(await api("POST", "/api/auth/signup", { body }), 201);
    assert.notEqual(result.memberId, first.memberId);
    const me = await login("rejoined", email, "CUSTOMER");
    assert.equal(me.memberId, result.memberId);
    assert.deepEqual(expectOk(await api("GET", "/api/auth/me", { as: "rejoined" })), me);
  });
}

async function loginThrottle() {
  const email = `smoke-throttle-${runId}@test.com`;
  const wrongLogin = (email) => api("POST", "/api/auth/login", { body: { email, password: "wrong-password" } });
  await step("A-01 successful login after four failures resets the threshold", async () => {
    const body = { role: "CUSTOMER", email, password, name: "Smoke throttle", tel: "010-1234-5678" };
    const created = expectOk(await api("POST", "/api/auth/signup", { body }), 201);
    for (let i = 0; i < 4; i++) expectFail(await wrongLogin(email), 401, "LOGIN_FAILED");
    assert.equal((await login("throttle", email, "CUSTOMER")).memberId, created.memberId);
  });
  await step("A-01 fifth failure returns 401 and correct password then returns 429", async () => {
    expectFail(await wrongLogin(` ${email.toUpperCase()} `), 401, "LOGIN_FAILED");
    for (let i = 0; i < 4; i++) expectFail(await wrongLogin(email), 401, "LOGIN_FAILED");
    const locked = await api("POST", "/api/auth/login", { body: { email, password } });
    assert.match(expectFail(locked, 429, "LOGIN_LOCKED").message, /\d+분 후/);
    const retryAfter = Number(locked.headers.get("retry-after"));
    assert.ok(Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 600);
    assert.equal(locked.setCookies.length, 0);
  });
}

async function withdrawnOwnerApplication() {
  const email = `smoke-withdraw-owner-${runId}@test.com`;
  const bizDigits = String(randomInt(10_000_000_000)).padStart(10, "0");
  const admin = { as: "admin" };
  const pendingPath = "/api/admin/store-applications?status=PENDING";
  const summary = async () => expectOk(await api("GET", "/api/admin/summary", admin)).pendingApplications;
  const { applicationId, storeId, before } = await step("A-06/X-01 owner signup creates a pending application", async () => {
    const before = await summary();
    const created = expectOk(await api("POST", "/api/auth/signup", {
      body: { role: "OWNER", email, password, name: "Smoke owner withdrawal", tel: "010-1234-5678",
        store: { storeName: "Smoke withdrawal store", categoryCode: "KOREAN",
          bizNo: `${bizDigits.slice(0, 3)}-${bizDigits.slice(3, 5)}-${bizDigits.slice(5)}`,
          telNo: "02-000-0000", address: address.address, lat: address.lat, lng: address.lng,
          minOrderAmount: 10000, deliveryTip: 2000, cookMinutes: 15,
          hours: [{ dayOfWeek: 1, open: "08:00", close: "24:00" }] },
      },
    }), 201);
    assert.equal(created.approvalStatus, "PENDING");
    const application = expectOk(await api("GET", pendingPath, admin)).find((item) => item.storeId === created.storeId);
    assert.ok(application, "new application appears before withdrawal");
    assert.equal(await summary(), before + 1);
    return { ...application, before };
  });
  await step("A-07/X-00/X-01 withdrawal removes application from pending list and count", async () => {
    const as = "withdraw-owner";
    await login(as, email, "OWNER");
    assert.ok(expectOk(await api("DELETE", "/api/auth/me", { as, body: { password } })).withdrawnAt);
    assert.ok(!expectOk(await api("GET", pendingPath, admin)).some((item) => item.storeId === storeId));
    assert.equal(await summary(), before);
  });
  await step("X-03/X-04 withdrawn owner's application cannot be processed", async () => {
    const path = `/api/admin/store-applications/${applicationId}`;
    expectFail(await api("POST", `${path}/approve`, admin), 409, "STORE_DELETED");
    expectFail(await api("POST", `${path}/reject`, { ...admin, body: { rejectReason: "Smoke withdrawal" } }), 409, "STORE_DELETED");
    const detail = expectOk(await api("GET", path, admin));
    assert.equal(detail.storeId, storeId);
    assert.equal(detail.approvalStatus, "PENDING");
  });
}

function killServer(signal) {
  if (!server?.pid) return;
  try { process.kill(-server.pid, signal); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
}

async function stopServer() {
  if (!server) return;
  const child = server;
  const exited = child.exitCode !== null || child.signalCode !== null;
  const exit = exited ? Promise.resolve() : once(child, "exit");
  killServer("SIGTERM");
  let timer;
  try {
    await Promise.race([exit, new Promise((resolve) => { timer = setTimeout(resolve, 5000); })]);
    killServer("SIGKILL");
    await exit;
  } finally {
    clearTimeout(timer);
    server = undefined;
  }
}

async function startServer() {
  assert.equal(Number(process.versions.node.split(".")[0]), 24, "Run smoke with Node 24");
  if (external) return;
  const init = spawnSync(process.execPath, ["scripts/init-db.mjs"], { cwd: root, stdio: "inherit" });
  assert.ifError(init.error);
  assert.equal(init.status, 0, "database initialization");
  server = spawn(process.execPath, ["src/index.js"], {
    cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env, PORT: "4100", NODE_ENV: "production",
      SESSION_SECRET: randomBytes(32).toString("hex"), CORS_ORIGINS: "http://localhost:3000",
    },
  });
  let spawnError;
  server.on("error", (error) => { spawnError = error; });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => { serverLog = (serverLog + chunk).slice(-8000); });
  }
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    assert.equal(server.exitCode, null, `server exited during startup\n${serverLog}`);
    assert.equal(server.signalCode, null, `server stopped during startup\n${serverLog}`);
    try {
      const response = await fetch(new URL("/api/auth/me", base), { signal: AbortSignal.timeout(1000) });
      await response.text();
      return;
    } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  assert.fail(`server readiness timed out\n${serverLog}`);
}

process.on("exit", () => killServer("SIGKILL"));
for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]]) {
  process.once(signal, async () => {
    console.error(`not ok - ${currentStep}: interrupted by ${signal}`);
    await stopServer();
    process.exit(code);
  });
}

try {
  await step(external ? `using existing server ${base.origin}` : "initialize database and start production server", startServer);
  for (const scenario of [authentication, permissions, validation, mainFlow, riderHistorySummary, cancellationAndRefund, dispatchedCancel, expiry, withdrawnEmail, cors, loginThrottle, withdrawnOwnerApplication]) {
    await scenario();
  }
  console.log("API smoke passed (12 scenarios)");
} catch (error) {
  console.error(`not ok - ${currentStep}\n${error.message}\nRequest: ${lastRequest}\nLast response body:\n${lastResponse}`);
  process.exitCode = 1;
} finally {
  await stopServer();
}
