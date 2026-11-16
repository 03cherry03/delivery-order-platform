// 가짜 서버의 처음 데이터. db/seed.sql(실제 DB 샘플 데이터)과 같은 사람·가게·상태로 맞췄다.
// 시각만 "지금" 기준으로 바꿔서, 언제 열어도 진행 중인 배달처럼 보이게 했다.
//   rider1@test.com 최라이더 : 배차 대기(IDLE). 배차 요청 2건(주문 7 픽업대기, 주문 6 조리중)을 수락할 수 있다
//   rider2@test.com 정라이더 : 주문 9 픽업 후 배달 중 → 배달 완료 가능
//   rider3@test.com 한라이더 : 주문 8 배차됨, 조리 완료 → 픽업 가능
// 모든 비밀번호 test1234

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const STORES = [
  { storeId: 1, name: '상도 바삭치킨', address: '서울특별시 동작구 상도로 150', tel: '02-000-0001', lat: 37.4982, lng: 126.9525 },
  { storeId: 2, name: '엄마손 한식당', address: '서울특별시 동작구 상도로 180', tel: '02-000-0002', lat: 37.4978, lng: 126.9532 },
  { storeId: 3, name: '숭실 반점', address: '서울특별시 동작구 사당로 60', tel: '02-000-0003', lat: 37.4868, lng: 126.9605 },
];

// 데모용 새 배차 요청을 만들 때 쓰는 배달지
export const ADDRESS_POOL = [
  ['서울특별시 동작구 상도로 100', '101동 1001호', 37.4990, 126.9500, 8],
  ['서울특별시 동작구 상도로 120', '202호', 37.4988, 126.9510, 9],
  ['서울특별시 동작구 사당로 50', '3층', 37.4870, 126.9600, 10],
  ['서울특별시 동작구 사당로 80', null, 37.4865, 126.9620, 11],
  ['서울특별시 동작구 상도로 200', '502호', 37.4975, 126.9540, 12],
  ['서울특별시 동작구 상도로 369', '정보과학관 101호', 37.4963, 126.9575, 8],
];
export const MENU_POOL = {
  1: ['후라이드치킨', '양념치킨', '치즈볼', '콜라 1.25L'],
  2: ['김치찌개', '제육볶음', '공기밥'],
  3: ['짜장면', '짬뽕', '탕수육'],
};
export const RIDER_REQ_POOL = ['문 앞에 두고 벨 눌러주세요', '도착하면 전화 주세요', null, '경비실에 맡겨주세요', null];

