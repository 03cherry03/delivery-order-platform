// 통합 로그인(/login) 레이아웃. 스타일은 .lg-root 안에서만 적용한다.
import './login.css';

export const metadata = {
  title: '로그인 | 동네한입',
};

export default function LoginLayout({ children }) {
  return (
    <div className="lg-root" lang="ko">
      <link rel="stylesheet" precedence="default"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      {children}
    </div>
  );
}
