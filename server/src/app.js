// API 서버(Express). 화면 서버(Next.js, :3000)와 따로 실행한다.
import express from "express";
import { apiDocsRouter } from "./api-docs.js";
import { cors } from "#lib/cors";
import { apiRouter } from "./routes.js";

export const app = express();
app.disable("x-powered-by");

app.use(cors); // 모든 요청에 먼저. OPTIONS preflight 는 여기서 204 로 끝난다
app.use(express.raw({ type: () => true, limit: "1mb" })); // 본문은 Buffer 로 받아 route 의 readJson() 이 해석한다
app.use(apiRouter);
app.use(apiDocsRouter);

// 등록되지 않은 경로: 공통 실패 형식
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "요청한 API가 없습니다." } });
});

// 본문 크기 초과 등 Express 단계의 오류
app.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    error: status === 413
      ? { code: "VALIDATION_ERROR", message: "요청 본문이 너무 큽니다." }
      : { code: status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST", message: status >= 500 ? "서버 오류가 발생했습니다." : "요청을 처리할 수 없습니다." },
  });
});
