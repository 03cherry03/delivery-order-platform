'use client';

// 메인 = D-04 배차 대기 목록 (5초 폴링) + D-05 배차 수락
// 배달 중(BUSY)이어도 목록은 보이고, 수락만 막힌다 (명세서 D-04)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getDispatchRequests, acceptDelivery } from '@/lib/rider/api';
import { useLoad, useNow } from '@/lib/rider/hooks';
import { ORDER_STATUS, POLL_DISPATCH_MS } from '@/lib/rider/codes';
import { won, dist, hm, readyText } from '@/lib/rider/format';
import { Badge, Button, Empty, Loading, LoadError, Modal, ModalActions, useToast } from '@/components/rider/ui';
import { useRiderCtx } from '@/components/rider/RiderShell';

export default function DispatchListPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, reload: reloadMe } = useRiderCtx();
  // 명세서: 화면은 lat, lng을 보내지 않고 서버가 숭실대 좌표를 쓴다
  const { data: list, error, reload } = useLoad(() => getDispatchRequests(), [], POLL_DISPATCH_MS);
  const now = useNow(15000);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const isBusy = me.riderStatus === 'BUSY';

  async function accept() {
    setBusy(true);
    try {
      await acceptDelivery(target.deliveryId);
      await reloadMe();
      toast('배차를 수락했어요');
      router.push('/rider/current');
    } catch (err) {
      toast(err.message, 'error');
      setTarget(null);
      // 분기는 code로 (명세서 공통 규칙)
      if (err.code === 'RIDER_BUSY') reloadMe();
      reload(); // ALREADY_DISPATCHED, ORDER_ALREADY_PROCESSED → 목록 새로고침
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rd-page">
      {isBusy && (
        <Link href="/rider/current" className="rd-busyBanner">
          <span><b>배달 중이에요.</b> 지금 배달을 끝내야 새 배차를 수락할 수 있어요</span>
          <span className="rd-busyGo">현재 배달 →</span>
        </Link>
      )}

      <div className="rd-pageHead">
        <h1>배차 대기</h1>
        <span className="rd-live"><span className="rd-liveDot" />{POLL_DISPATCH_MS / 1000}초마다 새로고침</span>
      </div>
      <p className="rd-pageSub">숭실대 기준 반경 {(me.actRadiusM / 1000).toFixed(1)}km 안의 가게 · 조리 완료가 빠른 순</p>

      {list === undefined && !error && <Loading />}
      {error && list === undefined && <LoadError error={error} onRetry={reload} />}
      {list && list.length === 0 && (
        <Empty mark="⌁" title="지금은 대기 중인 배차가 없어요">
          새 요청이 들어오면 자동으로 나타나요.<br />
          <Link href="/rider/me" className="rd-link">활동 반경 넓히기</Link>
        </Empty>
      )}
      {list && list.length > 0 && (
        <ul className="rd-list">
          {list.map((r) => (
            <li key={r.deliveryId} className="rd-req">
              <div className="rd-reqTop">
                <Badge tone={ORDER_STATUS[r.orderStatus]?.tone}>{ORDER_STATUS[r.orderStatus]?.label}</Badge>
                <span className="rd-reqTip">{won(r.deliveryTip)}</span>
              </div>
              <div className="rd-route">
                <div className="rd-routeRow">
                  <span className="rd-pin rd-pinStore" aria-hidden="true" />
                  <div>
                    <p className="rd-routeName">{r.storeName}</p>
                    <p className="rd-routeAddr">{r.storeAddress}</p>
                  </div>
                  <span className="rd-routeDist">내 위치에서 {dist(r.distanceToStoreM)}</span>
                </div>
                <div className="rd-routeRow">
                  <span className="rd-pin rd-pinDest" aria-hidden="true" />
                  <div>
                    <p className="rd-routeName">{r.deliveryAddress}</p>
                    <p className="rd-routeAddr">상세 주소는 수락 후에 보여요</p>
                  </div>
                  <span className="rd-routeDist">가게에서 {dist(r.deliveryDistanceM)}</span>
                </div>
              </div>
              <div className="rd-reqFoot">
                <span className={r.orderStatus === 'READY' ? 'rd-readyNow' : 'rd-readyLater'}>{readyText(r.orderStatus, r.expectedReadyAt, now)}</span>
                <Button variant="mint" size="sm" disabled={isBusy} onClick={() => setTarget(r)}>
                  {isBusy ? '배달 중' : '수락'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!target} title="이 배차를 수락할까요?" desc="수락하면 직접 취소할 수 없어요. 문제가 생기면 고객센터에 연락해 주세요." onClose={() => !busy && setTarget(null)}>
        {target && (
          <dl className="rd-confirm">
            <div><dt>가게</dt><dd>{target.storeName} · {dist(target.distanceToStoreM)}</dd></div>
            <div><dt>배달지</dt><dd>{target.deliveryAddress} · {dist(target.deliveryDistanceM)}</dd></div>
            <div><dt>조리 완료</dt><dd>{target.orderStatus === 'READY' ? '완료됨' : `${hm(target.expectedReadyAt)} 예정`}</dd></div>
            <div><dt>배달팁</dt><dd className="rd-strong">{won(target.deliveryTip)}</dd></div>
          </dl>
        )}
        <ModalActions>
          <Button variant="ghost" size="md" onClick={() => setTarget(null)} disabled={busy}>닫기</Button>
          <Button variant="mint" size="md" onClick={accept} disabled={busy}>{busy ? '수락하는 중' : '수락하기'}</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
