// 통합 로그인(/login) 레이아웃. 스타일은 .lg-root 안에서만 적용한다.
import './login.css';
import { BRAND } from '@/lib/brand';

export const metadata = {
  title: `로그인 | ${BRAND.customer}`,
};

export default function LoginLayout({ children }) {
  return (
    <div className="lg-root" lang="ko">
      {children}
    </div>
  );
}
