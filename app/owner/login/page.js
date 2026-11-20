'use client';

// A-01 로그인
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login, USE_MOCK } from '@/lib/owner/api';
import { Button, Field } from '@/components/owner/ui';
import s from '../auth.styles';
import ToUnifiedLogin from '@/components/auth/ToUnifiedLogin';

// 실제 API를 쓸 때는 통합 로그인(/login)을 쓴다. 목업 모드에서만 이 화면을 보여 준다.
export default function LoginPage() {
  return USE_MOCK ? <OwnerMockLogin /> : <ToUnifiedLogin />;
}

function OwnerMockLogin() {
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
      const me = await login(email, password);
      if (me.role !== 'OWNER') {
        setError('사장님 계정으로 로그인해 주세요.');
        return;
      }
      router.push('/owner/stores');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={s.wrap}>
      <div className={s.box}>
        <div className={s.brand}>
          <div className={s.logo}>사</div>
          <span className={s.brandName}>{BRAND.owner}</span>
        </div>
        <h1 className={s.title}>오늘도<br />든든하게 시작해요</h1>
        <p className={s.sub}>주문 접수부터 매출까지 한곳에서 관리하세요</p>
        <form className={s.form} onSubmit={submit}>
          <Field label="이메일">
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="비밀번호">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <div className={s.formError}>{error}</div>}
          <Button type="submit" size="lg" full disabled={busy}>{busy ? '확인하는 중' : '로그인'}</Button>
        </form>
        <p className={s.foot}>아직 입점 전이신가요?<Link href="/owner/signup">사장님 회원가입</Link></p>
        <div className={s.demo}>목업 모드 · 테스트 계정 owner@test.com / test1234</div>
      </div>
    </main>
  );
}
