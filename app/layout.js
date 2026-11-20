// 모든 화면의 뿌리 레이아웃. 공용 토큰·기본 스타일·글꼴을 한 번만 불러온다.
import "./tokens.css";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: BRAND.customer,
  description: "우리 동네 음식 배달 — 고객·사장님·라이더·관리자",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {/* Pretendard 글꼴 (React 19가 <head>로 올려 준다) */}
        <link rel="stylesheet" precedence="default"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        {children}
      </body>
    </html>
  );
}
