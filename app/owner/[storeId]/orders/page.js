'use client';

// 주문 접수 화면: O-01 목록(5초 폴링), O-02 주문서, O-03 접수, O-04 거절, O-05 조리완료, O-06 조리중 취소
import { useEffect, useMemo, useState } from 'react';
import {
  acceptOrder, cancelCookingOrder, cookedOrder, getMenus, getOrder, getOrders, rejectOrder,
} from '@/lib/owner/api';
import {
  CANCEL_ACTOR, CANCEL_REASON, COOKING_CANCEL_REASONS, ORDER_STATUS, PAY_METHOD, REJECT_REASONS, VEHICLE,
} from '@/lib/owner/codes';
import { hm, km, parseDT, remain, toDate, toDT, won } from '@/lib/owner/format';
import { useLoad, useNow } from '@/lib/owner/hooks';
import { useStore } from '@/lib/owner/store-context';
import {
  Badge, Button, Chips, Empty, Field, Loading, Modal, ModalActions, Tabs, useToast,
} from '@/components/owner/ui';
import s from './orders.styles';

const TABS = [
  { value: 'WAIT', label: '신규', hot: true },
  { value: 'COOKING', label: '조리중' },
  { value: 'READY,DELIVERING', label: '픽업대기·배달중' },
  { value: 'DONE', label: '완료' },
  { value: 'CANCEL', label: '취소' },
];
const PAGED = (t) => t === 'DONE' || t === 'CANCEL';

