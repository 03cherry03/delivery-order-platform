'use client';

// 첫 화면(/). 로그인한 계정이면 역할에 맞는 화면으로, 아니면 통합 로그인(/login)으로 보낸다.
// 고객 화면은 /customer 에 있다.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, homeFor } from '@/lib/auth/session';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    getMe()
      .then(homeFor)
      .catch(() => '/login')
      .then((to) => router.replace(to));
  }, [router]);
  return <p style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', margin: 0, color: '#6b7478', fontWeight: 700 }}>이동하는 중…</p>;
}
