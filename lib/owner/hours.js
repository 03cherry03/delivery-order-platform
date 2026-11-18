// 영업시간 변환 (S-04 규칙)
// 화면: 요일마다 [{ open, close }] — close가 open보다 이르면 자정을 넘는 영업 (예: 금 18:00~02:00)
// 서버: [{ dayOfWeek, open, close }] — 자정을 넘으면 두 요일로 나눔 (금 18:00~24:00 + 토 00:00~02:00)

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// 서버 → 화면. 다음 요일 00:00 시작 구간이 앞 요일 24:00 종료 구간과 이어지면 하나로 합친다.
export function fromServerHours(hours = []) {
  const days = Array.from({ length: 7 }, () => []);
  const sorted = [...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMin(a.open) - toMin(b.open));
  sorted.forEach((h) => days[h.dayOfWeek].push({ open: h.open, close: h.close }));

  for (let d = 0; d < 7; d++) {
    const next = (d + 1) % 7;
    const endIdx = days[d].findIndex((r) => r.close === '24:00');
    const startIdx = days[next].findIndex((r) => r.open === '00:00');
    if (endIdx >= 0 && startIdx >= 0 && days[next][startIdx].close !== '24:00') {
      days[d][endIdx] = { open: days[d][endIdx].open, close: days[next][startIdx].close };
      days[next].splice(startIdx, 1);
    }
  }
  return days;
}

// 화면 → 서버. 오류가 있으면 { error } 반환
export function toServerHours(days) {
  const out = [];
  for (let d = 0; d < 7; d++) {
    for (const r of days[d]) {
      if (!r.open || !r.close) return { error: `${'일월화수목금토'[d]}요일 시간을 모두 입력해 주세요.` };
      if (r.open === r.close) return { error: `${'일월화수목금토'[d]}요일 시작과 종료 시각이 같아요.` };
      if (toMin(r.close) < toMin(r.open) && r.close !== '24:00') {
        out.push({ dayOfWeek: d, open: r.open, close: '24:00' });
        if (r.close !== '00:00') out.push({ dayOfWeek: (d + 1) % 7, open: '00:00', close: r.close });
      } else {
        out.push({ dayOfWeek: d, open: r.open, close: r.close });
      }
    }
  }
  if (out.length === 0) return { error: '영업일이 하루는 있어야 해요. 잠시 쉬려면 일시중지를 쓰세요.' };

  // 같은 요일 구간 겹침 확인
  for (let d = 0; d < 7; d++) {
    const rs = out.filter((h) => h.dayOfWeek === d).map((h) => [toMin(h.open), toMin(h.close)]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < rs.length; i++) {
      if (rs[i][0] < rs[i - 1][1]) return { error: `${'일월화수목금토'[d]}요일 영업시간이 겹쳐요.` };
    }
  }
  return { hours: out };
}

export function emptyWeek() {
  return Array.from({ length: 7 }, (_, d) => (d === 0 ? [] : [{ open: '11:00', close: '22:00' }]));
}