export default function OrdersPage() {
  const { storeId, store, reloadStore } = useStore();
  const toast = useToast();
  const now = useNow();
  const [tab, setTab] = useState('WAIT');
  const [date, setDate] = useState(() => toDate(new Date()));
  const [page, setPage] = useState(1);
  const [picked, setSelectedId] = useState(null); // 사장이 고른 주문
  const [modal, setModal] = useState(null); // 'accept' | 'reject' | 'cancel'

  // 진행 중 탭 건수 (5초마다)
  const { data: counts, reload: reloadCounts } = useLoad(async () => {
    const [w, c, r] = await Promise.all([
      getOrders(storeId, { status: 'WAIT' }),
      getOrders(storeId, { status: 'COOKING' }),
      getOrders(storeId, { status: 'READY,DELIVERING' }),
    ]);
    return { WAIT: w.length, COOKING: c.length, 'READY,DELIVERING': r.length };
  }, [storeId], 5000);

  // 현재 탭 목록 (진행 중 탭만 5초 폴링)
  const { data: listData, reload: reloadList } = useLoad(
    () => getOrders(storeId, PAGED(tab) ? { status: tab, date, page, size: 20 } : { status: tab }),
    [storeId, tab, date, page],
    PAGED(tab) ? undefined : 5000,
  );
  const list = Array.isArray(listData) ? listData : listData?.items;

  // 고른 주문이 목록에 없으면(처음, 처리 후 사라짐) 맨 위 주문을 보여준다
  const selectedId = list?.some((o) => o.orderId === picked) ? picked : (list?.[0]?.orderId ?? null);

  const { data: detail, reload: reloadDetail, setData: setDetail } = useLoad(
    () => (selectedId ? getOrder(storeId, selectedId) : null),
    [storeId, selectedId],
  );
  // 목록이 새로 고쳐질 때 주문서도 같이 (라이더 배차·상태 변화 반영)
  useEffect(() => { if (selectedId && listData) reloadDetail(); }, [listData]); // eslint-disable-line react-hooks/exhaustive-deps

  function refreshAll() {
    reloadCounts();
    reloadList();
    reloadDetail();
  }

  async function run(fn, message) {
    try {
      await fn();
      toast(message);
      setModal(null);
      refreshAll();
      reloadStore();
    } catch (e) {
      if (e.code === 'ORDER_ALREADY_PROCESSED') {
        toast('고객 취소 등으로 이미 처리된 주문이에요. 목록을 다시 불러올게요.', 'error');
        setModal(null);
        refreshAll();
      } else {
        toast(e.message, 'error');
      }
    }
  }

  const tabItems = TABS.map((t) => ({ ...t, count: counts && !PAGED(t.value) ? counts[t.value] : undefined }));

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <Tabs items={tabItems} value={tab} onChange={(v) => { setTab(v); setPage(1); setSelectedId(null); setDetail(null); }} />
        {PAGED(tab) && (
          <input className={`input ${s.date}`} type="date" value={date} max={toDate(new Date())} onChange={(e) => { setDate(e.target.value); setPage(1); }} aria-label="주문 날짜" />
        )}
      </div>

      <div className={s.split}>
        <section className={s.list} aria-label="주문 목록">
          {!list && <Loading />}
          {list && list.length === 0 && (
            <Empty mark="✓">{tab === 'WAIT' ? '새 주문이 들어오면 여기에 바로 보여요' : '주문이 없어요'}</Empty>
          )}
          {list && list.map((o) => {
            const left = o.autoCancelAt ? (parseDT(o.autoCancelAt) - now) / 1000 : null;
            return (
              <button key={o.orderId} type="button" className={`${s.item} ${o.orderId === selectedId ? s.itemOn : ''}`} onClick={() => setSelectedId(o.orderId)}>
                <div className={s.itemTop}>
                  <span className={s.itemNo}>#{o.orderId}</span>
                  <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  <span className={s.itemTime}>{hm(o.orderedAt)}</span>
                </div>
                <div className={s.itemSummary}>{o.summary}</div>
                <div className={s.itemMeta}>
                  <span className="price">{won(o.payAmount)}</span>
                  <span>·</span><span>{km(o.distance)}</span>
                  {o.riderName && <><span>·</span><span>라이더 {o.riderName}</span></>}
                  {(o.status === 'COOKING' || o.status === 'READY') && !o.riderName && <><span>·</span><span className={s.findRider}>라이더 찾는 중</span></>}
                </div>
                {o.status === 'WAIT' && (
                  <div className={`${s.countdown} ${left !== null && left < 180 ? s.urgent : ''}`}>
                    {remain(o.autoCancelAt, now)} 안에 접수하지 않으면 자동 취소돼요
                  </div>
                )}
              </button>
            );
          })}
          {PAGED(tab) && listData && listData.totalCount > listData.size && (
            <div className={s.pager}>
              <Button variant="text" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ 이전</Button>
              <span className="small muted num">{page} / {Math.ceil(listData.totalCount / listData.size)}</span>
              <Button variant="text" size="sm" disabled={page * listData.size >= listData.totalCount} onClick={() => setPage(page + 1)}>다음 ›</Button>
            </div>
          )}
        </section>

        <section className={s.detail} aria-label="주문서">
          {!selectedId && <Empty>주문을 고르면 주문서가 보여요</Empty>}
          {selectedId && !detail && <Loading />}
          {detail && (
            <OrderSheet
              o={detail}
              now={now}
              onAccept={() => setModal('accept')}
              onReject={() => setModal('reject')}
              onCooked={() => run(() => cookedOrder(storeId, detail.orderId), '조리완료! 라이더가 픽업할 수 있어요')}
              onCancel={() => setModal('cancel')}
            />
          )}
        </section>
      </div>

      {detail && modal === 'accept' && (
        <AcceptModal defaultMinutes={store.cookMinutes} onClose={() => setModal(null)}
          onSubmit={(m) => run(() => acceptOrder(storeId, detail.orderId, m), `접수했어요. ${m}분 안에 조리해 주세요`)} />
      )}
      {detail && modal === 'reject' && (
        <ReasonModal mode="reject" order={detail} storeId={storeId} onClose={() => setModal(null)}
          onSubmit={(body) => run(() => rejectOrder(storeId, detail.orderId, body), '주문을 거절했어요')} />
      )}
      {detail && modal === 'cancel' && (
        <ReasonModal mode="cancel" order={detail} storeId={storeId} onClose={() => setModal(null)}
          onSubmit={(body) => run(() => cancelCookingOrder(storeId, detail.orderId, body), '주문을 취소했어요')} />
      )}
    </div>
  );
}

const AUTO_CANCEL_MIN = 10; // 명세서 상수: 주문일시 + 10분까지 WAIT이면 자동 취소

