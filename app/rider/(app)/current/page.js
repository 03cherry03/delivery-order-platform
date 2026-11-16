'use client';

// 현재 배달 = D-06 (10초 폴링: 사장의 조리 완료, 주문 취소를 반영) + D-07 픽업 완료 + D-08 배달 완료
// 버튼 규칙: orderStatus가 READY일 때만 [픽업 완료], DELIVERING일 때만 [배달 완료]
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getCurrentDelivery, pickupDelivery, completeDelivery } from '@/lib/rider/api';
import { useLoad, useNow } from '@/lib/rider/hooks';
import { ORDER_STATUS, POLL_CURRENT_MS } from '@/lib/rider/codes';
import { won, hm, readyText } from '@/lib/rider/format';
import { Badge, Button, Card, Empty, Loading, LoadError, Modal, ModalActions, useToast } from '@/components/rider/ui';
import { useRiderCtx } from '@/components/rider/RiderShell';

// 카카오맵 길찾기 링크 (앱이 있으면 앱으로 열림)
const mapLink = (name, lat, lng) => `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;

const STEPS = [
  { key: 'dispatch', label: '배차' },
  { key: 'pickup', label: '픽업' },
  { key: 'done', label: '배달 완료' },
];
// 지금 하고 있는 단계: 배차는 이미 끝났으니 픽업(1) 또는 배달 완료(2)
const stepIndex = (status) => (status === 'DELIVERING' ? 2 : 1);

export default function CurrentDeliveryPage() {
  const router = useRouter();
  const toast = useToast();
  const { reload: reloadMe } = useRiderCtx();
  const { data: d, error, reload } = useLoad(getCurrentDelivery, [], POLL_CURRENT_MS);
  const now = useNow(15000);
  const [busy, setBusy] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const lastId = useRef(null);
  const finishedByMe = useRef(false);

  // 보고 있던 배달이 내가 완료하지 않았는데 사라짐 = 주문 취소 (명세서 "주문이 취소되면")
  useEffect(() => {
    if (d === undefined) return;
    if (d) {
      lastId.current = d.deliveryId;
    } else if (lastId.current && !finishedByMe.current) {
      toast('주문이 취소되어 배달이 끝났어요', 'error');
      lastId.current = null;
      reloadMe();
    }
  }, [d, toast, reloadMe]);

  async function run(fn, okMsg) {
    setBusy(true);
    try {
      const res = await fn();
      if (okMsg) toast(okMsg);
      return res;
    } catch (err) {
      toast(err.message, 'error');
      reload(); // NOT_READY, NOT_PICKED_UP, ORDER_ALREADY_PROCESSED → 지금 상태 다시 보기
      return null;
    } finally {
      setBusy(false);
    }
  }

  const pickup = () => run(() => pickupDelivery(d.deliveryId), '픽업 완료! 배달지로 출발하세요').then((res) => res && reload());

  async function complete() {
    finishedByMe.current = true;
    const res = await run(() => completeDelivery(d.deliveryId));
    setConfirmDone(false);
    if (!res) { finishedByMe.current = false; return; }
    toast(`배달 완료! 배달팁 ${won(d.deliveryTip)}`);
    await reloadMe();
    router.push('/rider'); // 명세서 D-08: 배차 대기 목록으로
  }

  if (d === undefined && !error) return <Loading />;
  if (d === undefined && error) return <div className="rd-page"><LoadError error={error} onRetry={reload} /></div>;
  if (d === null) {
    return (
      <div className="rd-page">
        <div className="rd-pageHead"><h1>현재 배달</h1></div>
        <Empty mark="✓" title="진행 중인 배달이 없어요">
          배차 대기 목록에서 새 배차를 잡아 보세요.
          <div className="rd-emptyAct"><Link href="/rider" className="rd-btn rd-btn-primary rd-btn-md">배차 대기 목록</Link></div>
        </Empty>
      </div>
    );
  }

  const st = ORDER_STATUS[d.orderStatus];
  const idx = stepIndex(d.orderStatus);
  const goingToStore = d.orderStatus !== 'DELIVERING';

  return (
    <div className="rd-page rd-pageAction">
      <div className="rd-pageHead">
        <h1>현재 배달</h1>
        <span className="rd-live"><span className="rd-liveDot" />{POLL_CURRENT_MS / 1000}초마다 새로고침</span>
      </div>

      <section className="rd-hero">
        <div className="rd-heroTop">
          <Badge tone={st?.tone}>{st?.label}</Badge>
          <span className="rd-heroNo">주문 #{d.orderId}</span>
        </div>
        <p className="rd-heroMsg">
          {d.orderStatus === 'COOKING' && <>가게로 이동하세요.<br />{readyText(d.orderStatus, d.expectedReadyAt, now)}</>}
          {d.orderStatus === 'READY' && <>음식이 준비됐어요.<br />가게에서 픽업해 주세요</>}
          {d.orderStatus === 'DELIVERING' && <>배달지로 이동 중<br />{d.delivery.address}</>}
        </p>
        <ol className="rd-steps" aria-label="배달 단계">
          {STEPS.map((s, i) => (
            <li key={s.key} className={i < idx ? 'rd-stepDone' : i === idx ? 'rd-stepOn' : ''}>
              <span className="rd-stepDot" />
              <span className="rd-stepLabel">{s.label}</span>
              <span className="rd-stepTime">
                {i === 0 && hm(d.dispatchedAt)}
                {i === 1 && (d.pickedUpAt ? hm(d.pickedUpAt) : '')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Card className={goingToStore ? 'rd-cardFocus' : ''} title={<h3><span className="rd-pin rd-pinStore" aria-hidden="true" /> 가게</h3>}
        action={<a className="rd-mapLink" href={mapLink(d.store.name, d.store.lat, d.store.lng)} target="_blank" rel="noreferrer">길찾기</a>}>
        <p className="rd-placeName">{d.store.name}</p>
        <p className="rd-placeAddr">{d.store.address}</p>
        <div className="rd-placeActs">
          <a className="rd-btn rd-btn-ghost rd-btn-sm" href={`tel:${d.store.tel}`}>가게 전화 {d.store.tel}</a>
        </div>
        <dl className="rd-kv">
          <div><dt>메뉴</dt><dd>{d.itemSummary} <span className="rd-muted">({d.itemCount}개 메뉴)</span></dd></div>
          <div><dt>조리 완료</dt><dd>{d.orderStatus === 'COOKING' ? `${hm(d.expectedReadyAt)} 예정` : '완료'}</dd></div>
        </dl>
      </Card>

      <Card className={!goingToStore ? 'rd-cardFocus' : ''} title={<h3><span className="rd-pin rd-pinDest" aria-hidden="true" /> 배달지</h3>}
        action={<a className="rd-mapLink" href={mapLink('배달지', d.delivery.lat, d.delivery.lng)} target="_blank" rel="noreferrer">길찾기</a>}>
        <p className="rd-placeName">{d.delivery.address}</p>
        {d.delivery.addressDetail && <p className="rd-placeAddr">{d.delivery.addressDetail}</p>}
        {d.delivery.riderRequest && <p className="rd-request">“{d.delivery.riderRequest}”</p>}
        {d.delivery.customerTel && (
          <div className="rd-placeActs">
            <a className="rd-btn rd-btn-ghost rd-btn-sm" href={`tel:${d.delivery.customerTel}`}>고객 전화 {d.delivery.customerTel}</a>
          </div>
        )}
        <dl className="rd-kv">
          <div><dt>배달팁</dt><dd className="rd-strong">{won(d.deliveryTip)}</dd></div>
        </dl>
      </Card>

      <div className="rd-actionBar">
        {d.orderStatus === 'COOKING' && <Button size="lg" full disabled>조리 중이에요 · 완료되면 픽업할 수 있어요</Button>}
        {d.orderStatus === 'READY' && <Button variant="mint" size="lg" full disabled={busy} onClick={pickup}>{busy ? '처리하는 중' : '픽업 완료'}</Button>}
        {d.orderStatus === 'DELIVERING' && <Button size="lg" full disabled={busy} onClick={() => setConfirmDone(true)}>배달 완료</Button>}
      </div>

      <Modal open={confirmDone} title="배달을 완료할까요?" desc={`${d.delivery.address}${d.delivery.addressDetail ? ` ${d.delivery.addressDetail}` : ''}에 전달했는지 확인해 주세요.`} onClose={() => !busy && setConfirmDone(false)}>
        <ModalActions>
          <Button variant="ghost" size="md" disabled={busy} onClick={() => setConfirmDone(false)}>아직이요</Button>
          <Button size="md" disabled={busy} onClick={complete}>{busy ? '처리하는 중' : '배달 완료'}</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
