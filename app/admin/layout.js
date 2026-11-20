import './admin.css';
import './baemin-theme.css';
import AdminShell from '@/components/admin/shell';
import { ToastProvider } from '@/components/admin/ui';
import { BRAND } from '@/lib/brand';
export const metadata={title:BRAND.admin,description:'입점 심사, 리뷰 신고, 주문 문의 관리'};
export default function AdminLayout({children}){return <div className="admin-root" lang="ko"><ToastProvider><AdminShell>{children}</AdminShell></ToastProvider></div>;}