function OrderSheet({ o, now, onAccept, onReject, onCooked, onCancel }) {
  const st = ORDER_STATUS[o.status];
  const autoCancelAt = o.status === 'WAIT'
    ? toDT(new Date(parseDT(o.orderedAt).getTime() + AUTO_CANCEL_MIN * 60000))
    : null;
  const readyBy = o.acceptedAt && o.cookMinutes ? new Date(parseDT(o.acceptedAt).getTime() + o.cookMinutes * 60000) : null;
  return (
    <div className={s.sheet}>
      <div className={s.sheetHead}>
        <div>
          <div className={s.sheetTitle}>주문 #{o.orderId} <Badge tone={st.tone}>{st.label}</Badge></div>
          <p className="small muted">{o.orderedAt} 주문 · {PAY_METHOD[o.payMethod]} 결제</p>
        </div>
      </div>

      {autoCancelAt && (
        <div className={s.alert}>
          <span className="price">{remain(autoCancelAt, now)}</span> 안에 접수하지 않으면 자동 취소돼요
        </div>
      )}
      {o.status === 'COOKING' && readyBy && (
        <div className={s.info}>조리 예상 {o.cookMinutes}분 · {String(readyBy.getHours()).padStart(2, '0')}:{String(readyBy.getMinutes()).padStart(2, '0')}까지</div>
      )}
      {o.status === 'CANCEL' && (
        <div className={s.cancelBox}>
          <b>{CANCEL_ACTOR[o.cancelActor]} 취소</b> · {CANCEL_REASON[o.cancelReason] || '-'}
          {o.cancelReasonDetail && <> · {o.cancelReasonDetail}</>}
          <div className="small">{o.canceledAt}</div>
        </div>
      )}

      <div className={s.block}>
        <h3 className={s.blockTitle}>메뉴 {o.items.length}개</h3>
        {o.items.map((it, i) => (
          <div key={i} className={s.line}>
            <div className={s.lineMain}>
              <div><b>{it.menuName}</b> <span className="muted">× {it.quantity}</span></div>
              {it.options.map((op, j) => (
                <div key={j} className={s.opt}>└ {op.groupName}: {op.optionName}{op.price > 0 && ` (+${won(op.price)})`}</div>
              ))}
            </div>
            <span className="price">{won(it.lineTotal)}</span>
          </div>
        ))}
        <div className={s.totals}>
          <div><span>주문금액</span><span className="num">{won(o.orderTotal)}</span></div>
          <div><span>배달팁</span><span className="num">{won(o.deliveryTip)}</span></div>
          <div className={s.grand}><span>결제금액</span><span className="price">{won(o.payAmount)}</span></div>
        </div>
      </div>

      <div className={s.block}>
        <h3 className={s.blockTitle}>요청사항</h3>
        <dl className={s.dl}>
          <dt>가게</dt><dd>{o.storeRequest || <span className="muted">없음</span>}</dd>
          <dt>라이더</dt><dd>{o.riderRequest || <span className="muted">없음</span>}</dd>
          <dt>수저·포크</dt><dd>{o.cutlery ? '필요해요' : '안 받을게요'}</dd>
        </dl>
      </div>

      <div className={s.block}>
        <h3 className={s.blockTitle}>배달</h3>
        <dl className={s.dl}>
          <dt>주소</dt><dd>{o.deliveryAddress}{o.deliveryAddressDetail && ` ${o.deliveryAddressDetail}`}</dd>
          <dt>거리</dt><dd>{km(o.distance)}</dd>
          <dt>라이더</dt>
          <dd>
            {o.rider
              ? <>{o.rider.name} · {VEHICLE[o.rider.vehicle] || o.rider.vehicle} · {hm(o.rider.dispatchedAt)} 배차{o.rider.pickedUpAt && ` · ${hm(o.rider.pickedUpAt)} 픽업`}</>
              : (o.status === 'COOKING' || o.status === 'READY') ? <span className={s.findRider}>근처 라이더를 찾고 있어요</span> : <span className="muted">-</span>}
          </dd>
        </dl>
      </div>

      {(o.status === 'WAIT' || o.status === 'COOKING') && (
        <div className={s.actions}>
          {o.status === 'WAIT' && <>
            <Button variant="ghost" size="lg" onClick={onReject}>거절</Button>
            <Button variant="mint" size="lg" onClick={onAccept} className={s.mainAction}>접수하기</Button>
          </>}
          {o.status === 'COOKING' && <>
            <Button variant="ghost" size="lg" onClick={onCancel}>조리중 취소</Button>
            <Button size="lg" onClick={onCooked} className={s.mainAction}>조리완료</Button>
          </>}
        </div>
      )}
    </div>
  );
}

