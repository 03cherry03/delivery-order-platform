'use client';

// A-07 회원 탈퇴
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { withdraw } from '@/lib/owner/api';
import { useMe } from '@/lib/owner/hooks';
import { Button, Card, Field, Loading, useToast } from '@/components/owner/ui';
import s from '@/app/owner/auth.styles';

const MESSAGES = {
  HAS_ACTIVE_ORDERS: '진행 중인 주문(신규~배달중)이 있어요. 주문이 모두 끝난 뒤 탈퇴할 수 있어요.',
  STORE_STILL_OPEN: '영업 중인 가게가 있어요. 위쪽 영업 스위치로 먼저 일시중지해 주세요.',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않아요.',
};

export default function AccountPage() {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await withdraw(password);
      toast('탈퇴했어요. 그동안 고마웠어요');
      router.replace('/owner/login?withdrawn=1');
    } catch (err) {
      setError(MESSAGES[err.code] || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <Loading />;
  return (
    <main className={s.wrap}>
      <form className={s.box} onSubmit={submit}>
        <Link href="/owner/stores" className="muted small">‹ 가게 선택으로</Link>
        <h1 className={s.title} style={{ marginTop: 12 }}>회원 탈퇴</h1>
        <p className={s.sub}>{me.name} 사장님, 정말 떠나시나요?</p>
        <Card>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            <li>내 가게가 모두 삭제되어 손님에게 보이지 않아요.</li>
            <li>이름·전화번호 같은 개인정보는 지워지고 되돌릴 수 없어요.</li>
            <li>진행 중인 주문이 있거나 영업 중인 가게가 있으면 탈퇴할 수 없어요.</li>
          </ul>
        </Card>
        <div className={s.form} style={{ marginTop: 20 }}>
          <Field label="비밀번호 확인">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--fg-1)' }} />
            위 내용을 확인했어요
          </label>
          {error && <div className={s.formError}>{error}</div>}
          <Button type="submit" variant="danger" size="lg" full disabled={busy || !agree || !password}>탈퇴하기</Button>
        </div>
      </form>
    </main>
  );
}
