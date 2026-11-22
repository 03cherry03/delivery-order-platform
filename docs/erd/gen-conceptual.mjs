// 개념 ERD(conceptual.drawio) 생성기. Chen 표기로 그린다.
// 사용: node docs/erd/gen-conceptual.mjs > docs/erd/conceptual.drawio  (draw.io / diagrams.net 에서 연다)
// 개념 모델이라 구현 정보(FK 컬럼, 타입, 인덱스)는 넣지 않는다. 연결 테이블(장바구니항목옵션,
// 주문항목옵션)은 M:N 관계로 그린다. 배치는 격자 기본값이며 draw.io 에서 옮겨도 된다.
//
// 기호
//   사각형 = 엔터티, 이중 사각형 = 약한 엔터티(다른 엔터티를 통해 식별)
//   마름모 = 관계, 이중 마름모 = 식별 관계(약한 엔터티와 소유 엔터티 사이), 삼각형 = 상위·하위 유형(ISA)
//   타원 = 속성. 밑줄 = 식별자, 점선 밑줄 = 부분 식별자(약한 엔터티), 점선 타원 = 유도 속성(VIEW로 계산)
//   이중선 = 전체 참여(그 엔터티의 모든 인스턴스가 관계에 참여), 단선 = 부분 참여

// [이름, 열, 행, 식별자, 속성들, 종류]
//   식별자는 DB가 모든 행에서 유일함을 보장하는 값만 쓴다. 이름·별칭·일시처럼 겹칠 수 있는 값은 속성으로 둔다.
//   종류: "" 일반, "weak" 약한 엔터티(식별자 칸은 부분 식별자. 없으면 null), "sub" ISA 하위 유형(상위 식별자를 물려받음)
//   속성 앞 "~" = 유도 속성
const ENTITIES = [
  ["영업시간", 0, 0, "영업시간번호", ["요일", "시작시각", "종료시각"], ""],
  ["가게", 2, 0, "사업자번호", ["가게명", "업종", "배달팁", "~평점"], ""],
  ["메뉴분류", 3, 0, "분류번호", ["분류명", "표시순서"], ""],
  ["메뉴", 4, 0, "메뉴번호", ["메뉴명", "가격", "판매상태"], ""],
  ["옵션그룹", 5, 0, "옵션그룹번호", ["그룹명", "필수여부", "최대선택수"], ""],
  ["입점신청", 1, 1, "신청번호", ["신청일시", "심사상태", "반려사유"], ""],
  ["장바구니", 2, 1, null, ["담은일시"], "weak"],
  ["장바구니항목", 4, 1, "항목번호", ["수량"], ""],
  ["옵션", 5, 1, "옵션번호", ["옵션명", "추가금액"], ""],
  ["회원주소", 0, 2, "주소번호", ["주소별칭", "도로명주소", "기본주소여부"], ""],
  ["회원", 1, 2, "회원번호", ["이메일", "이름", "역할"], ""],
  ["주문", 3, 2, "주문번호", ["주문일시", "주문상태", "배달주소"], ""],
  ["주문항목", 4, 2, "주문순번", ["메뉴명", "수량", "단가"], "weak"],
  ["라이더", 0, 3, null, ["운송수단", "활동반경", "라이더상태"], "sub"],
  ["포인트거래", 1, 3, "거래번호", ["거래유형", "금액", "거래후잔액"], ""],
  ["결제", 2, 3, "결제번호", ["결제수단", "결제금액", "결제상태"], ""],
  ["배달", 3, 3, "배달번호", ["배차일시", "픽업일시", "완료일시"], ""],
  ["회원제한", 0, 4, "제한번호", ["제한유형", "시작일시", "종료일시"], ""],
  ["리뷰신고", 1, 4, null, ["신고사유", "처리상태"], "weak"],
  ["리뷰", 3, 4, null, ["평점", "내용", "숨김여부"], "weak"],
  ["답글", 4, 4, null, ["내용"], "weak"],
];

