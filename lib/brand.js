// 서비스 이름. 모든 화면을 "배달의 ○○" 형태로 맞춘다. 이름을 바꾸려면 여기만 고치면 된다.
export const BRAND = {
  prefix: '배달의',          // 공통 앞부분
  customer: '배달의 동네',   // 고객 앱 = 서비스 대표 이름 (로그인 화면에도 쓴다)
  owner: '배달의 사장님',
  rider: '배달의 라이더',
  admin: '배달의 운영',
};

// 로고 글자: 앞부분은 검정, 뒷부분만 민트로 강조할 때 쓴다. ('배달의 동네' → ['배달의', '동네'])
export const brandParts = (name) => {
  const i = name.indexOf(' ');
  return i < 0 ? [name, ''] : [name.slice(0, i), name.slice(i + 1)];
};
