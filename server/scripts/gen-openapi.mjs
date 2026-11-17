import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = "docs/api/openapi.json";
const areas = [
  ["auth", "인증"],
  ["customer", "고객"],
  ["owner", "사장"],
  ["admin", "관리자"],
  ["rider", "라이더"],
];
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

function subsection(text, heading) {
  return text.match(new RegExp(`^### ${heading}\\s*\\n([\\s\\S]*?)(?=^### |$(?![\\s\\S]))`, "m"))?.[1]?.trim() ?? "";
}

function tableRows(text) {
  return text.split("\n").filter((line) => /^\s*\|/.test(line)).map((line) => ({
    raw: line,
    cells: line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|")),
  })).filter(({ cells }) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
}

function errorRows(text) {
  return tableRows(text).filter(({ cells }) => /^[45]\d\d$/.test(cells[0]));
}

function schemaFor(type) {
  const normalized = type.replaceAll("`", "").trim();
  const parts = normalized.split(/\s*(?:또는|\/)\s*/);
  if (parts.length > 1) {
    const nonNull = parts.filter((part) => part !== "null");
    if (nonNull.length === 1 && parts.includes("null")) {
      const schema = schemaFor(nonNull[0]);
      return schema && { ...schema, nullable: true };
    }
    const variants = parts.map(schemaFor);
    return variants.every(Boolean) ? { oneOf: variants } : null;
  }
  if (normalized.endsWith("[]")) {
    const items = schemaFor(normalized.slice(0, -2));
    return items && { type: "array", items };
  }
  if (normalized === "null") return { nullable: true };
  if (!["string", "integer", "number", "boolean", "array", "object"].includes(normalized)) return null;
  if (normalized === "array") return { type: "array", items: {} };
  if (normalized === "object") return { type: "object", properties: {} };
  return { type: normalized };
}

function addProperty(object, field, schema, required) {
  const [part, ...rest] = field.split(".");
  const array = part.endsWith("[]");
  const name = part.replace(/\[\]$/, "");
  object.properties ??= {};
  if (required && !rest.length) {
    object.required ??= [];
    if (!object.required.includes(name)) object.required.push(name);
  }
  if (!rest.length) {
    object.properties[name] = { ...object.properties[name], ...schema };
    return;
  }
  const child = object.properties[name] ??= array
    ? { type: "array", items: { type: "object", properties: {} } }
    : { type: "object", properties: {} };
  if (array) {
    child.items.type = "object";
    child.items.properties ??= {};
  }
  addProperty(array ? child.items : child, rest.join("."), schema, required);
}

function requestFor(section, path) {
  const parameters = [];
  const body = { type: "object", properties: {} };
  const notes = [];
  const text = subsection(section.text, "요청");
  // Non-field rows are constraints (or explicit absence), not fake JSON properties.
  for (const { raw, cells } of tableRows(text)) {
    if (cells[0] === "위치") continue;
    const [location, fields, types, required, constraint] = cells;
    if (!fields || /^(?:—|-|없음)$/.test(fields) || location === "없음") {
      notes.push(location === "없음" || fields === "없음" ? constraint : raw);
      continue;
    }
    const names = fields.replaceAll("`", "").split(/\s*[,/]\s*/);
    const individualTypes = types?.split(/\s*,\s*/);
    const mapped = ["path", "query", "body"].includes(location)
      && names.every((name) => /^[A-Za-z_]\w*(?:\[\])?(?:\.[A-Za-z_]\w*(?:\[\])?)*$/.test(name))
      && individualTypes && (individualTypes.length === 1 || individualTypes.length === names.length)
      && individualTypes.every((type) => schemaFor(type));
    if (!mapped || cells.length !== 5) {
      notes.push(raw);
      console.warn(`openapi: ${section.id} kept unmapped request row: ${raw}`);
      continue;
    }
    for (const [index, name] of names.entries()) {
      const schema = schemaFor(individualTypes.length === 1 ? types : individualTypes[index]);
      const description = `${constraint}${!["O", "X", "예", "아니오"].includes(required) ? ` (필수: ${required})` : ""}`;
      if (location === "body") {
        addProperty(body, name, { ...schema, description }, /^(?:O|예)$/.test(required));
      } else if (location !== "path" || path.includes(`{${name}}`)) {
        parameters.push({ name, in: location, required: location === "path" || /^(?:O|예)$/.test(required), description, schema });
      }
    }
  }
  const prose = text.split("\n").filter((line) => !/^\s*\|/.test(line)).join("\n").trim();
  return { parameters, body, notes: [...notes, prose].filter(Boolean).join("\n\n") };
}

function addErrors(responses, rows) {
  for (const { raw, cells } of rows) {
    const [status, code, message] = cells;
    assert(cells.length === 3 && code && message, `Invalid error row: ${raw}`);
    const response = responses[status] ??= {
      description: `HTTP ${status} 오류`,
      content: { "application/json": { schema: ref("ErrorResponse"), examples: {} } },
    };
    const examples = response.content["application/json"].examples;
    const previous = examples[code]?.value.error.message;
    examples[code] = { value: { success: false, error: { code, message: previous && previous !== message ? `${previous}\n${message}` : message } } };
  }
}

function operationFor(section, route, routeIndex) {
  const { method, path } = route;
  const request = requestFor(section, path);
  const responseText = subsection(section.text, "응답");
  const json = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
  assert(json, `${section.id}: missing JSON response example`);
  const example = JSON.parse(json[1]);
  const responseNotes = responseText.replace(/```json\s*\n[\s\S]*?\n```/g, "").trim();
  const statuses = [...responseText.split("```", 1)[0].matchAll(/\b(20\d)\b/g)].map((match) => match[1]);
  const status = statuses[routeIndex] ?? statuses[0] ?? "200";
  const schema = { allOf: [ref("SuccessResponse")] };
  if (example.data && ["items", "page", "size", "totalCount"].every((key) => Object.hasOwn(example.data, key))) {
    schema.allOf.push({ type: "object", properties: { data: ref("PageData") } });
  }
  const operation = {
    tags: [section.tag],
    operationId: section.id.replace("-", "") + (section.routes.length > 1 ? `_${method}` : ""),
    summary: `${section.id} ${section.name}`,
    description: [
      section.text.match(/^- 설명:\s*(.*)$/m)?.[1],
      `권한: ${section.permission}`,
      request.notes && `요청 참고:\n${request.notes}`,
      `DB 처리:\n${subsection(section.text, "DB 처리")}`,
    ].filter(Boolean).join("\n\n"),
    ...(request.parameters.length ? { parameters: request.parameters } : {}),
    ...(Object.keys(request.body.properties).length ? {
      requestBody: { required: true, content: { "application/json": { schema: request.body } } },
    } : {}),
    responses: {
      [status]: {
        description: responseNotes || "성공",
        content: { "application/json": { schema, example } },
      },
    },
    ...(!section.permission.startsWith("누구나") ? { security: [{ sessionCookie: [] }] } : {}),
  };
  addErrors(operation.responses, [
    ...section.commonErrors.filter(({ cells }) => section.id !== "S-01" || cells[1] !== "STORE_NOT_APPROVED"),
    ...errorRows(subsection(section.text, "오류")),
  ]);
  return operation;
}

function mergeOperation(existing, operation, sections) {
  const ids = sections.map((section) => section.id);
  existing.operationId = ids.map((id) => id.replace("-", "")).join("_");
  existing.summary = `${ids.join(" / ")} ${sections.map((section) => section.name).join(" / ")}`;
  existing.tags = [...new Set([...existing.tags, ...operation.tags])];
  existing.description = `${existing.description}\n\n${operation.summary}\n\n${operation.description}`;
  if (operation.requestBody) {
    const media = existing.requestBody?.content["application/json"];
    if (media) {
      media.schema = { oneOf: [...(media.schema.oneOf ?? [media.schema]), operation.requestBody.content["application/json"].schema] };
    } else existing.requestBody = operation.requestBody;
  }
  for (const [status, response] of Object.entries(operation.responses)) {
    if (!existing.responses[status]) existing.responses[status] = response;
    else if (response.content["application/json"].examples) {
      const rows = Object.entries(response.content["application/json"].examples).map(([code, { value }]) => ({
        raw: code, cells: [status, code, value.error.message],
      }));
      addErrors(existing.responses, rows);
    } else {
      existing.responses[status].description += `\n\n${operation.summary}\n${response.description}`;
    }
  }
  assert(Boolean(existing.security) === Boolean(operation.security), "Conflicting security for shared operation");
}

function validate(spec, expected) {
  const actual = new Set();
  const ids = new Set();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      actual.add(`${method.toUpperCase()} ${path}`);
      assert(!ids.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
      ids.add(operation.operationId);
      assert(Object.keys(operation.responses).length, `${operation.operationId}: missing responses`);
      const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      const parameters = operation.parameters ?? [];
      for (const name of placeholders) {
        assert(parameters.some((parameter) => parameter.in === "path" && parameter.name === name && parameter.required), `${operation.operationId}: undeclared path parameter ${name}`);
      }
      for (const parameter of parameters.filter((parameter) => parameter.in === "path")) {
        assert(placeholders.includes(parameter.name), `${operation.operationId}: unexpected path parameter ${parameter.name}`);
      }
    }
  }
  assert(expected.size > 0, "README API list is empty");
  assert.equal(actual.size, expected.size, `Operation count differs from README (${actual.size} vs ${expected.size})`);
  assert.deepEqual(actual, expected, "METHOD+path entries differ from README");
  return actual.size;
}

