// 개념 ERD(conceptual.drawio) 생성기. Chen 표기: 엔터티 사각형, 관계 마름모, 속성 타원(식별자는 밑줄).
// 사용: node docs/erd/gen-conceptual.mjs > docs/erd/conceptual.drawio  (draw.io / diagrams.net 에서 연다)
// 개념 모델이라 구현 정보(FK 컬럼, 타입, 인덱스, 대리키 ID)는 넣지 않는다. 연결 테이블(장바구니항목옵션,
// 주문항목옵션)은 M:N 관계로 그린다. 배치는 격자 기본값이며 draw.io 에서 옮겨도 된다.

// [이름, 열, 행, 식별자, 대표 속성]. 식별자는 DB가 모든 행에서 유일함을 보장하는 값만 쓴다
// (이름·별칭·일시처럼 겹칠 수 있는 값은 대표 속성으로 두고 번호로 식별한다)
const ENTITIES = [
  ["영업시간", 0, 0, "영업시간번호", "요일"],
  ["가게", 2, 0, "사업자번호", "가게명"],
  ["메뉴분류", 3, 0, "분류번호", "분류명"],
  ["메뉴", 4, 0, "메뉴번호", "메뉴명"],
  ["옵션그룹", 5, 0, "옵션그룹번호", "그룹명"],
  ["입점신청", 1, 1, "신청번호", "심사상태"],
  ["장바구니", 2, 1, "회원", "담은일시"],
  ["장바구니항목", 4, 1, "항목번호", "수량"],
  ["옵션", 5, 1, "옵션번호", "옵션명"],
  ["회원주소", 0, 2, "주소번호", "주소별칭"],
  ["회원", 1, 2, "회원번호", "이메일"],
  ["주문", 3, 2, "주문번호", "주문상태"],
  ["주문항목", 4, 2, "주문+주문순번", "수량"],
  ["라이더", 0, 3, "회원", "운송수단"],
  ["포인트거래", 1, 3, "거래번호", "거래유형"],
  ["결제", 2, 3, "결제번호", "결제수단"],
  ["배달", 3, 3, "배달번호", "완료일시"],
  ["회원제한", 0, 4, "제한번호", "제한유형"],
  ["리뷰신고", 1, 4, "신고자+리뷰", "처리상태"],
  ["리뷰", 3, 4, "주문", "평점"],
  ["답글", 4, 4, "리뷰", "내용"],
];

// [엔터티A, 관계, 엔터티B, A쪽 카디널리티, B쪽 카디널리티]
const RELS = [
  ["회원", "소유", "가게", "1", "N"],
  ["회원", "등록", "회원주소", "1", "N"],
  ["회원", "ISA", "라이더", "1", "1"],
  ["가게", "운영", "영업시간", "1", "N"],
  ["가게", "신청", "입점신청", "1", "N"],
  ["회원", "심사", "입점신청", "1", "N"],
  ["가게", "구성", "메뉴분류", "1", "N"],
  ["메뉴분류", "포함", "메뉴", "1", "N"],
  ["메뉴", "보유", "옵션그룹", "1", "N"],
  ["옵션그룹", "구성", "옵션", "1", "N"],
  ["회원", "보유", "장바구니", "1", "1"],
  ["장바구니", "대상", "가게", "N", "1"],
  ["장바구니", "담음", "장바구니항목", "1", "N"],
  ["장바구니항목", "선택", "메뉴", "N", "1"],
  ["장바구니항목", "옵션선택", "옵션", "M", "N"],
  ["회원", "주문함", "주문", "1", "N"],
  ["가게", "접수", "주문", "1", "N"],
  ["회원", "취소처리", "주문", "1", "N"],
  ["주문", "포함", "주문항목", "1", "N"],
  ["주문항목", "선택", "메뉴", "N", "1"],
  ["주문항목", "옵션선택", "옵션", "M", "N"],
  ["주문", "결제", "결제", "1", "1"],
  ["회원", "거래", "포인트거래", "1", "N"],
  ["주문", "연관", "포인트거래", "1", "N"],
  ["주문", "배달", "배달", "1", "1"],
  ["라이더", "수행", "배달", "1", "N"],
  ["주문", "평가", "리뷰", "1", "1"],
  ["리뷰", "답변", "답글", "1", "1"],
  ["회원", "작성", "답글", "1", "N"],
  ["리뷰", "신고됨", "리뷰신고", "1", "N"],
  ["회원", "신고", "리뷰신고", "1", "N"],
  ["회원", "처리", "리뷰신고", "1", "N"],
  ["회원", "제한됨", "회원제한", "1", "N"],
  ["리뷰신고", "근거", "회원제한", "1", "N"],
  ["회원", "부과", "회원제한", "1", "N"],
];

