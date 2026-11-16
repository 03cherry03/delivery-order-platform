'use client';

// A-05 가게 추가 등록 / 반려 후 재신청 (?reapply=가게ID)
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { addStore, getStore, reapplyStore } from '@/lib/owner/api';
import { useMe } from '@/lib/owner/hooks';
import { Button, Card, Loading, useToast } from '@/components/owner/ui';
import StoreForm, { initialStore, storeBody } from '@/components/owner/StoreForm';
import s from '@/app/owner/auth.styles';

function NewStore() {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const reapplyId = useSearchParams().get('reapply');
  const [store, setStore] = useState(reapplyId ? null : initialStore());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me || !reapplyId) return;
    getStore(reapplyId).then((st) => setStore(initialStore(st))).catch((e) => setFormError(e.message));
  }, [me, reapplyId]);

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    const sb = storeBody(store);
    if (sb.error) { setFormError(sb.error); return; }
    setBusy(true);
    try {
      if (reapplyId) await reapplyStore(reapplyId, sb.body);
      else await addStore(sb.body);
      toast(reapplyId ? '재신청했어요. 관리자 확인을 기다려 주세요.' : '입점 신청했어요. 관리자 확인을 기다려 주세요.');
      router.push('/owner/stores');
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  if (!me || !store) return <Loading />;
  return (
    <main className={s.wrap}>
      <form className={`${s.box} ${s.wide}`} onSubmit={submit}>
        <Link href="/owner/stores" className="muted small">‹ 가게 선택으로</Link>
        <h1 className={s.title} style={{ marginTop: 12 }}>{reapplyId ? '고쳐서 재신청' : '가게 추가 등록'}</h1>
        <p className={s.sub}>관리자 승인 후 영업을 시작할 수 있어요</p>
        {formError && <div className={s.formError} style={{ marginBottom: 16 }}>{formError}</div>}
        <Card>
          <StoreForm value={store} onChange={setStore} errors={errors} />
        </Card>
        <div style={{ marginTop: 24 }}>
          <Button type="submit" size="lg" full disabled={busy}>{busy ? '보내는 중' : reapplyId ? '재신청하기' : '입점 신청하기'}</Button>
        </div>
      </form>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<Loading />}><NewStore /></Suspense>;
}
