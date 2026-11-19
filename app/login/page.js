'use client';

// 통합 로그인. 로그인한 계정의 역할(role)을 보고 각 화면으로 보낸다.
//   CUSTOMER → /customer, OWNER → /owner/stores, RIDER → /rider (배달 중이면 /rider/current), ADMIN → /admin/applications
// ?next=/rider/history 처럼 원래 보던 주소가 붙어 있으면, 그 주소가 같은 역할 화면일 때만 그리로 돌려보낸다.
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLES, getMe, homeFor, login, logout, roleOfPath, safeNext } from '@/lib/auth/session';

const MOCK_ON = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

const DEMO = [
  { label: '고객', email: 'customer1@test.com' },
  { label: '사장님', email: 'owner1@test.com' },
  { label: '라이더', email: 'rider2@test.com' },
  { label: '관리자', email: 'admin@test.com' },
];

const NOTICE = {
  joined: '가입이 완료됐어요. 로그인해 주세요.',
  withdrawn: '회원 탈퇴가 완료됐어요.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="lg-page"><p className="lg-checking">확인하는 중…</p></main>}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const notice = Object.keys(NOTICE).find((k) => params.has(k));

  // checking: 이미 로그인돼 있는지 확인 중 / form: 로그인 폼 / switch: 다른 역할로 로그인된 상태
  const [view, setView] = useState('checking');
  const [current, setCurrent] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 로그인한 계정을 맞는 화면으로 보낸다
  async function go(user) {
    router.replace(safeNext(next, user.role) ?? (await homeFor(user)));
  }

  // 이미 로그인돼 있으면 바로 보낸다. 다른 역할 화면을 열려다 온 경우만 선택지를 보여 준다.
  useEffect(() => {
    let alive = true;
    getMe()
      .then(async (user) => {
        if (!alive) return;
        const wanted = roleOfPath(next);
        if (wanted && wanted !== user.role) {
          setCurrent(user);
          setView('switch');
          return;
        }
        const target = safeNext(next, user.role) ?? (await homeFor(user));
        if (alive) router.replace(target);
      })
      .catch(() => alive && setView('form'));
    return () => { alive = false; };
  }, [next, router]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      await go(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function switchAccount() {
    setBusy(true);
    await logout().catch(() => {});
    setCurrent(null);
    setPassword('');
    setBusy(false);
    setView('form');
  }

  if (view === 'checking') {
    return <main className="lg-page"><p className="lg-checking">확인하는 중…</p></main>;
  }

  return (
    <main className="lg-page">
      <div className="lg-brand">동네<span>한입</span></div>

      <section className="lg-card">
        {view === 'switch' && current ? (
          <>
            <h1 className="lg-title">이미 로그인돼 있어요</h1>
            <p className="lg-sub">
              지금 <b>{current.name}</b>님({ROLES[current.role]?.label ?? current.role} 계정)으로 로그인돼 있어요.
              열려던 화면은 {ROLES[roleOfPath(next)]?.label} 계정이 필요해요.
            </p>
            <div className="lg-stack">
              <button className="lg-btn" type="button" disabled={busy} onClick={() => go(current)}>
                {ROLES[current.role]?.label ?? '내'} 화면으로 가기
              </button>
              <button className="lg-btn lg-btnGhost" type="button" disabled={busy} onClick={switchAccount}>
                로그아웃하고 다른 계정으로 로그인
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="lg-title">로그인</h1>
            <p className="lg-sub">고객, 사장님, 라이더, 관리자 모두 여기서 로그인해요.<br />계정에 맞는 화면으로 바로 이동해요.</p>

            {notice && <div className="lg-notice" role="status">{NOTICE[notice]}</div>}

            <form className="lg-form" onSubmit={submit}>
              <label className="lg-field">
                <span>이메일</span>
                <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="lg-field">
                <span>비밀번호</span>
                <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <div className="lg-error" role="alert">{error}</div>}
              <button className="lg-btn" type="submit" disabled={busy}>{busy ? '확인하는 중' : '로그인'}</button>
            </form>

            <div className="lg-signup">
              <p>처음이신가요? 회원가입</p>
              <div className="lg-signupLinks">
                <Link href="/customer?mode=signup">고객</Link>
                <Link href="/owner/signup">사장님</Link>
                <Link href="/rider/signup">라이더</Link>
              </div>
            </div>

            <div className="lg-demo">
              <p>시연용 계정 · 비밀번호 test1234</p>
              <div className="lg-demoBtns">
                {DEMO.map((d) => (
                  <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword('test1234'); setError(''); }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {MOCK_ON && (
        <p className="lg-mock">
          지금은 목업 모드라 사장님·라이더 화면이 가짜 데이터를 써요. 실제 API로 로그인하려면
          <code>.env.local</code>에 <code>NEXT_PUBLIC_USE_MOCK=false</code>를 넣고 화면 서버를 다시 켜 주세요.
        </p>
      )}
    </main>
  );
}
