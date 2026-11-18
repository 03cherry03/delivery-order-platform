// 가짜 서버의 처음 데이터. 명세서 예시(연세치킨 신촌점 등)를 바탕으로 만들었다.

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// 항상 같은 값을 내는 난수 (새로 고쳐도 같은 데이터)
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ADDRESSES = [
  ['서울 서대문구 연세로 30', '101호', 1200],
  ['서울 서대문구 신촌로 87', '3층', 800],
  ['서울 마포구 와우산로 21', '202호', 1900],
  ['서울 서대문구 명물길 15', '', 600],
  ['서울 마포구 신촌로 120', '1503호', 2400],
  ['서울 서대문구 이화여대길 52', '', 1500],
];
const RIDERS = [
  ['박라이더', 'MOTORCYCLE'],
  ['최배달', 'BICYCLE'],
  ['정빠름', 'MOTORCYCLE'],
  ['한걸음', 'WALK'],
];
const STORE_REQ = ['맵게 해주세요', '소스 많이 주세요', '', '', '무 빼주세요', ''];
const RIDER_REQ = ['문 앞에 두고 벨 눌러주세요', '도착하면 전화 주세요', '', '경비실에 맡겨주세요', ''];
const REVIEW_TEXT = [
  [5, '바삭하고 맛있어요. 또 시킬게요!'],
  [5, '양도 많고 배달도 빨랐어요'],
  [4, '맛있는데 조금 짰어요'],
  [5, '순살 최고입니다'],
  [3, '배달이 생각보다 늦었어요'],
  [4, '소스가 맛있어요'],
  [2, '튀김옷이 눅눅했어요'],
  [5, null],
  [1, '사장님이 불친절해요. 다시는 안 시킴'],
];
const NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];

export const RIDER_POOL = RIDERS;
export const ADDRESS_POOL = ADDRESSES;
export const STORE_REQ_POOL = STORE_REQ;
export const RIDER_REQ_POOL = RIDER_REQ;

