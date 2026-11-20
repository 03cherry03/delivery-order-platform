'use client';

// A-06 사장 회원가입 — 회원 + 첫 가게 + 입점 신청을 한 번에 보낸다
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signupOwner, USE_MOCK } from '@/lib/owner/api';
import { Button, Card, Field, useToast } from '@/components/owner/ui';
import StoreForm, { initialStore, storeBody } from '@/components/owner/StoreForm';
import s from '../auth.styles';

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [acc, setAcc] = useState({ email: '', password: '', name: '', tel: '' });
  const [store, setStore] = useState(initialStore());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setAcc({ ...acc, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    const sb = storeBody(store);
    if (sb.error) { setFormError(sb.error); return; }
    setBusy(true);
    try {
      await signupOwner({ ...acc, store: sb.body });
      toast('가입했어요. 입점 승인을 기다리는 동안 로그인할 수 있어요.');
      router.push(USE_MOCK ? '/owner/login?joined=1' : '/login?joined=1');
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={s.wrap}>
      <form className={`${s.box} ${s.wide}`} onSubmit={submit}>
        <div className={s.brand}>
          <div className={s.logo}>사</div>
          <span className={s.brandName}>{BRAND.owner}</span>
        </div>
        <h1 className={s.title}>입점 신청</h1>
        <p className={s.sub}>가입하면 관리자 승인 후 영업을 시작할 수 있어요</p>
        {formError && <div className={s.formError} style={{ marginBottom: 16 }}>{formError}</div>}

        <Card title="사장님 정보">
          <div className={s.form}>
            <div className={s.grid2}>
              <Field label="이메일" required error={errors.email}>
                <input className="input" type="email" value={acc.email} onChange={set('email')} maxLength={100} />
              </Field>
              <Field label="비밀번호" required error={errors.password} hint="8자 이상">
                <input className="input" type="password" value={acc.password} onChange={set('password')} minLength={8} />
              </Field>
              <Field label="이름" required error={errors.name}>
                <input className="input" value={acc.name} onChange={set('name')} maxLength={50} />
              </Field>
              <Field label="휴대폰 번호" required error={errors.tel} hint="010-0000-0000">
                <input className="input" value={acc.tel} onChange={set('tel')} placeholder="010-1234-5678" />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="첫 가게 정보" style={{ marginTop: 16 }}>
          <StoreForm value={store} onChange={setStore} errors={errors} />
        </Card>

        <div style={{ marginTop: 24 }}>
          <Button type="submit" size="lg" full disabled={busy}>{busy ? '보내는 중' : '가입하고 입점 신청하기'}</Button>
        </div>
        <p className={s.foot}>이미 계정이 있나요?<Link href="/owner/login">로그인</Link></p>
      </form>
    </main>
  );
}
