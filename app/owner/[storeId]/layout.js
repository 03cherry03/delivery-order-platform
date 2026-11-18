'use client';

// 가게 화면 공통 틀: 왼쪽 메뉴 + 위쪽 가게 이름·영업 상태
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { getOrders, getStore, logout, setOperStatus } from '@/lib/owner/api';
import { OPER_STATUS } from '@/lib/owner/codes';
import { useLoad, useMe } from '@/lib/owner/hooks';
import { StoreContext } from '@/lib/owner/store-context';
import { Badge, Button, Loading, Modal, ModalActions, Switch, useToast } from '@/components/owner/ui';
import s from './shell.styles';

const NAV = [
  { href: 'orders', label: '주문 접수' },
  { href: 'menus', label: '메뉴 관리' },
  { href: 'store', label: '가게 정보' },
  { href: 'reviews', label: '리뷰' },
  { href: 'sales', label: '매출 통계' },
];

export default function StoreLayout({ children }) {
  const { storeId } = useParams();
  const pathname = usePathname();
  const router = useRouter();
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

  async function onLogout() {
    await logout().catch(() => {});
    router.replace('/owner/login');
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
      <div className={s.shell}>
        <aside className={s.side}>
          <Link href="/owner/stores" className={s.brand}>
            <span className={s.logo}>사</span>
            <span className={s.brandName}>사장님 센터</span>
          </Link>
          <nav className={s.nav}>
            {NAV.map((n) => {
              const href = `/owner/${storeId}/${n.href}`;
              const active = pathname.startsWith(href);
              return (
                <Link key={n.href} href={href} className={`${s.navItem} ${active ? s.navActive : ''}`}>
                  {n.label}
                  {n.href === 'orders' && waitCount > 0 && <span className={s.navCount}>{waitCount}</span>}
                </Link>
              );
            })}
          </nav>
          <div className={s.sideFoot}>
            <span className="small muted">{me.name} 사장님</span>
            <button type="button" className={s.linkBtn} onClick={onLogout}>로그아웃</button>
          </div>
        </aside>

        <div className={s.main}>
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
        </div>
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
