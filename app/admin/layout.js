import './admin.css';
import './baemin-theme.css';
import AdminShell from '@/components/admin/shell';
import { ToastProvider } from '@/components/admin/ui';
export const metadata={title:'관리자 센터 | Delivery Order Platform',description:'입점 심사, 리뷰 신고, 주문 문의 관리'};
export default function AdminLayout({children}){return <div className="admin-root" lang="ko"><link rel="stylesheet" precedence="default" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/><ToastProvider><AdminShell>{children}</AdminShell></ToastProvider></div>;}
