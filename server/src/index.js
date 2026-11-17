// API 서버 시작.
//   개발: npm run dev   → node --watch src/index.js
//   운영: npm start     → node src/index.js --production
// --production 은 NODE_ENV=production 을 코드에서 설정한다. "NODE_ENV=production node ..." 같은 셸 문법은
// Windows PowerShell 에서 동작하지 않으므로 쓰지 않는다. 환경변수로 NODE_ENV=production 을 줘도 같다.
// 설정은 app.js 를 불러오기 전에 해야 한다(express·auth.js 가 불러올 때 NODE_ENV 를 읽음) → 동적 import.
if (process.argv.includes("--production")) process.env.NODE_ENV = "production";

let app;
try {
  ({ app } = await import("./app.js"));
} catch (error) {
  console.error(`API 서버를 시작하지 못했습니다: ${error.message}`);
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4000);
const mode = process.env.NODE_ENV === "production" ? "production" : "development";
app.listen(port, () => {
  console.log(`API server (${mode}) listening on http://localhost:${port} (docs: http://localhost:${port}/api-docs)`);
});