export function createSeed(now = Date.now()) {
  const users = [
    { memberId: 5, email: 'rider1@test.com', password: 'test1234', name: '최라이더', tel: '010-0000-0005', role: 'RIDER', status: 'ACTIVE' },
    { memberId: 6, email: 'rider2@test.com', password: 'test1234', name: '정라이더', tel: '010-0000-0006', role: 'RIDER', status: 'ACTIVE' },
    { memberId: 7, email: 'rider3@test.com', password: 'test1234', name: '한라이더', tel: '010-0000-0007', role: 'RIDER', status: 'ACTIVE' },
    { memberId: 8, email: 'user1@test.com', password: 'test1234', name: '홍길동', tel: '010-1000-0008', role: 'CUSTOMER', status: 'ACTIVE' },
    { memberId: 9, email: 'user2@test.com', password: 'test1234', name: '김민지', tel: '010-1000-0009', role: 'CUSTOMER', status: 'ACTIVE' },
    { memberId: 10, email: 'user3@test.com', password: 'test1234', name: '이준호', tel: '010-1000-0010', role: 'CUSTOMER', status: 'ACTIVE' },
    { memberId: 11, email: 'user4@test.com', password: 'test1234', name: '박서연', tel: '010-1000-0011', role: 'CUSTOMER', status: 'ACTIVE' },
    { memberId: 12, email: 'user5@test.com', password: 'test1234', name: '최유나', tel: '010-1000-0012', role: 'CUSTOMER', status: 'ACTIVE' },
  ];
  const riders = {
    5: { vehicleType: 'MOTORCYCLE', actRadiusM: 3000, status: 'IDLE' },
    6: { vehicleType: 'BICYCLE', actRadiusM: 2000, status: 'BUSY' },
    7: { vehicleType: 'WALK', actRadiusM: 1000, status: 'BUSY' },
  };

  // 배달 1건 = TB_DLVR 1행 + 라이더 화면에 필요한 TB_ORD 값
  const d = (o) => ({
    riderId: null, dispatchedAt: null, pickedUpAt: null, completedAt: null, takeByOtherAt: null,
    addressDetail: null, riderRequest: null, ...o,
  });
  const deliveries = [
    // 진행 중
    d({ deliveryId: 4, orderId: 9, storeId: 1, customerId: 11, orderStatus: 'DELIVERING', items: ['후라이드치킨'], tip: 3000,
      address: '서울특별시 동작구 사당로 80', lat: 37.4865, lng: 126.9620, riderRequest: '도착하면 전화 주세요',
      acceptedAt: now - 35 * MIN, cookMinutes: 20, createdAt: now - 35 * MIN,
      riderId: 6, dispatchedAt: now - 27 * MIN, pickedUpAt: now - 10 * MIN }),
    d({ deliveryId: 5, orderId: 7, storeId: 1, customerId: 12, orderStatus: 'READY', items: ['양념치킨'], tip: 3000,
      address: '서울특별시 동작구 상도로 200', addressDetail: '502호', lat: 37.4975, lng: 126.9540,
      riderRequest: '아이가 자고 있어요. 노크만 해주세요', acceptedAt: now - 25 * MIN, cookMinutes: 20, createdAt: now - 25 * MIN }),
    d({ deliveryId: 6, orderId: 8, storeId: 2, customerId: 10, orderStatus: 'READY', items: ['제육볶음', '김치찌개'], tip: 2000,
      address: '서울특별시 동작구 사당로 50', addressDetail: '3층', lat: 37.4870, lng: 126.9600,
      acceptedAt: now - 24 * MIN, cookMinutes: 20, createdAt: now - 24 * MIN, riderId: 7, dispatchedAt: now - 15 * MIN }),
    d({ deliveryId: 7, orderId: 6, storeId: 3, customerId: 9, orderStatus: 'COOKING', items: ['짬뽕'], tip: 2500,
      address: '서울특별시 동작구 상도로 120', addressDetail: '202호', lat: 37.4988, lng: 126.9510,
      riderRequest: '경비실에 맡겨주세요', acceptedAt: now - 23 * MIN, cookMinutes: 25, createdAt: now - 23 * MIN }),
    // 완료 (배달 내역)
    d({ deliveryId: 3, orderId: 3, storeId: 3, customerId: 11, orderStatus: 'DONE', items: ['탕수육', '짜장면'], tip: 2500,
      address: '서울특별시 동작구 사당로 80', lat: 37.4865, lng: 126.9620,
      acceptedAt: now - 3 * 60 * MIN, cookMinutes: 25, createdAt: now - 3 * 60 * MIN, riderId: 5,
      dispatchedAt: now - 173 * MIN, pickedUpAt: now - 153 * MIN, completedAt: now - 135 * MIN }),
    d({ deliveryId: 2, orderId: 2, storeId: 2, customerId: 9, orderStatus: 'DONE', items: ['김치찌개', '공기밥'], tip: 2000,
      address: '서울특별시 동작구 상도로 120', addressDetail: '202호', lat: 37.4988, lng: 126.9510,
      acceptedAt: now - DAY - 60 * MIN, cookMinutes: 15, createdAt: now - DAY - 60 * MIN, riderId: 6,
      dispatchedAt: now - DAY - 57 * MIN, pickedUpAt: now - DAY - 45 * MIN, completedAt: now - DAY - 22 * MIN }),
    d({ deliveryId: 1, orderId: 1, storeId: 1, customerId: 8, orderStatus: 'DONE', items: ['양념치킨', '콜라 1.25L'], tip: 3000,
      address: '서울특별시 동작구 상도로 100', addressDetail: '101동 1001호', lat: 37.4990, lng: 126.9500,
      acceptedAt: now - 2 * DAY, cookMinutes: 20, createdAt: now - 2 * DAY, riderId: 5,
      dispatchedAt: now - 2 * DAY + 8 * MIN, pickedUpAt: now - 2 * DAY + 20 * MIN, completedAt: now - 2 * DAY + 38 * MIN }),
  ];

  // 라이더 1의 지난 배달 내역 (페이지 넘김 확인용)
  let id = 100;
  for (let day = 3; day <= 12; day++) {
    for (let k = 0; k < 3; k++) {
      const store = STORES[(day + k) % 3];
      const [address, detail, lat, lng, customerId] = ADDRESS_POOL[(day * 3 + k) % ADDRESS_POOL.length];
      const t = now - day * DAY + (k * 3 + 1) * 60 * MIN;
      deliveries.push(d({
        deliveryId: ++id, orderId: 500 + id, storeId: store.storeId, customerId, orderStatus: 'DONE',
        items: [MENU_POOL[store.storeId][k % MENU_POOL[store.storeId].length]], tip: [3000, 2000, 2500][store.storeId - 1],
        address, addressDetail: detail, lat, lng, acceptedAt: t, cookMinutes: 20, createdAt: t, riderId: 5,
        dispatchedAt: t + 5 * MIN, pickedUpAt: t + 20 * MIN, completedAt: t + 38 * MIN,
      }));
    }
  }

  return {
    seq: { member: 12, delivery: id, order: 900 },
    session: null,
    lastSpawn: now,
    users,
    riders,
    deliveries,
  };
}