export function createSeed(now = Date.now()) {
  const r = rng(20261118);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];

  const db = {
    seq: { member: 10, store: 20, category: 10, menu: 200, group: 600, option: 9100, order: 3000, review: 700, reply: 60, report: 80 },
    session: null,
    lastArrival: now,
    users: [
      { memberId: 3, email: 'owner@test.com', password: 'test1234', name: '김사장', tel: '010-1234-5678', role: 'OWNER', status: 'ACTIVE' },
    ],
    stores: [
      {
        storeId: 10, ownerId: 3, storeName: '연세치킨 신촌점', categoryCode: 'CHICKEN', bizNo: '123-45-67890',
        telNo: '02-123-4567', address: '서울 서대문구 연세로 50', addressDetail: '1층', lat: 37.5596, lng: 126.937,
        minOrderAmount: 15000, deliveryTip: 3000, cookMinutes: 20, description: '바삭한 연세치킨',
        approvalStatus: 'APPROVED', operStored: 'OPEN', rejectReason: null, del: false,
      },
      {
        storeId: 11, ownerId: 3, storeName: '연세피자', categoryCode: 'PIZZA', bizNo: '234-56-78901',
        telNo: '02-234-5678', address: '서울 서대문구 연세로 12', addressDetail: '2층', lat: 37.5582, lng: 126.9365,
        minOrderAmount: 18000, deliveryTip: 2000, cookMinutes: 25, description: '화덕에 굽는 피자',
        approvalStatus: 'REJECTED', operStored: 'PAUSED', rejectReason: '사업자번호 확인 불가', del: false,
      },
    ],
    // 매일 10:00~익일 04:00 영업 (자정을 넘으므로 두 요일로 나뉘어 저장됨)
    hours: {
      10: [0, 1, 2, 3, 4, 5, 6].flatMap((d) => [
        { dayOfWeek: d, open: '00:00', close: '04:00' },
        { dayOfWeek: d, open: '10:00', close: '24:00' },
      ]),
      11: [1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, open: '11:00', close: '22:00' })),
    },
    categories: [
      { categoryId: 1, storeId: 10, categoryName: '대표 메뉴', seq: 1, del: false },
      { categoryId: 2, storeId: 10, categoryName: '사이드', seq: 2, del: false },
      { categoryId: 3, storeId: 10, categoryName: '음료', seq: 3, del: false },
    ],
    menus: [
      { menuId: 101, storeId: 10, categoryId: 1, menuName: '후라이드치킨', price: 18000, description: '바삭한 기본 치킨', saleStatus: 'ON_SALE', seq: 1, del: false },
      { menuId: 102, storeId: 10, categoryId: 1, menuName: '양념치킨', price: 19000, description: '달콤매콤 양념', saleStatus: 'ON_SALE', seq: 2, del: false },
      { menuId: 103, storeId: 10, categoryId: 1, menuName: '반반치킨', price: 19500, description: '후라이드 반 + 양념 반', saleStatus: 'ON_SALE', seq: 3, del: false },
      { menuId: 104, storeId: 10, categoryId: 2, menuName: '치즈볼 5개', price: 4500, description: '', saleStatus: 'ON_SALE', seq: 1, del: false },
      { menuId: 105, storeId: 10, categoryId: 2, menuName: '감자튀김', price: 3500, description: '', saleStatus: 'SOLD_OUT', seq: 2, del: false },
      { menuId: 106, storeId: 10, categoryId: 3, menuName: '콜라 1.25L', price: 2500, description: '', saleStatus: 'ON_SALE', seq: 1, del: false },
    ],
    groups: [
      { optionGroupId: 501, menuId: 101, storeId: 10, groupName: '부위 선택', required: true, maxSelect: 1, seq: 1, del: false },
      { optionGroupId: 502, menuId: 101, storeId: 10, groupName: '소스 추가', required: false, maxSelect: 3, seq: 2, del: false },
      { optionGroupId: 503, menuId: 102, storeId: 10, groupName: '부위 선택', required: true, maxSelect: 1, seq: 1, del: false },
    ],
    options: [
      { optionId: 9001, optionGroupId: 501, storeId: 10, optionName: '뼈', price: 0, seq: 1, del: false },
      { optionId: 9002, optionGroupId: 501, storeId: 10, optionName: '순살', price: 2000, seq: 2, del: false },
      { optionId: 9003, optionGroupId: 502, storeId: 10, optionName: '양념 소스', price: 500, seq: 1, del: false },
      { optionId: 9004, optionGroupId: 502, storeId: 10, optionName: '머스타드', price: 500, seq: 2, del: false },
      { optionId: 9005, optionGroupId: 503, storeId: 10, optionName: '뼈', price: 0, seq: 1, del: false },
      { optionId: 9006, optionGroupId: 503, storeId: 10, optionName: '순살', price: 2000, seq: 2, del: false },
    ],
    orders: [],
    reviews: [],
    reports: [],
  };

  const menuPool = db.menus.filter((m) => m.storeId === 10);
  const makeItems = () => {
    const items = [];
    const main = pick(menuPool.slice(0, 3));
    const boneless = r() < 0.5;
    items.push({
      menuName: main.menuName, quantity: r() < 0.15 ? 2 : 1, unitPrice: main.price,
      options: main.menuId === 103 ? [] : [{ groupName: '부위 선택', optionName: boneless ? '순살' : '뼈', price: boneless ? 2000 : 0 }],
    });
    if (r() < 0.6) {
      const side = pick(menuPool.slice(3));
      items.push({ menuName: side.menuName, quantity: 1, unitPrice: side.price, options: [] });
    }
    return items;
  };
  const baseOrder = (orderedAt) => {
    const [address, detail, distance] = pick(ADDRESSES);
    return {
      orderId: ++db.seq.order, storeId: 10, orderedAt, status: 'WAIT', items: makeItems(),
      storeRequest: pick(STORE_REQ) || null, riderRequest: pick(RIDER_REQ) || null, cutlery: r() < 0.3,
      deliveryAddress: address, deliveryAddressDetail: detail || null, distance,
      deliveryTip: 3000, payMethod: pick(['CARD', 'CARD', 'KAKAO', 'NAVER', 'POINT']),
      acceptedAt: null, cookMinutes: null, readyAt: null, completedAt: null,
      canceledAt: null, cancelActor: null, cancelReason: null, cancelReasonDetail: null, rider: null,
    };
  };
  const riderOf = (t) => {
    const [name, vehicle] = pick(RIDERS);
    return { name, vehicle, dispatchedAt: t, pickedUpAt: null };
  };

  // 지난 60일 주문 이력 (배달완료·취소) — 매출 통계와 완료·취소 탭용
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  for (let d = 60; d >= 1; d--) {
    const dayStart = today0.getTime() - d * DAY;
    const count = 4 + Math.floor(r() * 9);
    for (let i = 0; i < count; i++) {
      const t = dayStart + (11 * 60 + Math.floor(r() * 11 * 60)) * MIN;
      const o = baseOrder(t);
      const roll = r();
      if (roll < 0.06) {
        Object.assign(o, { status: 'CANCEL', canceledAt: t + 4 * MIN, cancelActor: 'OWNER', cancelReason: pick(['BUSY', 'OUT_OF_STOCK']) });
      } else if (roll < 0.09) {
        Object.assign(o, { status: 'CANCEL', canceledAt: t + 10 * MIN, cancelActor: 'SYSTEM', cancelReason: 'NO_RESPONSE' });
      } else if (roll < 0.12) {
        Object.assign(o, { status: 'CANCEL', canceledAt: t + 2 * MIN, cancelActor: 'CUSTOMER', cancelReason: 'CUSTOMER_REQUEST' });
      } else {
        const acc = t + 2 * MIN;
        const ready = acc + 20 * MIN;
        const rider = riderOf(acc + 5 * MIN);
        rider.pickedUpAt = ready + 3 * MIN;
        Object.assign(o, { status: 'DONE', acceptedAt: acc, cookMinutes: 20, readyAt: ready, completedAt: ready + 18 * MIN, rider });
      }
      db.orders.push(o);
    }
  }

  // 리뷰: 배달완료 주문 일부
  const done = db.orders.filter((o) => o.status === 'DONE');
  done.slice(-40).forEach((o, i) => {
    if (i % 2 === 1) return;
    const [rating, content] = REVIEW_TEXT[i % REVIEW_TEXT.length];
    const review = {
      reviewId: ++db.seq.review, storeId: 10, orderId: o.orderId,
      writerName: `${NAMES[i % NAMES.length]}**`, rating, content,
      createdAt: o.completedAt + 60 * MIN,
      orderedMenus: o.items.map((it) => it.menuName).join(', '),
      hidden: false, del: false, reply: null,
    };
    if (i % 6 === 0) review.reply = { replyId: ++db.seq.reply, content: '소중한 리뷰 감사합니다!', createdAt: review.createdAt + 90 * MIN, del: false };
    db.reviews.push(review);
  });
  // 신고 이력 2건
  const rv = db.reviews.filter((x) => x.rating <= 2);
  if (rv[0]) {
    rv[0].hidden = true;
    db.reports.push({ reportId: ++db.seq.report, storeId: 10, reviewId: rv[0].reviewId, reason: 'ABUSE', content: '욕설이 포함되어 있어요', reportedAt: rv[0].createdAt + 2 * 60 * MIN, status: 'ACCEPTED', processedAt: rv[0].createdAt + 20 * 60 * MIN, processNote: '비방 표현 확인' });
  }
  if (rv[1]) {
    db.reports.push({ reportId: ++db.seq.report, storeId: 10, reviewId: rv[1].reviewId, reason: 'FALSE', content: '배달 시간이 사실과 달라요', reportedAt: rv[1].createdAt + 60 * MIN, status: 'PENDING', processedAt: null, processNote: null });
  }

  // 오늘 진행 중인 주문
  const wait1 = baseOrder(now - 3 * MIN);
  const wait2 = baseOrder(now - 7 * MIN);
  const cooking1 = baseOrder(now - 15 * MIN);
  Object.assign(cooking1, { status: 'COOKING', acceptedAt: now - 13 * MIN, cookMinutes: 20, rider: riderOf(now - 8 * MIN) });
  const cooking2 = baseOrder(now - 6 * MIN);
  Object.assign(cooking2, { status: 'COOKING', acceptedAt: now - 4 * MIN, cookMinutes: 25 });
  const ready1 = baseOrder(now - 30 * MIN);
  Object.assign(ready1, { status: 'READY', acceptedAt: now - 28 * MIN, cookMinutes: 20, readyAt: now - 1 * MIN, rider: riderOf(now - 20 * MIN) });
  const deliv1 = baseOrder(now - 45 * MIN);
  const r1 = riderOf(now - 38 * MIN);
  r1.pickedUpAt = now - 5 * MIN;
  Object.assign(deliv1, { status: 'DELIVERING', acceptedAt: now - 43 * MIN, cookMinutes: 20, readyAt: now - 8 * MIN, rider: r1 });
  db.orders.push(deliv1, ready1, cooking1, cooking2, wait2, wait1);

  return db;
}

export const randomHelpers = { MIN, DAY };
