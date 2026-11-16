'use client';

// D-09 배달 내역 (완료한 배달만, 최신순, 페이지 20건) + 오늘 완료 건수·배달팁 합계
import { useEffect, useState } from 'react';
import { getDeliveryHistory } from '@/lib/rider/api';
import { won, mdhm, hm, parseDT, toDate } from '@/lib/rider/format';
import { Button, Empty, Loading, LoadError } from '@/components/rider/ui';

const SIZE = 20;

// 'YYYY-MM-DD ...' → '오늘' / '어제' / '11월 14일 (금)'
function dayLabel(dt) {
  const d = parseDT(dt);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (toDate(d) === toDate(today)) return '오늘';
  if (toDate(d) === toDate(yest)) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
}

export default function HistoryPage() {
  const [pages, setPages] = useState([]); // 불러온 페이지들
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); // 더 보기, 다시 시도 중

  async function load(page) {
    setLoading(true);
    setError(null);
    try {
      const data = await getDeliveryHistory(page, SIZE);
      setPages((p) => (page === 1 ? [data] : [...p, data]));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    getDeliveryHistory(1, SIZE).then((data) => setPages([data])).catch(setError);
  }, []);

  const first = pages[0];
  const last = pages[pages.length - 1];
  const items = pages.flatMap((p) => p.items);
  const hasMore = last && last.page * last.size < last.totalCount;

  // 날짜별로 묶기
  const groups = [];
  for (const it of items) {
    const label = dayLabel(it.completedAt);
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(it);
  }

  return (
    <div className="rd-page">
      <div className="rd-pageHead"><h1>배달 내역</h1></div>

      {!first && !error && <Loading />}
      {!first && error && <LoadError error={error} onRetry={() => load(1)} />}

      {first && (
        <>
          <section className="rd-today" aria-label="오늘 요약">
            <div>
              <p className="rd-todayLabel">오늘 완료</p>
              <p className="rd-todayVal">{first.todayCount}<small>건</small></p>
            </div>
            <div>
              <p className="rd-todayLabel">오늘 배달팁</p>
              <p className="rd-todayVal">{won(first.todayTipSum)}</p>
            </div>
            <div>
              <p className="rd-todayLabel">전체 완료</p>
              <p className="rd-todayVal">{first.totalCount}<small>건</small></p>
            </div>
          </section>

          {items.length === 0 && <Empty mark="✓" title="아직 완료한 배달이 없어요">첫 배달을 완료하면 여기에 쌓여요.</Empty>}

          {groups.map((g) => (
            <section key={g.label} className="rd-histGroup">
              <h2 className="rd-histDay">{g.label}</h2>
              <ul className="rd-histList">
                {g.items.map((it) => (
                  <li key={it.deliveryId} className="rd-hist">
                    <div className="rd-histMain">
                      <p className="rd-histStore">{it.storeName}</p>
                      <p className="rd-histAddr">{it.deliveryAddress}</p>
                      <p className="rd-histTime">픽업 {hm(it.pickedUpAt)} → 완료 {mdhm(it.completedAt)} · 주문 #{it.orderId}</p>
                    </div>
                    <span className="rd-histTip">{won(it.deliveryTip)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {error && <LoadError error={error} onRetry={() => load(last.page + 1)} />}
          {hasMore && !error && (
            <Button variant="ghost" size="md" full disabled={loading} onClick={() => load(last.page + 1)}>
              {loading ? '불러오는 중' : `더 보기 (${items.length}/${last.totalCount})`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