// [엔터티A, 관계, 엔터티B, A쪽 카디널리티, B쪽 카디널리티, 표시, 관계 속성]
//   표시: "A" = A 전체 참여, "B" = B 전체 참여, "I" = 식별 관계
const RELS = [
  ["회원", "소유", "가게", "1", "N", "B"],
  ["회원", "등록", "회원주소", "1", "N", "B"],
  ["회원", "ISA", "라이더", "1", "1", "B"],
  ["가게", "운영", "영업시간", "1", "N", "B"],
  ["가게", "신청", "입점신청", "1", "N", "B"],
  ["회원", "심사", "입점신청", "1", "N", ""],
  ["가게", "구성", "메뉴분류", "1", "N", "B"],
  ["메뉴분류", "포함", "메뉴", "1", "N", "B"],
  ["메뉴", "보유", "옵션그룹", "1", "N", "B"],
  ["옵션그룹", "구성", "옵션", "1", "N", "B"],
  ["회원", "보유", "장바구니", "1", "1", "BI"],
  ["장바구니", "대상", "가게", "N", "1", "A"],
  ["장바구니", "담음", "장바구니항목", "1", "N", "B"],
  ["장바구니항목", "선택", "메뉴", "N", "1", "A"],
  ["장바구니항목", "옵션선택", "옵션", "M", "N", ""],
  ["회원", "주문함", "주문", "1", "N", "B"],
  ["가게", "접수", "주문", "1", "N", "B"],
  ["회원", "취소처리", "주문", "1", "N", ""],
  ["주문", "포함", "주문항목", "1", "N", "ABI"],
  ["주문항목", "선택", "메뉴", "N", "1", "A"],
  ["주문항목", "옵션선택", "옵션", "M", "N", "", ["주문당시 옵션명", "주문당시 옵션금액"]],
  ["주문", "결제", "결제", "1", "1", "AB"],
  ["회원", "거래", "포인트거래", "1", "N", "B"],
  ["주문", "연관", "포인트거래", "1", "N", ""],
  ["주문", "배달", "배달", "1", "1", "B"],
  ["라이더", "수행", "배달", "1", "N", ""],
  ["주문", "평가", "리뷰", "1", "1", "BI"],
  ["리뷰", "답변", "답글", "1", "1", "BI"],
  ["회원", "작성", "답글", "1", "N", "B"],
  ["리뷰", "신고됨", "리뷰신고", "1", "N", "BI"],
  ["회원", "신고", "리뷰신고", "1", "N", "BI"],
  ["회원", "처리", "리뷰신고", "1", "N", ""],
  ["회원", "제한됨", "회원제한", "1", "N", "B"],
  ["리뷰신고", "근거", "회원제한", "1", "N", ""],
  ["회원", "부과", "회원제한", "1", "N", "B"],
];

