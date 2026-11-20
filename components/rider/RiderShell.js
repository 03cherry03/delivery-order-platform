'use client';

// 로그인한 라이더 화면의 틀: 위쪽 헤더(이름, 상태) + 아래쪽 탭 바.
// D-02 내 라이더 정보를 한 번 불러와 아래 화면들과 나눠 쓴다 (useRiderCtx).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext } from 'react';
import { useRider } from '@/lib/rider/hooks';
import { RIDER_STATUS, VEHICLE } from '@/lib/rider/codes';
import { USE_MOCK } from '@/lib/rider/api';
import { Badge, Loading } from './ui';

const RiderCtx = createContext(null);
export const useRiderCtx = () => useContext(RiderCtx);

const TABS = [
  { href: '/rider', label: '배차 대기', icon: 'list' },
  { href: '/rider/current', label: '현재 배달', icon: 'bike' },
  { href: '/rider/history', label: '배달 내역', icon: 'clock' },
  { href: '/rider/me', label: '내 정보', icon: 'user' },
];

function Icon({ name }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'list') return <svg {...p}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>;
  if (name === 'bike') return <svg {...p}><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6h2l3 11.5M5.5 17.5 9 10h7l-4.5 7.5H5.5" /></svg>;
  if (name === 'clock') return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>;
}

export default function RiderShell({ children }) {
  const pathname = usePathname();
  const rider = useRider();
  const { me } = rider;
  const st = me ? RIDER_STATUS[me.riderStatus] : null;

  return (
    <RiderCtx.Provider value={rider}>
      <div className="rd-app">
        <header className="rd-top">
          <div className="rd-topWho">
            <span className="rd-topName">{me ? `${me.name} 라이더님` : '라이더'}</span>
            {me && <span className="rd-topSub">{VEHICLE[me.vehicleType]} · 반경 {(me.actRadiusM / 1000).toFixed(1)}km</span>}
          </div>
          {st && <Badge tone={st.tone}>{st.label}</Badge>}
        </header>
        {USE_MOCK && <div className="rd-mockBar">목업 모드 · 실제 API에 연결하지 않고 시연 데이터를 사용해요</div>}
        <main className="rd-main">{me ? children : <Loading />}</main>
        <nav className="rd-nav" aria-label="라이더 메뉴">
          {TABS.map((t) => {
            const active = t.href === '/rider' ? pathname === '/rider' : pathname.startsWith(t.href);
            const dot = t.href === '/rider/current' && me?.riderStatus === 'BUSY';
            return (
              <Link key={t.href} href={t.href} className={`rd-navItem${active ? ' rd-navOn' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="rd-navIcon"><Icon name={t.icon} />{dot && <span className="rd-navDot" />}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </RiderCtx.Provider>
  );
}
