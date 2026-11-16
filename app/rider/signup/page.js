'use client';

// D-01 라이더 회원가입 → 바로 로그인(A-01)해서 배차 대기 목록으로
// 라이더는 관리자 승인 없이 바로 배달을 시작할 수 있다 (명세서 D-01)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signupRider, login } from '@/lib/rider/api';
import { VEHICLE, VEHICLE_OPTIONS, DEFAULT_ACT_RADIUS_M } from '@/lib/rider/codes';
import { Button, Chips, Field, useToast } from '@/components/rider/ui';
import RadiusField from '@/components/rider/RadiusField';

export default function RiderSignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ email: '', password: '', password2: '', name: '', tel: '', vehicleType: '', actRadiusM: DEFAULT_ACT_RADIUS_M });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const input = (k) => ({ value: f[k], onChange: (e) => set(k)(e.target.value) });

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const local = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) local.email = '이메일 형식이 아니에요.';
    if (!f.name.trim()) local.name = '이름을 입력하세요.';
    if (!f.tel.trim()) local.tel = '연락처를 입력하세요.';
    if (f.password.length < 8) local.password = '비밀번호는 8자 이상입니다.';
    else if (f.password !== f.password2) local.password2 = '비밀번호가 서로 달라요.';
    if (!f.vehicleType) local.vehicleType = '운송수단을 선택하세요.';
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      await signupRider({
        email: f.email.trim(), password: f.password, name: f.name.trim(), tel: f.tel.trim(),
        vehicleType: f.vehicleType, actRadiusM: Number(f.actRadiusM),
      });
      await login(f.email.trim(), f.password);
      toast('가입했어요. 바로 배차를 잡을 수 있어요');
      router.replace('/rider');
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rd-auth">
      <div className="rd-authBox">
        <div className="rd-brand">
          <div className="rd-logo">R</div>
          <span className="rd-brandName">라이더 회원가입</span>
        </div>
        <form className="rd-form" onSubmit={submit} noValidate>
          <Field label="이메일" required error={errors.email}>
            <input className="rd-input" type="email" autoComplete="email" required {...input('email')} />
          </Field>
          <Field label="비밀번호" required hint="8자 이상" error={errors.password}>
            <input className="rd-input" type="password" autoComplete="new-password" required {...input('password')} />
          </Field>
          <Field label="비밀번호 확인" required error={errors.password2}>
            <input className="rd-input" type="password" autoComplete="new-password" required {...input('password2')} />
          </Field>
          <Field label="이름" required error={errors.name}>
            <input className="rd-input" autoComplete="name" required {...input('name')} />
          </Field>
          <Field label="연락처" required error={errors.tel}>
            <input className="rd-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" required {...input('tel')} />
          </Field>
          <div className="rd-field">
            <span className="rd-label">운송수단<span className="rd-reqMark">*</span></span>
            <Chips options={VEHICLE_OPTIONS.map((v) => ({ value: v, label: VEHICLE[v] }))} value={f.vehicleType} onChange={set('vehicleType')} />
            {errors.vehicleType && <span className="rd-error">{errors.vehicleType}</span>}
          </div>
          <RadiusField value={f.actRadiusM} onChange={set('actRadiusM')} error={errors.actRadiusM} />
          {formError && <div className="rd-formError" role="alert">{formError}</div>}
          <Button type="submit" size="lg" full disabled={busy}>{busy ? '가입하는 중' : '가입하고 시작하기'}</Button>
        </form>
        <p className="rd-authFoot">이미 계정이 있으신가요?<Link href="/rider/login">로그인</Link></p>
      </div>
    </main>
  );
}

