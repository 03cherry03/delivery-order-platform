'use client';

// A-04 내 가게 목록 (가게 선택)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getMyStores, logout } from '@/lib/owner/api';
import { APPROVAL_STATUS, OPER_STATUS } from '@/lib/owner/codes';
import { useLoad, useMe } from '@/lib/owner/hooks';
import { Badge, Button, Empty, Loading } from '@/components/owner/ui';
import s from './stores.styles';

export default function StoreSelectPage() {
  const router = useRouter();
  const me = useMe();
  const { data: stores } = useLoad(() => (me ? getMyStores() : null), [me]);

  // 승인된 가게가 하나뿐이면 바로 이동
  useEffect(() => {
    if (!stores) return;
    if (stores.length === 1 && stores[0].approvalStatus === 'APPROVED') router.replace(`/owner/${stores[0].storeId}/orders`);
  }, [stores, router]);

  async function onLogout() {
    await logout().catch(() => {});
    router.replace('/owner/login');
  }

  if (!me || !stores) return <Loading />;
  const approved = stores.filter((x) => x.approvalStatus === 'APPROVED');

  return (
    <main className={s.wrap}>
      <header className={s.head}>
        <div>
          <p className="muted small">{me.name} 사장님</p>
          <h1>어느 가게를 관리할까요?</h1>
        </div>
        <Button variant="text" size="sm" onClick={onLogout}>로그아웃</Button>
      </header>

      {approved.length === 0 && stores.length > 0 && (
        <div className={s.notice}>아직 승인된 가게가 없어요. 관리자가 입점 신청을 확인하면 영업을 시작할 수 있어요.</div>
      )}

      <div className={s.list}>
        {stores.length === 0 && <Empty mark="+">등록된 가게가 없어요</Empty>}
        {stores.map((st) => {
          const ok = st.approvalStatus === 'APPROVED';
          const body = (
            <>
              <div className={s.itemMain}>
                <div className={s.itemTop}>
                  <span className={s.name}>{st.storeName}</span>
                  <Badge tone={APPROVAL_STATUS[st.approvalStatus].tone}>{APPROVAL_STATUS[st.approvalStatus].label}</Badge>
                  {ok && <Badge tone={OPER_STATUS[st.operStatus].tone}>{OPER_STATUS[st.operStatus].label}</Badge>}
                </div>
                {st.approvalStatus === 'REJECTED' && <p className={s.reject}>반려 사유: {st.rejectReason}</p>}
                {st.approvalStatus === 'PENDING' && <p className="muted small">관리자가 확인 중이에요</p>}
              </div>
              {ok && (
                <div className={s.itemSide}>
                  {st.waitingOrderCount > 0 ? <span className={s.waiting}>신규 {st.waitingOrderCount}</span> : <span className="muted small">신규 없음</span>}
                  <span className={s.arrow}>›</span>
                </div>
              )}
              {st.approvalStatus === 'REJECTED' && (
                <div className={s.itemSide}>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/owner/stores/new?reapply=${st.storeId}`)}>고쳐서 재신청</Button>
                </div>
              )}
            </>
          );
          return ok
            ? <Link key={st.storeId} href={`/owner/${st.storeId}/orders`} className={`${s.item} ${s.clickable}`}>{body}</Link>
            : <div key={st.storeId} className={s.item}>{body}</div>;
        })}
      </div>

      <div className={s.bottom}>
        <Button variant="ghost" size="md" full onClick={() => router.push('/owner/stores/new')}>+ 가게 추가 등록</Button>
        <Link href="/owner/account" className="muted small">회원 탈퇴</Link>
      </div>
    </main>
  );
}
