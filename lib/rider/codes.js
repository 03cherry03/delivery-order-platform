// 라이더 명세서 코드값을 화면용 라벨로 옮긴 것

export const VEHICLE = {
  WALK: '도보',
  BICYCLE: '자전거',
  MOTORCYCLE: '오토바이',
  CAR: '자동차',
};
// D-01, D-03에서 고를 수 있는 운송수단
export const VEHICLE_OPTIONS = ['WALK', 'BICYCLE', 'MOTORCYCLE', 'CAR'];

export const RIDER_STATUS = {
  IDLE: { label: '배차 대기', tone: 'mint' },
  BUSY: { label: '배달 중', tone: 'navy' },
};

// 배달 화면 기준 주문 상태
export const ORDER_STATUS = {
  COOKING: { label: '조리중', tone: 'mint' },
  READY: { label: '픽업대기', tone: 'blue' },
  DELIVERING: { label: '배달중', tone: 'navy' },
  DONE: { label: '배달완료', tone: 'gray' },
};

// 상수 (라이더 명세서 "상수" 표)
export const DEFAULT_RIDER_LAT = 37.4963; // 숭실대
export const DEFAULT_RIDER_LNG = 126.9575;
export const DEFAULT_ACT_RADIUS_M = 3000;
export const ACT_RADIUS_MIN = 500;
export const ACT_RADIUS_MAX = 5000;

// 폴링 간격 (D-04 5초, D-06 10초)
export const POLL_DISPATCH_MS = 5000;
export const POLL_CURRENT_MS = 10000;
