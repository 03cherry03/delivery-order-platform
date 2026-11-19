import CustomerApp from "@/components/CustomerApp";

// /customer?mode=signup 이면 고객 회원가입 폼부터 보여 준다 (통합 로그인 /login 의 "고객" 가입 링크)
export default async function CustomerPage({ searchParams }) {
  const { mode } = await searchParams;
  return <CustomerApp initialMode={mode === "signup" ? "signup" : "login"} />;
}
