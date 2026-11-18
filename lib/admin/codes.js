// 명세서 "코드값" 표를 화면용 라벨로 옮긴 것

export const ORDER_STATUS = {
  WAIT: { label: '신규', tone: 'orange' },
  COOKING: { label: '조리중', tone: 'mint' },
  READY: { label: '픽업대기', tone: 'blue' },
  DELIVERING: { label: '배달중', tone: 'navy' },
  DONE: { label: '배달완료', tone: 'gray' },
  CANCEL: { label: '취소', tone: 'red' },
};

export const CANCEL_ACTOR = {
  CUSTOMER: '고객',
  OWNER: '가게',
  SYSTEM: '자동 취소',
  ADMIN: '고객센터',
};

export const CANCEL_REASON = {
  OUT_OF_STOCK: '재료 소진',
  BUSY: '주문 폭주',
  CLOSING: '영업 마감',
  CANNOT_COOK: '조리 불가',
  NO_RESPONSE: '가게 미응답',
  CUSTOMER_REQUEST: '고객 요청',
  STORE_ISSUE: '가게 사정',
  DELIVERY_FAIL: '배달 불가',
  ETC: '기타',
};

// O-04 거절, O-06 조리중 취소에서 고를 수 있는 사유
export const REJECT_REASONS = ['OUT_OF_STOCK', 'BUSY', 'CLOSING', 'ETC'];
export const COOKING_CANCEL_REASONS = ['OUT_OF_STOCK', 'CANNOT_COOK', 'ETC'];

export const OPER_STATUS = {
  OPEN: { label: '영업중', tone: 'mint' },
  PAUSED: { label: '일시중지', tone: 'orange' },
  CLOSED: { label: '영업시간 외', tone: 'gray' },
};

export const APPROVAL_STATUS = {
  PENDING: { label: '승인대기', tone: 'orange' },
  APPROVED: { label: '승인', tone: 'mint' },
  REJECTED: { label: '반려', tone: 'red' },
};

export const SALE_STATUS = {
  ON_SALE: { label: '판매중', tone: 'mint' },
  SOLD_OUT: { label: '품절', tone: 'red' },
};

export const REPORT_REASON = {
  ABUSE: '욕설·비방',
  FALSE: '허위 사실',
  UNRELATED: '주문과 무관',
  ETC: '기타',
};

export const REPORT_STATUS = {
  PENDING: { label: '처리 대기', tone: 'orange' },
  ACCEPTED: { label: '숨김 처리', tone: 'mint' },
  REJECTED: { label: '기각', tone: 'gray' },
};

export const PAY_METHOD = {
  CARD: '카드',
  KAKAO: '카카오페이',
  NAVER: '네이버페이',
  POINT: '포인트',
};

export const VEHICLE = {
  WALK: '도보',
  BICYCLE: '자전거',
  MOTORCYCLE: '오토바이',
  CAR: '자동차',
};

// server/docs/api/README.md의 현재 가게 카테고리 코드값.
export const STORE_CATEGORY = {
  CHICKEN: '치킨',
  PIZZA: '피자',
  KOREAN: '한식',
  CHINESE: '중식',
  JAPANESE: '일식',
  SNACK: '분식',
  CAFE: '카페·디저트',
  ETC: '기타',
};

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