const CW = 360, RH = 330, X0 = 120, Y0 = 260, EW = 120, EH = 50, AW = 100, AH = 34;
// 엔터티 왼쪽 위 기준 속성 타원 자리. 첫 자리는 식별자
const SLOTS = [[-75, -60], [95, -60], [-75, -105], [95, -105], [10, -150]];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cells = [];
let n = 2;
const id = () => `c${n++}`;
const pos = {};
const boxes = []; // 이미 놓인 도형 영역. 마름모와 관계 속성이 겹치지 않게 피할 때 쓴다
const vertex = (value, style, x, y, w, h) => {
  const i = id();
  boxes.push({ x, y, w, h });
  cells.push(`<mxCell id="${i}" value="${esc(value)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  return i;
};
const overlaps = (x, y, w, h) => boxes.some((b) => x < b.x + b.w + 10 && x + w + 10 > b.x && y < b.y + b.h + 10 && y + h + 10 > b.y);
const edge = (src, dst, label = "", total = false) => {
  const style = total
    ? "shape=link;endArrow=none;html=1;rounded=0;fontStyle=1;labelBackgroundColor=#ffffff;"
    : "endArrow=none;html=1;rounded=0;fontStyle=1;labelBackgroundColor=#ffffff;";
  cells.push(`<mxCell id="${id()}" value="${esc(label)}" style="${style}" edge="1" parent="1" source="${src}" target="${dst}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
};

const ATTR = "ellipse;whiteSpace=wrap;html=1;fontSize=10;";
const ENTITY = "rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;";
const WEAK = "shape=ext;double=1;margin=4;rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;";

for (const [name, c, r, key, attrs, kind] of ENTITIES) {
  const x = X0 + c * CW, y = Y0 + r * RH;
  const e = vertex(name, kind === "weak" ? WEAK : ENTITY, x, y, EW, EH);
  pos[name] = { id: e, x: x + EW / 2, y: y + EH / 2 };
  const labels = [];
  if (key) labels.push(kind === "weak" ? `<u style="text-decoration-style:dashed">${esc(key)}</u>` : `<u>${esc(key)}</u>`);
  for (const a of attrs) labels.push(a.startsWith("~") ? { derived: esc(a.slice(1)) } : esc(a));
  if (labels.length > SLOTS.length) throw new Error(`속성 자리 부족: ${name}`);
  labels.forEach((label, i) => {
    const [dx, dy] = SLOTS[i];
    const derived = typeof label === "object";
    const a = vertex(derived ? label.derived : label, derived ? `${ATTR}dashed=1;` : ATTR, x + dx, y + dy, AW, AH);
    edge(e, a);
  });
}

// 마름모는 두 엔터티 사이 선 위에 둔다. 다른 도형과 겹치면 선을 따라 옮기거나 옆으로 비켜 놓는다
const freeSpot = (cx, cy, dx, dy, w, h, sides, ts) => {
  const len = Math.hypot(dx, dy) || 1;
  for (const side of sides) for (const t of ts) {
    const x = cx + dx * t - w / 2 + (-dy / len) * side, y = cy + dy * t - h / 2 + (dx / len) * side;
    if (!overlaps(x, y, w, h)) return { x, y };
  }
  return null;
};
for (const [a, rel, b, ca, cb, flags, relAttrs = []] of RELS) {
  if (!pos[a] || !pos[b]) throw new Error(`없는 엔터티: ${a} / ${b}`);
  const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
  const place = freeSpot(pos[a].x, pos[a].y, dx, dy, 90, 50, [0, 70, -70, 140, -140, 210, -210], [0.5, 0.35, 0.65, 0.25, 0.75]);
  if (!place) throw new Error(`마름모 자리를 찾지 못함: ${a} ${rel} ${b}`);
  const color = "fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;";
  const style = rel === "ISA"
    ? `triangle;whiteSpace=wrap;html=1;direction=south;${color}`
    : flags.includes("I")
      ? `shape=rhombus;double=1;perimeter=rhombusPerimeter;whiteSpace=wrap;html=1;${color}`
      : `rhombus;whiteSpace=wrap;html=1;${color}`;
  const d = vertex(rel, style, place.x, place.y, 90, 50);
  edge(pos[a].id, d, ca, flags.includes("A"));
  edge(d, pos[b].id, cb, flags.includes("B"));
  // 관계 속성은 마름모 둘레의 빈자리에 둔다
  for (const label of relAttrs) {
    const cx = place.x + 45, cy = place.y + 25;
    let spot = null;
    for (const [ox, oy] of [[0, -70], [0, 70], [-120, 0], [120, 0], [-110, -60], [110, -60], [-110, 60], [110, 60], [0, -120], [0, 120]]) {
      const x = cx + ox - AW / 2, y = cy + oy - AH / 2;
      if (!overlaps(x, y, AW, AH)) { spot = { x, y }; break; }
    }
    if (!spot) throw new Error(`관계 속성 자리를 찾지 못함: ${rel} ${label}`);
    edge(d, vertex(label, ATTR, spot.x, spot.y, AW, AH));
  }
}

const legend = [
  "Chen 표기 개념 ERD. 원본: server/db/schema.sql (구현 정보는 물리 ERD physical.dbml 참고)",
  "사각형: 엔터티 / 이중 사각형: 약한 엔터티 / 마름모: 관계 / 이중 마름모: 식별 관계 / 삼각형: 상위·하위 유형(ISA)",
  "타원: 속성 (밑줄 = 식별자, 점선 밑줄 = 부분 식별자, 점선 타원 = 유도 속성) / 이중선: 전체 참여, 단선: 부분 참여 / 선 위 1·N·M: 카디널리티",
].join("<br>");
vertex(legend, "text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=12;", X0 - 100, 10, 1100, 60);

const W = X0 + 6 * CW + 200, H = Y0 + 5 * RH;
process.stdout.write(`<mxfile host="gen-conceptual.mjs"><diagram id="conceptual" name="개념 ERD"><mxGraphModel dx="1600" dy="1200" grid="1" gridSize="10" guides="1" page="1" pageScale="1" pageWidth="${W}" pageHeight="${H}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>\n${cells.join("\n")}\n</root></mxGraphModel></diagram></mxfile>\n`);
console.error(JSON.stringify({
  entities: ENTITIES.length,
  weak: ENTITIES.filter((e) => e[5] === "weak").length,
  relationships: RELS.length,
  identifying: RELS.filter((r) => r[5].includes("I")).length,
  totalParticipationLines: RELS.reduce((s, r) => s + (r[5].includes("A") ? 1 : 0) + (r[5].includes("B") ? 1 : 0), 0),
}));
