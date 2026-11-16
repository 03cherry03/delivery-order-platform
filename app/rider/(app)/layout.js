// 로그인한 라이더만 보는 화면들(/rider, /rider/current, /rider/history, /rider/me)의 틀.
// (app) 폴더 이름은 괄호라서 주소에 나오지 않는다 (Next.js 라우트 그룹).
import RiderShell from '@/components/rider/RiderShell';

export default function RiderAppLayout({ children }) {
  return <RiderShell>{children}</RiderShell>;
}
