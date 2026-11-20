'use client';

// 예전 역할별 로그인 주소(/owner/login, /rider/login, /admin/login)로 들어오면
// 통합 로그인(/login)으로 넘긴다. ?next=, ?joined= 같은 쿼리는 그대로 넘긴다.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ToUnifiedLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/login${window.location.search}`);
  }, [router]);
  return (
    <p style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', margin: 0, color: '#6b7478', fontWeight: 700 }}>
      로그인 화면으로 이동하는 중…
    </p>
  );
}
