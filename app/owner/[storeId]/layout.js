'use client';

// 가게 화면 공통 틀 (모바일): 위쪽 가게 이름·영업 상태 + 아래쪽 탭 바. 로그아웃은 가게 선택 화면에 있다.
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { getOrders, getStore, setOperStatus } from '@/lib/owner/api';
import { OPER_STATUS } from '@/lib/owner/codes';
import { useLoad, useMe } from '@/lib/owner/hooks';
import { StoreContext } from '@/lib/owner/store-context';
import { Badge, Button, Loading, Modal, ModalActions, Switch, useToast } from '@/components/owner/ui';
import s from './shell.styles';

const NAV = [
  { href: 'orders', label: '주문' },
  { href: 'menus', label: '메뉴' },
  { href: 'store', label: '가게' },
  { href: 'reviews', label: '리뷰' },
  { href: 'sales', label: '매출' },
];

// 아래 탭 아이콘 (라이더 화면과 같은 선 아이콘)
function NavIcon({ name }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'orders') return <svg {...p}><path d="M6 3h12l2 4H4l2-4Z" /><path d="M4 7v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7" /><path d="M9 11h6M9 15h4" /></svg>;
  if (name === 'menus') return <svg {...p}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
  if (name === 'store') return <svg {...p}><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12v8h14v-8" /></svg>;
  if (name === 'reviews') return <svg {...p}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>;
  return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
}

export default function StoreLayout({ children }) {
  const { storeId } = useParams();
  const pathname = usePathname();
  const toast = useToast();
  const me = useMe();
  const { data: store, error, reload: reloadStore } = useLoad(() => (me ? getStore(storeId) : null), [me, storeId]);
  // 신규 주문 수 배지 (O-01을 5초마다)
  const { data: waiting } = useLoad(() => (me && store?.approvalStatus === 'APPROVED' ? getOrders(storeId, { status: 'WAIT' }) : null), [me, storeId, store?.approvalStatus], 5000);
  const [confirmPause, setConfirmPause] = useState(false);

  async function changeOper(next) {
    try {
      await setOperStatus(storeId, next);
      toast(next === 'OPEN' ? '영업을 시작했어요' : '영업을 잠시 멈췄어요');
      reloadStore();
    } catch (e) {
      toast(e.code === 'NO_MENU_ON_SALE' ? '판매중인 메뉴가 없어요. 메뉴를 먼저 등록하세요.' : e.message, 'error');
    }
  }

  if (error) {
    return (
      <div className={s.blocked}>
        <h2>가게를 열 수 없어요</h2>
        <p className="muted">{error.message}</p>
        <Link href="/owner/stores"><Button variant="ghost" tabIndex={-1}>가게 선택으로</Button></Link>
      </div>
    );
  }
  if (!me || !store) return <Loading />;
  if (store.approvalStatus !== 'APPROVED') {
    return (
      <div className={s.blocked}>
        <h2>{store.storeName}</h2>
        <p className="muted">승인된 가게만 관리할 수 있어요. 지금은 {store.approvalStatus === 'PENDING' ? '승인 대기' : '반려'} 상태예요.</p>
        <Link href="/owner/stores"><Button variant="ghost" tabIndex={-1}>가게 선택으로</Button></Link>
      </div>
    );
  }

  const stored = store.operStatus === 'PAUSED' ? 'PAUSED' : 'OPEN'; // 사장이 정한 값
  const waitCount = Array.isArray(waiting) ? waiting.length : 0;

  return (
    <StoreContext.Provider value={{ storeId: Number(storeId), store, reloadStore }}>
      <div className={s.app}>
        <header className={s.top}>
          <div className={s.storeInfo}>
            <Link href="/owner/stores" className={s.storeName}>{store.storeName} <span className={s.caret}>▾</span></Link>
            <Badge tone={OPER_STATUS[store.operStatus].tone}>{OPER_STATUS[store.operStatus].label}</Badge>
          </div>
          <div className={s.operCtl}>
            <span className="small">{stored === 'OPEN' ? '영업 켜짐' : '일시중지'}</span>
            <Switch on={stored === 'OPEN'} label="영업 상태"
              onChange={(on) => (on ? changeOper('OPEN') : setConfirmPause(true))} />
          </div>
        </header>
        {store.operStatus === 'CLOSED' && (
          <div className={s.closedBar}>지금은 영업시간이 아니라 손님이 주문할 수 없어요. 영업시간은 가게 정보에서 바꿀 수 있어요.</div>
        )}
        {store.onSaleMenuCount === 0 && (
          <div className={s.closedBar}>판매중인 메뉴가 없어요. 메뉴를 먼저 등록하세요.</div>
        )}
        <main className={s.content}>{children}</main>

        <nav className={s.nav} aria-label={`${BRAND.owner} 메뉴`}>
          {NAV.map((n) => {
            const href = `/owner/${storeId}/${n.href}`;
            const active = pathname.startsWith(href);
            return (
              <Link key={n.href} href={href} className={`${s.navItem} ${active ? s.navActive : ''}`} aria-current={active ? 'page' : undefined}>
                <span className={s.navIcon}>
                  <NavIcon name={n.href} />
                  {n.href === 'orders' && waitCount > 0 && <span className={s.navCount}>{waitCount}</span>}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Modal open={confirmPause} title="영업을 잠시 멈출까요?" desc="새 주문을 받지 않아요. 이미 접수한 주문은 그대로 진행돼요." onClose={() => setConfirmPause(false)}>
        <ModalActions>
          <Button variant="ghost" size="md" onClick={() => setConfirmPause(false)}>취소</Button>
          <Button size="md" onClick={() => { setConfirmPause(false); changeOper('PAUSED'); }}>일시중지</Button>
        </ModalActions>
      </Modal>
    </StoreContext.Provider>
  );
}
