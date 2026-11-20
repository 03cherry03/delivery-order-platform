// 고객 화면(/customer) 레이아웃. 고객 스타일은 .customer-root 안에서만 적용한다.
import './customer.css';
import { BRAND } from '@/lib/brand';

export const metadata = {
  title: BRAND.customer,
};

export default function CustomerLayout({ children }) {
  return <div className="customer-root" lang="ko">{children}</div>;
}
