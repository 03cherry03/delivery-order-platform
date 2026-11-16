'use client';

// 매출 통계: T-01 기간별 매출, T-02 메뉴별 매출
import { useMemo, useState } from 'react';
import { getMenuSales, getSales } from '@/lib/owner/api';
import { percent, toDate, won } from '@/lib/owner/format';
import { useLoad } from '@/lib/owner/hooks';
import { useStore } from '@/lib/owner/store-context';
import { Button, Card, Chips, Empty, Loading } from '@/components/owner/ui';
import s from './sales.styles';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toDate(d); };
const PRESETS = [
  { value: '7', label: '최근 7일', from: () => daysAgo(6) },
  { value: '30', label: '최근 30일', from: () => daysAgo(29) },
  { value: 'month', label: '이번 달', from: () => { const d = new Date(); d.setDate(1); return toDate(d); } },
];

export default function SalesPage() {
  const { storeId } = useStore();
  const [preset, setPreset] = useState('7');
  const [range, setRange] = useState({ from: daysAgo(6), to: daysAgo(0) });
  const [draft, setDraft] = useState(range);
  const [unit, setUnit] = useState('day');

  const { data: sales, error } = useLoad(() => getSales(storeId, { unit, ...range }), [storeId, unit, range.from, range.to]);
  const { data: menus } = useLoad(() => getMenuSales(storeId, range), [storeId, range.from, range.to]);

  function choosePreset(v) {
    const p = PRESETS.find((x) => x.value === v);
    const next = { from: p.from(), to: daysAgo(0) };
    setPreset(v);
    setRange(next);
    setDraft(next);
  }

  const sum = sales?.summary;
  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1>매출 통계</h1>
          <p className="muted small">배달완료 주문만, 배달완료일 기준이에요. 매출액은 배달팁을 뺀 주문금액이에요.</p>
        </div>
      </div>

      <div className={s.filters}>
        <Chips options={PRESETS.map(({ value, label }) => ({ value, label }))} value={preset} onChange={choosePreset} />
        <div className={s.custom}>
          <input className="input" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="시작일" />
          <span className="muted">~</span>
          <input className="input" type="date" value={draft.to} min={draft.from} max={daysAgo(0)} onChange={(e) => setDraft({ ...draft, to: e.target.value })} aria-label="종료일" />
          <Button variant="ghost" size="sm" onClick={() => { setPreset(null); setRange(draft); }}>조회</Button>
        </div>
      </div>

      {error && <div className={s.error}>{error.message}</div>}
      {!sales && !error && <Loading />}
      {sum && (
        <>
          <div className={s.kpis}>
            <Kpi label="매출액" value={won(sum.salesAmount)} strong />
            <Kpi label="주문 수" value={`${sum.orderCount.toLocaleString()}건`} />
            <Kpi label="평균 주문금액" value={won(sum.avgOrderAmount)} />
            <Kpi label="배달팁 합계" value={won(sum.deliveryTipTotal)} />
            <Kpi label="주문 접수율" value={percent(sum.acceptRate)} sub={`접수 ${sum.acceptedCount} · 거절 ${sum.rejectedCount} · 자동 취소 ${sum.autoCanceledCount}`} />
          </div>

          <Card title={unit === 'day' ? '일별 매출' : '월별 매출'} action={
            <Chips options={[{ value: 'day', label: '일별' }, { value: 'month', label: '월별' }]} value={unit} onChange={setUnit} />
          }>
            <BarChart rows={sales.rows} unit={unit} />
          </Card>
        </>
      )}

      <Card title="메뉴별 매출">
        {!menus && <Loading />}
        {menus && menus.length === 0 && <Empty>이 기간에 배달완료된 주문이 없어요</Empty>}
        {menus && menus.length > 0 && (
          <table className={s.table}>
            <thead><tr><th>순위</th><th>메뉴</th><th className={s.r}>판매 수량</th><th className={s.r}>매출액</th><th className={s.ratioCol}>비중</th></tr></thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.menuName}>
                  <td className="num">{m.rank}</td>
                  <td><b>{m.menuName}</b></td>
                  <td className={`${s.r} num`}>{m.quantity.toLocaleString()}개</td>
                  <td className={`${s.r} price`}>{won(m.salesAmount)}</td>
                  <td className={s.ratioCol}>
                    <div className={s.ratio}><div className={s.ratioBar} style={{ width: `${Math.round(m.ratio * 100)}%` }} /></div>
                    <span className="small num">{Math.round(m.ratio * 100)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, strong }) {
  return (
    <div className={`${s.kpi} ${strong ? s.kpiStrong : ''}`}>
      <span className={s.kpiLabel}>{label}</span>
      <span className={s.kpiValue}>{value}</span>
      {sub && <span className="caption">{sub}</span>}
    </div>
  );
}

// 막대그래프 (SVG). 막대에 마우스를 올리면 값이 보인다.
function BarChart({ rows, unit }) {
  const [hover, setHover] = useState(null);
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.salesAmount)), [rows]);
  if (!rows.length) return <Empty>데이터가 없어요</Empty>;
  const H = 220;
  const label = (p) => (unit === 'day' ? `${Number(p.slice(5, 7))}/${Number(p.slice(8, 10))}` : `${Number(p.slice(5, 7))}월`);
  const step = Math.ceil(rows.length / 12); // 축 라벨 간격
  const h = hover !== null ? rows[hover] : null;
  return (
    <div className={s.chart}>
      <div className={s.tooltip}>
        {h ? <><b>{h.period}</b> · {won(h.salesAmount)} · {h.orderCount}건</> : <span className="muted">막대에 마우스를 올려 보세요</span>}
      </div>
      <div className={s.bars} style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div key={r.period} className={s.barCol} onMouseEnter={() => setHover(i)}>
            <div className={`${s.bar} ${hover === i ? s.barOn : ''}`} style={{ height: `${Math.max(2, (r.salesAmount / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className={s.axis}>
        {rows.map((r, i) => <span key={r.period} className={s.tick}>{i % step === 0 ? label(r.period) : ''}</span>)}
      </div>
    </div>
  );
}
