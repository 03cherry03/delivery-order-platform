'use client';

// A-01 로그인 → D-02로 상태 확인 → 배달 중(BUSY)이면 현재 배달, 아니면 배차 대기 목록
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login, getRiderMe, logout, USE_MOCK } from '@/lib/rider/api';
import { Button, Field } from '@/components/rider/ui';

export default function RiderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const who = await login(email, password);
      if (who.role !== 'RIDER') {
        await logout().catch(() => {});
        setError('라이더 계정으로 로그인해 주세요.');
        return;
      }
      const me = await getRiderMe();
      router.replace(me.riderStatus === 'BUSY' ? '/rider/current' : '/rider');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fill = (n) => { setEmail(`rider${n}@test.com`); setPassword('test1234'); };

  return (
    <main className="rd-auth">
      <div className="rd-authBox">
        <div className="rd-brand">
          <div className="rd-logo">R</div>
          <span className="rd-brandName">라이더</span>
        </div>
        <h1 className="rd-authTitle">오늘도<br />안전하게 달려요</h1>
        <p className="rd-authSub">가까운 배차를 잡고, 픽업부터 완료까지 한 화면에서</p>
        <form className="rd-form" onSubmit={submit}>
          <Field label="이메일">
            <input className="rd-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="비밀번호">
            <input className="rd-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <div className="rd-formError" role="alert">{error}</div>}
          <Button type="submit" size="lg" full disabled={busy}>{busy ? '확인하는 중' : '로그인'}</Button>
        </form>
        <p className="rd-authFoot">처음이신가요?<Link href="/rider/signup">라이더 회원가입</Link></p>
        {USE_MOCK && (
          <div className="rd-demo">
            <p>목업 모드 · 테스트 계정 (비밀번호 test1234)</p>
            <div className="rd-demoBtns">
              <button type="button" onClick={() => fill(1)}>rider1 · 배차 대기</button>
              <button type="button" onClick={() => fill(2)}>rider2 · 배달 중</button>
              <button type="button" onClick={() => fill(3)}>rider3 · 픽업 전</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