async function generate() {
  const readme = await readFile(new URL("docs/api/README.md", root), "utf8");
  const apiList = readme.match(/^## 전체 API 목록\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1];
  assert(apiList, "README is missing 전체 API 목록");
  const expected = new Set(tableRows(apiList).filter(({ cells }) => /^[A-Z]-\d+$/.test(cells[0])).map(({ cells }) => `${cells[2]} ${cells[3]}`));
  const sections = [];
  for (const [area, tag] of areas) {
    const text = await readFile(new URL(`docs/api/${area}.md`, root), "utf8");
    const common = text.split(/^## [A-Z]-\d+ /m, 1)[0];
    for (const block of text.split(/^## /m)) {
      const heading = block.match(/^([A-Z]-\d+) (.+)\n/);
      if (!heading) continue;
      const [, id, name] = heading;
      const methodLine = block.match(/^- method\/path:\s*(.*)$/m)?.[1] ?? "";
      const routes = [...methodLine.matchAll(/`(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\/api\/[^`\s]+)`/g)]
        .map((match) => ({ method: match[1].toLowerCase(), path: match[2] }));
      assert(routes.length, `${area}.md ${id}: missing method/path`);
      const permission = block.match(/^- 권한:\s*(.+)$/m)?.[1];
      assert(permission, `${id}: missing 권한`);
      sections.push({ id, name, tag, text: block, routes, permission, commonErrors: errorRows(common) });
    }
  }
  const formats = subsection(readme, "요청·응답 형식").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "배달 주문 플랫폼 API",
      version: "1.0.0",
      description: `공통 규칙: 서명 세션 쿠키를 검증하고 요청마다 활성 회원과 현재 역할·자원 소유권을 확인한다. A-01을 Try it out으로 실행하면 브라우저가 delivery_session 쿠키를 저장하고 이후 같은 출처의 요청에 자동 전송한다.\n\n${formats}`,
    },
    // /api-docs 는 API 서버(server/)가 내려주므로 "/" = 이 API 서버. 로컬 개발 주소도 함께 적는다.
    servers: [
      { url: "/", description: "이 문서를 내려준 API 서버" },
      { url: "http://localhost:4000", description: "로컬 개발 API 서버 (server/, npm run dev)" },
    ],
    tags: areas.map(([, name]) => ({ name })),
    paths: {},
    components: {
      schemas: {
        SuccessResponse: { type: "object", required: ["success", "data"], properties: { success: { type: "boolean", enum: [true] }, data: { nullable: true } } },
        ErrorResponse: {
          type: "object", required: ["success", "error"],
          properties: {
            success: { type: "boolean", enum: [false] },
            error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, fields: { type: "object", additionalProperties: { type: "string" } } } },
          },
        },
        PageData: { type: "object", required: ["items", "page", "size", "totalCount"], properties: { items: { type: "array", items: {} }, page: { type: "integer", minimum: 1 }, size: { type: "integer", minimum: 1, maximum: 100 }, totalCount: { type: "integer", minimum: 0 } } },
      },
      securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "delivery_session" } },
    },
  };
  const origins = new Map();
  for (const section of sections) {
    for (const [index, route] of section.routes.entries()) {
      const operation = operationFor(section, route, index);
      const body = operation.requestBody?.content["application/json"].schema;
      if (section.id === "A-06") {
        body.properties.role.enum = ["CUSTOMER", "OWNER"];
        const storeBody = spec.paths["/api/owner/stores"].post.requestBody.content["application/json"].schema;
        body.properties.store = { ...structuredClone(storeBody), description: body.properties.store.description };
      }
      if (section.id === "D-01") body.properties.role.enum = ["RIDER"];
      const methods = spec.paths[route.path] ??= {};
      const key = `${route.method} ${route.path}`;
      const source = origins.get(key) ?? [];
      source.push(section);
      origins.set(key, source);
      if (methods[route.method]) mergeOperation(methods[route.method], operation, source);
      else methods[route.method] = operation;
    }
  }
  return { spec, count: validate(spec, expected) };
}

try {
  const { spec, count } = await generate();
  const json = JSON.stringify(spec, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    let existing;
    try {
      existing = await readFile(new URL(output, root), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (existing !== json) {
      console.error(`openapi: ${output} is missing or differs; run npm run docs:openapi`);
      process.exitCode = 1;
    } else console.log(`openapi: up to date (${count} operations)`);
  } else {
    await writeFile(new URL(output, root), json);
    console.log(`openapi: wrote ${output} (${count} operations)`);
  }
} catch (error) {
  console.error(`openapi: ${error.message}`);
  process.exitCode = 1;
}