const CW = 330, RH = 260, X0 = 80, Y0 = 120, EW = 120, EH = 50;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cells = [];
let n = 2;
const id = () => `c${n++}`;
const pos = {};
const boxes = []; // 이미 놓인 도형 영역. 마름모가 겹치지 않게 피할 때 쓴다
const vertex = (value, style, x, y, w, h) => {
  const i = id();
  boxes.push({ x, y, w, h });
  cells.push(`<mxCell id="${i}" value="${esc(value)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  return i;
};
const overlaps = (x, y, w, h) => boxes.some((b) => x < b.x + b.w + 10 && x + w + 10 > b.x && y < b.y + b.h + 10 && y + h + 10 > b.y);
const edge = (src, dst, label = "") => {
  cells.push(`<mxCell id="${id()}" value="${esc(label)}" style="endArrow=none;html=1;rounded=0;fontStyle=1;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="${src}" target="${dst}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
};

for (const [name, c, r, key, attr] of ENTITIES) {
  const x = X0 + c * CW, y = Y0 + r * RH;
  const e = vertex(name, "rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;", x, y, EW, EH);
  pos[name] = { id: e, x: x + EW / 2, y: y + EH / 2 };
  const k = vertex(`<u>${esc(key)}</u>`, "ellipse;whiteSpace=wrap;html=1;fontSize=10;", x - 70, y - 70, 100, 34);
  const a = vertex(attr, "ellipse;whiteSpace=wrap;html=1;fontSize=10;", x + 90, y - 70, 100, 34);
  edge(e, k);
  edge(e, a);
}

// 마름모는 두 엔터티 사이 선 위에 둔다. 다른 도형과 겹치면 선을 따라 옮기거나 옆으로 비켜 놓는다
for (const [a, rel, b, ca, cb] of RELS) {
  if (!pos[a] || !pos[b]) throw new Error(`없는 엔터티: ${a} / ${b}`);
  const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y, len = Math.hypot(dx, dy) || 1;
  let place = null;
  for (const side of [0, 70, -70, 140, -140, 210, -210]) {
    for (const t of [0.5, 0.35, 0.65, 0.25, 0.75]) {
      const x = pos[a].x + dx * t - 45 + (-dy / len) * side, y = pos[a].y + dy * t - 25 + (dx / len) * side;
      if (!overlaps(x, y, 90, 50)) { place = { x, y }; break; }
    }
    if (place) break;
  }
  if (!place) throw new Error(`마름모 자리를 찾지 못함: ${a} ${rel} ${b}`);
  const style = rel === "ISA"
    ? "triangle;whiteSpace=wrap;html=1;direction=south;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;"
    : "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;";
  const d = vertex(rel, style, place.x, place.y, 90, 50);
  edge(pos[a].id, d, ca);
  edge(d, pos[b].id, cb);
}

const legend = "Chen 표기 개념 ERD / 사각형: 엔터티, 마름모: 관계, 삼각형: 상위·하위 유형(ISA), 타원: 속성(밑줄 = 식별자)<br>선 위 숫자: 카디널리티(1, N, M). 원본: server/db/schema.sql (구현 정보는 물리 ERD physical.dbml 참고)";
vertex(legend, "text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=12;", X0 - 60, 10, 900, 50);

process.stdout.write(`<mxfile host="gen-conceptual.mjs"><diagram id="conceptual" name="개념 ERD"><mxGraphModel dx="1600" dy="1200" grid="1" gridSize="10" guides="1" page="1" pageScale="1" pageWidth="2200" pageHeight="1500" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>\n${cells.join("\n")}\n</root></mxGraphModel></diagram></mxfile>\n`);
console.error(JSON.stringify({ entities: ENTITIES.length, relationships: RELS.length }));
