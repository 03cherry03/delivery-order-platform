'use client';

// 요일별 영업시간 입력 (S-04). 한 요일에 시간대를 여러 개 넣으면 브레이크타임,
// 시간대가 없으면 휴무일. 종료가 시작보다 이르면 자정을 넘는 영업으로 본다.
import { DAY_NAMES } from '@/lib/owner/codes';
import { Button, Switch } from './ui';
import s from './HoursEditor.styles';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터 보여준다

export default function HoursEditor({ value, onChange }) {
  const setDay = (d, ranges) => onChange(value.map((r, i) => (i === d ? ranges : r)));

  return (
    <div className={s.list}>
      {ORDER.map((d) => {
        const ranges = value[d];
        const open = ranges.length > 0;
        return (
          <div key={d} className={s.row}>
            <div className={s.day}>
              <span className={d === 0 ? s.sun : d === 6 ? s.sat : undefined}>{DAY_NAMES[d]}</span>
              <Switch on={open} label={`${DAY_NAMES[d]}요일 영업`} onChange={(on) => setDay(d, on ? [{ open: '11:00', close: '22:00' }] : [])} />
            </div>
            <div className={s.ranges}>
              {!open && <span className={s.off}>휴무</span>}
              {ranges.map((r, i) => {
                const overnight = r.open && r.close && r.close < r.open && r.close !== '24:00';
                return (
                  <div key={i} className={s.range}>
                    <input className={`input ${s.time}`} type="time" value={r.open} aria-label="시작"
                      onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                    <span className="muted">~</span>
                    <input className={`input ${s.time}`} type="time" value={r.close === '24:00' ? '00:00' : r.close} aria-label="종료"
                      onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
                    {overnight && <span className={s.next}>다음날</span>}
                    {ranges.length > 1 && (
                      <button type="button" className={s.remove} aria-label="시간대 삭제" onClick={() => setDay(d, ranges.filter((_, j) => j !== i))}>×</button>
                    )}
                  </div>
                );
              })}
              {open && ranges.length < 3 && (
                <Button variant="text" size="sm" onClick={() => setDay(d, [...ranges, { open: '17:00', close: '22:00' }])}>+ 시간대 추가</Button>
              )}
            </div>
          </div>
        );
      })}
      <p className="caption">점심·저녁 사이에 쉬면 시간대를 두 개 넣어 주세요. 종료가 시작보다 이르면 다음날까지 영업하는 걸로 저장돼요.</p>
    </div>
  );
}
