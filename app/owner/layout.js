// 사장 화면(/owner/...) 공통 레이아웃
// 사장 화면 스타일과 토스트는 여기서만 켜서, 팀 공용 app/layout.js · globals.css 는 건드리지 않는다.
import './owner.css';
import '../../components/owner/HoursEditor.css';
import '../../components/owner/ui.css';
import './[storeId]/menus/[menuId]/menu.css';
import './[storeId]/menus/menus.css';
import './[storeId]/orders/orders.css';
import './[storeId]/reviews/reviews.css';
import './[storeId]/sales/sales.css';
import './[storeId]/shell.css';
import './[storeId]/store/store.css';
import './auth.css';
import './stores/stores.css';
import { ToastProvider } from '@/components/owner/ui';

export const metadata = {
  title: '사장님 센터',
};

export default function OwnerLayout({ children }) {
  return (
    <div className="owner-root">
      {/* Pretendard 폰트 (React 19가 <head>로 올려 준다) */}
      <link rel="stylesheet" precedence="default"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
