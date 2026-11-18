// 라이더 화면(/rider/...) 공통 레이아웃
// 라이더 화면 스타일과 토스트는 여기서만 켜서, 팀 공용 app/layout.js · globals.css 는 건드리지 않는다. (사장 화면과 같은 방식)
import './rider.css';
import { ToastProvider } from '@/components/rider/ui';

export const metadata = {
  title: '라이더',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RiderLayout({ children }) {
  return (
    <div className="rider-root">
      {/* Pretendard 폰트 (React 19가 <head>로 올려 준다) */}
      <link rel="stylesheet" precedence="default"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