function AcceptModal({ defaultMinutes, onSubmit, onClose }) {
  const [minutes, setMinutes] = useState(defaultMinutes);
  const quick = [10, 15, 20, 25, 30, 40, 50, 60];
  return (
    <Modal open title="조리 예상 시간" desc="손님과 라이더에게 이 시간으로 안내돼요. 가게 기본값이 미리 들어 있어요." onClose={onClose}>
      <div className={s.minutes}>
        <button type="button" className={s.step} onClick={() => setMinutes(Math.max(1, minutes - 5))} aria-label="5분 줄이기">−</button>
        <div className={s.minuteValue}><span className="price">{minutes}</span>분</div>
        <button type="button" className={s.step} onClick={() => setMinutes(minutes + 5)} aria-label="5분 늘리기">+</button>
      </div>
      <Chips options={quick.map((q) => ({ value: q, label: `${q}분` }))} value={minutes} onChange={setMinutes} />
      <ModalActions>
        <Button variant="ghost" size="md" onClick={onClose}>닫기</Button>
        <Button variant="mint" size="md" onClick={() => onSubmit(minutes)}>{minutes}분으로 접수</Button>
      </ModalActions>
    </Modal>
  );
}

function ReasonModal({ mode, order, storeId, onSubmit, onClose }) {
  const reasons = mode === 'reject' ? REJECT_REASONS : COOKING_CANCEL_REASONS;
  const [reason, setReason] = useState(reasons[0]);
  const [detail, setDetail] = useState('');
  const [soldOutPicked, setSoldOut] = useState(null); // null이면 기본값(주문에 든 메뉴 전부)
  const [busy, setBusy] = useState(false);
  const { data: menus } = useLoad(() => (mode === 'reject' ? getMenus(storeId) : null), [storeId, mode]);

  // 재료 소진: 이 주문에 든 메뉴를 품절 후보로 미리 체크
  const orderMenus = useMemo(() => {
    if (!menus) return [];
    const names = new Set(order.items.map((it) => it.menuName));
    return menus.flatMap((c) => c.menus).filter((m) => names.has(m.menuName) && m.saleStatus === 'ON_SALE');
  }, [menus, order]);
  const soldOut = soldOutPicked ?? orderMenus.map((m) => m.menuId);

  const needDetail = reason === 'ETC';
  async function submit() {
    setBusy(true);
    const body = { reason, reasonDetail: needDetail ? detail.trim() : null };
    if (mode === 'reject' && reason === 'OUT_OF_STOCK' && soldOut.length) body.soldOutMenuIds = soldOut;
    await onSubmit(body);
    setBusy(false);
  }

  return (
    <Modal open title={mode === 'reject' ? '주문을 거절할까요?' : '조리중인 주문을 취소할까요?'}
      desc="결제는 취소되고, 포인트로 결제했다면 바로 돌려드려요." onClose={onClose}>
      <Field label="사유">
        <Chips options={reasons.map((r) => ({ value: r, label: CANCEL_REASON[r] }))} value={reason} onChange={setReason} />
      </Field>
      {needDetail && (
        <div style={{ marginTop: 16 }}>
          <Field label="직접 입력" required>
            <input className="input" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} placeholder="손님에게 보여줄 사유" />
          </Field>
        </div>
      )}
      {mode === 'reject' && reason === 'OUT_OF_STOCK' && orderMenus.length > 0 && (
        <div className={s.soldOut}>
          <div className={s.soldOutTitle}>함께 품절 처리할 메뉴</div>
          {orderMenus.map((m) => (
            <label key={m.menuId} className={s.check}>
              <input type="checkbox" checked={soldOut.includes(m.menuId)}
                onChange={(e) => setSoldOut(e.target.checked ? [...soldOut, m.menuId] : soldOut.filter((x) => x !== m.menuId))} />
              {m.menuName}
            </label>
          ))}
        </div>
      )}
      <ModalActions>
        <Button variant="ghost" size="md" onClick={onClose}>닫기</Button>
        <Button variant="danger" size="md" disabled={busy || (needDetail && !detail.trim())} onClick={submit}>
          {mode === 'reject' ? '거절하기' : '취소하기'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
