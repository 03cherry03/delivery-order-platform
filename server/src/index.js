// API 서버 시작: npm run dev (파일 변경 시 재시작) 또는 npm start
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port} (docs: http://localhost:${port}/api-docs)`);
});
