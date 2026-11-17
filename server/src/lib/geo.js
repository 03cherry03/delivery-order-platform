// 위치 계산. 라이더 기준 좌표 상수는 여기 한 곳에만 둔다(숭실대).
export const RIDER_BASE = { lat: 37.4963, lng: 126.9575 };
export const DELIVERY_RANGE_M = 3000; // 고객 주소 ↔ 가게 최대 직선거리

// 하버사인 직선거리(m, 소수). 표시할 때는 Math.round, 범위 판정은 이 값 그대로
export function distanceM(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
