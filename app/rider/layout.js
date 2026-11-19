// 라이더 화면(/rider/...) 공통 레이아웃
// 라이더 화면 스타일과 토스트는 여기서만 켜서, 팀 공용 app/layout.js · globals.css 는 건드리지 않는다. (사장 화면과 같은 방식)
import './rider.css';
import { ToastProvider } from '@/components/rider/ui';
import { BRAND } from '@/lib/brand';

export const metadata = {
  title: BRAND.rider,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RiderLayout({ children }) {
  return (
    <div className="rider-root">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
