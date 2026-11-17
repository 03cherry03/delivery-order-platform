// Express ↔ route 함수 연결.
// route 함수는 표준 Request 를 받아 Response 를 돌려준다(lib/http.js handler()). 이 파일이 Express 요청을
// 표준 Request 로 바꾸고, 돌려받은 Response 를 Express 응답으로 보낸다. 비즈니스 로직은 route 파일에 그대로 있다.

export function expressRoute(routeFn) {
  return async (req, res, next) => {
    try {
      const body = Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
      const request = new Request(`${req.protocol}://${req.get("host")}${req.originalUrl}`, {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])),
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      const response = await routeFn(request, { params: Promise.resolve({ ...req.params }) });
      res.status(response.status);
      response.headers.forEach((value, name) => {
        if (name !== "set-cookie") res.setHeader(name, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader("Set-Cookie", cookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
}
