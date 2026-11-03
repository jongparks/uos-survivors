import { pointInPolygon, type GameMapDefinition, type MapDecorationKind, type MapGroundKind, type MapPoint, type StaticMapObject } from "./types.js";
import { scaleGameMap } from "./scale.js";

/*
 * 서울시립대학교 캠퍼스 V3.
 * Layout traced from Kakao Map sky view (2026) and the official outdoor guide,
 * then widened for play: footprints are slightly inset so every intended
 * passage is at least two collision tiles wide. Coordinates below are written
 * in a "survey" frame (≈ the sky-view screenshot frame, north up) and mapped
 * into the authored 3120 × 1680 frame. The authored map is then enlarged ×1.8
 * exactly like V2, so the world size stays 5616 × 3024.
 */
const width = 3120, height = 1680, tile = 32;
const SX = 2.712, SY = 2.5;
const P = (gx: number, gy: number): MapPoint => ({ x: Math.round(228 + (gx - 110) * SX), y: Math.round(12 + (gy - 184) * SY) });
const poly = (pts: ReadonlyArray<readonly [number, number]>): MapPoint[] => pts.map(([x, y]) => P(x, y));
const rectPts = (x0: number, y0: number, x1: number, y1: number): MapPoint[] => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** Thick polyline → one quad per segment plus a joint square (art ground only). */
function stroke(pts: ReadonlyArray<readonly [number, number]>, w: number): MapPoint[][] {
  const out: MapPoint[][] = [];
  const q = pts.map(([x, y]) => P(x, y));
  const half = w * (SX + SY) / 4;
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i]!, b = q[i + 1]!, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len * half, ny = (b.x - a.x) / len * half;
    out.push([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]);
  }
  for (const p of q.slice(1, -1)) {
    const r = half;
    out.push(Array.from({ length: 8 }, (_, k) => ({ x: p.x + Math.cos(k * Math.PI / 4 + Math.PI / 8) * r * 1.08, y: p.y + Math.sin(k * Math.PI / 4 + Math.PI / 8) * r * 1.08 })));
  }
  return out;
}

// ── Buildings: [name, x0, y0, x1, y1] in survey units. Extra wings repeat the name.
const buildingData: Array<[string, number, number, number, number]> = [
  ["100주년기념관", 140, 402, 222, 466], ["100주년기념관", 146, 476, 212, 552],
  ["조형관", 246, 452, 330, 478],
  ["미래관", 332, 390, 376, 440],
  ["스마트연구동", 262, 190, 318, 200],
  ["과학기술관", 406, 238, 438, 326],
  ["직장어린이집", 450, 210, 470, 232],
  ["대학본부", 404, 372, 474, 402],
  ["시대융합관", 494, 358, 576, 386], ["시대융합관", 494, 386, 514, 444], ["시대융합관", 556, 386, 576, 444],
  ["창의혁신관", 592, 370, 628, 444],
  ["배봉관", 652, 398, 722, 436],
  ["창공관", 758, 414, 866, 446],
  ["시대인재관", 798, 364, 836, 388],
  ["중앙도서관", 928, 344, 1056, 426],
  ["생활관", 1090, 344, 1136, 410],
  ["국제학사", 1036, 432, 1098, 470], ["국제학사", 1004, 470, 1076, 510],
  ["인문학관", 812, 512, 872, 532], ["인문학관", 852, 532, 872, 606], ["인문학관", 812, 586, 852, 606],
  ["학생회관", 702, 532, 770, 610],
  ["음악관", 1000, 596, 1064, 640],
  ["대강당", 662, 642, 734, 708],
  ["정보기술관", 776, 684, 862, 714], ["정보기술관", 840, 630, 862, 684],
  ["자동화온실", 792, 746, 896, 784],
  ["미디어관", 752, 746, 780, 770],
  ["자연과학관", 590, 744, 706, 772],
  ["21세기관", 518, 588, 616, 612], ["21세기관", 518, 612, 540, 688], ["21세기관", 594, 612, 616, 688],
  ["건설공학관", 462, 496, 494, 598],
  ["전농관", 262, 560, 340, 578], ["전농관", 262, 578, 280, 616],
  ["박물관", 306, 628, 382, 646],
  ["경농관", 234, 658, 382, 690],
  ["자작마루", 418, 668, 450, 694],
  ["법학관", 248, 744, 398, 826],
  ["웰니스센터", 404, 752, 432, 826],
  ["토목구조실험동", 440, 756, 460, 800],
  ["건축구조실험동", 466, 758, 486, 792],
];
const seenName = new Set<string>();
const objects: StaticMapObject[] = buildingData.map(([name, x0, y0, x1, y1], i) => {
  const a = P(x0, y0), b = P(x1, y1);
  const hideLabel = seenName.has(name); seenName.add(name);
  return { id: `building-${i}`, name, kind: "building", x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, ...(hideLabel ? { hideLabel } : {}) };
});

// 하늘못: two basins with a footbridge gap between them.
for (const [i, [x0, y0, x1, y1]] of ([[900, 484, 956, 524], [896, 540, 958, 586]] as const).entries()) {
  const a = P(x0, y0), b = P(x1, y1);
  objects.push({ id: `sky-pond-${i}`, name: "하늘못", kind: "pond", x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, ...(i ? { hideLabel: true } : {}) });
}

// Parked car rows and street furniture that block movement.
const propData: Array<[string, number, number, number, number]> = [
  ["cars-v", 510, 494, 518, 566],   // 건설공학관 옆 주차장
  ["cars-v", 524, 494, 532, 566],
  ["cars-h", 760, 620, 790, 626],   // 학생회관 뒤 주차
  ["cars-v", 744, 640, 750, 700],   // 대강당 옆 주차
  ["cars-h", 404, 410, 444, 416],   // 본부 앞 주차
  ["bike", 436, 462, 456, 468],
  ["bike", 700, 470, 716, 476],
  ["kiosk", 616, 498, 624, 506],
];
propData.forEach(([variant, x0, y0, x1, y1], i) => {
  const a = P(x0, y0), b = P(x1, y1);
  objects.push({ id: `prop-${i}`, name: "", kind: "prop", variant, x: a.x, y: a.y, width: Math.max(16, b.x - a.x), height: Math.max(16, b.y - a.y) });
});

// ── Boundary (campus fence), survey units.
const boundary = poly([
  [104, 580], [132, 548], [132, 394], [236, 382], [238, 182], [404, 182], [478, 194], [478, 340],
  [560, 344], [700, 348], [796, 344], [828, 318], [862, 320], [930, 330], [1040, 322], [1104, 326],
  [1150, 338], [1160, 420], [1132, 520], [1106, 600], [1092, 664], [1010, 690], [930, 704],
  [918, 798], [790, 806], [726, 790], [640, 790], [586, 798], [556, 790], [552, 760], [500, 762],
  [496, 846], [238, 848], [226, 724], [178, 662], [104, 618],
]);

// ── Ground (art only)
type Ground = { kind: MapGroundKind; points: MapPoint[] };
const ground: Ground[] = [];
const add = (kind: MapGroundKind, list: MapPoint[][]) => list.forEach(points => ground.push({ kind, points }));
// Surroundings outside the fence (never walkable): 휘경동·전농동 주택가, 남쪽 학교, 배봉산.
add("residential", [poly([[0, 0], [1200, 0], [1200, 300], [1104, 318], [1040, 314], [930, 322], [862, 312], [828, 310], [796, 336], [700, 340], [560, 336], [486, 332], [486, 186], [404, 174], [230, 174], [228, 376], [124, 386], [124, 546], [96, 576], [0, 576]]),
  poly([[0, 626], [96, 626], [170, 668], [218, 728], [230, 860], [0, 860]])]);
add("schoolyard", [poly([[504, 770], [552, 770], [556, 800], [640, 800], [730, 800], [790, 816], [800, 860], [504, 860]])]);
add("forest", [poly([[1110, 300], [1200, 290], [1200, 860], [930, 860], [928, 810], [924, 712], [1014, 698], [1100, 672], [1114, 600], [1140, 524], [1170, 420], [1160, 334]])]);
add("street", [poly([[0, 578], [104, 584], [104, 614], [0, 624]]), poly([[236, 850], [800, 850], [800, 860], [236, 860]])]);
// Forest & gardens first so that pavements paint on top.
add("forest", [poly([[992, 520], [1104, 520], [1096, 596], [1070, 600], [1068, 590], [992, 588]]),
  poly([[930, 640], [998, 650], [1080, 648], [1086, 664], [1010, 688], [930, 700]]),
  poly([[396, 500], [456, 496], [456, 560], [400, 558]]),
  poly([[392, 650], [460, 650], [462, 704], [392, 704]]),
  poly([[132, 560], [150, 560], [176, 640], [132, 610]])]);
add("garden", [rectPts(516, 388, 554, 444), rectPts(282, 580, 338, 614), rectPts(542, 614, 592, 686), rectPts(1062, 410, 1140, 430)]);
add("lawn", [rectPts(540, 498, 610, 580), rectPts(624, 498, 696, 584), rectPts(904, 598, 990, 632)]);
add("stage", [poly([[930, 592], [994, 592], [996, 632], [960, 640], [930, 630]])]);
add("track", [rectPts(244, 206, 378, 382)]);
add("field", [rectPts(262, 230, 360, 360)]);
add("court", [rectPts(846, 336, 912, 384), rectPts(880, 388, 914, 438)]);
add("parking", [rectPts(504, 490, 538, 572), rectPts(740, 616, 798, 632), rectPts(398, 406, 450, 420)]);
add("plaza", [poly([[176, 560], [258, 548], [258, 652], [200, 652], [172, 620]]), rectPts(398, 420, 478, 470), rectPts(916, 428, 1060, 446)]);
add("road", [
  ...stroke([[96, 597], [150, 598]], 16),
  // 정문 로터리
  Array.from({ length: 16 }, (_, k) => { const c = P(164, 600); return { x: c.x + Math.cos(k * Math.PI / 8) * 50, y: c.y + Math.sin(k * Math.PI / 8) * 46 }; }),
  ...stroke([[176, 588], [250, 544], [330, 500], [392, 470]], 16),
  ...stroke([[392, 470], [392, 196]], 14),
  ...stroke([[392, 350], [482, 348], [700, 352], [800, 352], [842, 330]], 13),
  ...stroke([[882, 336], [882, 480], [884, 620], [872, 700], [842, 728], [600, 730]], 13),
  ...stroke([[162, 614], [200, 690], [244, 714], [470, 716], [600, 730]], 14),
  ...stroke([[502, 480], [502, 716]], 12),
  ...stroke([[752, 614], [752, 728]], 12),
]);
add("path", [
  ...stroke([[392, 478], [882, 478]], 34),
  ...stroke([[486, 352], [486, 478]], 12),
  ...stroke([[640, 352], [640, 478]], 12),
  ...stroke([[740, 352], [740, 478]], 12),
  ...stroke([[617, 478], [617, 588]], 12),
  ...stroke([[790, 478], [790, 628], [770, 630]], 12),
  ...stroke([[882, 590], [930, 596], [1000, 648]], 12),
  ...stroke([[1060, 436], [1104, 470], [1090, 520]], 12),
  ...stroke([[958, 532], [1000, 528], [1004, 520]], 10),
  ...stroke([[576, 730], [576, 796]], 14),
  ...stroke([[400, 716], [402, 744]], 10),
  ...stroke([[346, 478], [346, 500]], 10),
  ...stroke([[456, 578], [500, 578]], 10),
  ...stroke([[190, 470], [236, 470], [240, 452]], 10),
  ...stroke([[884, 532], [898, 532], [960, 532]], 12),
]);

// ── Gates, spawns, hiding spots
const gatePoints = [P(112, 598), P(350, 196), P(576, 786), P(842, 330)];
const spawns = [P(206, 608), P(368, 486), P(440, 446), P(574, 486), P(660, 570), P(904, 612), P(984, 438), P(566, 650)];
const hidePositions = [P(290, 490), P(688, 452), P(410, 662), P(908, 764), P(772, 640), P(966, 614), P(404, 740), P(384, 300)];

// ── Decorations (no collision)
const deco: Array<[MapDecorationKind, number, number, number?]> = [
  ["island", 164, 600], ["clock", 152, 574], ["tower", 132, 604], ["sculpture", 214, 640], ["sculpture", 236, 600], ["sculpture", 196, 576],
  ["fountain", 688, 446], ["tower", 646, 452], ["sign", 120, 584], ["sign", 356, 202], ["sign", 582, 780], ["sign", 834, 340],
  ["crosswalk", 140, 598, 90], ["crosswalk", 392, 456, 0], ["crosswalk", 882, 466, 0], ["crosswalk", 502, 470, 0], ["crosswalk", 752, 720, 90],
  ["flowerbed", 166, 640], ["flowerbed", 400, 468], ["flowerbed", 940, 450], ["flowerbed", 1040, 450], ["flowerbed", 474, 470],
];
for (let x = 420; x <= 860; x += 36) deco.push(["bench", x, 466], ["lamp", x + 18, 491]);
for (let x = 200; x <= 380; x += 40) deco.push(["lamp", x, 716]);
for (let y = 220; y <= 440; y += 44) deco.push(["lamp", 400, y]);
for (let y = 360; y <= 700; y += 46) deco.push(["lamp", 890, y]);
for (const [x, y] of [[560, 590], [650, 590], [940, 636], [970, 628], [1010, 520], [300, 708], [214, 560], [452, 446]] as const) deco.push(["bench", x, y]);
for (let x = 150; x <= 160; x += 5) deco.push(["bollard", x, 610]);
for (const [x, y] of [[520, 600], [690, 560], [930, 612], [470, 720], [820, 724]] as const) deco.push(["manhole", x, y]);
const decorations = deco.map(([kind, x, y, angle]) => ({ ...P(x, y), kind, ...(angle !== undefined ? { angle } : {}) }));

const campus: GameMapDefinition = {
  id: "MAP_UOS_CAMPUS_V2", name: "서울시립대학교 캠퍼스 · 낮", tileSize: tile, worldWidth: width, worldHeight: height,
  source: "https://www.uos.ac.kr/kor/html/auos/guide/map/map.do?identified=anonymous",
  boundary, objects, ground, decorations, spawns,
  gates: gatePoints.map((p, i) => ({ ...p, id: `GATE_${"ABCD"[i]}`, name: ["정문", "미래문", "이음문", "하늘문"][i]!, side: ["WEST", "NORTH", "SOUTH", "NORTHEAST"][i]!, interactionRadius: 48 })),
  hideSpots: hidePositions.map((p, i) => ({ ...p, id: `campus-hide-${i}`, zoneId: `zone-${i}`, exitX: p.x, exitY: p.y, interactionRadius: 40 })),
  protectedPoints: [...gatePoints, ...spawns],
};

// ── Trees (collision). Authored rows + seeded groves + scattered garden trees.
const trees: StaticMapObject[] = [];
const keepClear = [...spawns, ...gatePoints, ...hidePositions];
const overlapsArea = (x: number, y: number, s: number, kinds: MapGroundKind[], pad: number) => ground.some(a => {
  if (!kinds.includes(a.kind)) return false;
  // Precise enough for art placement: test the four corners and centre.
  return [[x - pad, y - pad], [x + s + pad, y - pad], [x - pad, y + s + pad], [x + s + pad, y + s + pad], [x + s / 2, y + s / 2]].some(([px, py]) => pointInPolygon({ x: px!, y: py! }, a.points));
});
function tryTree(x: number, y: number, s: number, variant: string, opts: { allowIn?: MapGroundKind[] } = {}): boolean {
  x = Math.round(x); y = Math.round(y);
  const corners = [{ x, y }, { x: x + s, y }, { x, y: y + s }, { x: x + s, y: y + s }];
  if (!corners.every(c => pointInPolygon(c, boundary))) return false;
  const blocked: MapGroundKind[] = (["road", "path", "plaza", "field", "track", "court", "parking", "stage", "lawn", "garden"] as MapGroundKind[]).filter(k => !opts.allowIn?.includes(k));
  if (overlapsArea(x, y, s, blocked, 6)) return false;
  const m = opts.allowIn?.includes("forest") ? 2 : 7;
  if ([...objects, ...trees].some(o => x < o.x + o.width + m && x + s > o.x - m && y < o.y + o.height + m && y + s > o.y - m)) return false;
  if (keepClear.some(q => Math.hypot(q.x - x - s / 2, q.y - y - s / 2) < 96)) return false;
  trees.push({ id: `tree-${trees.length}`, name: "", kind: "tree", variant, x, y, width: s, height: s });
  return true;
}
const rng = (() => { let s = 20261104; return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; }; })();
// 중앙로 은행나무 가로수: planters inside both edges of the promenade, with gaps to cross.
for (let gx = 404; gx <= 872; gx += 24) {
  if ([486, 617, 640, 740, 790].some(c => Math.abs(c - gx) < 14)) continue;
  for (const gy of [465, 491]) { const c = P(gx, gy); tryTree(c.x - 16, c.y - 16, 32, "ginkgo", { allowIn: ["path"] }); }
}
// 정문 진입로 느티나무 가로수 (aerial photo: tree rows climbing the diagonal road).
{
  const a = P(176, 588), b = P(392, 470), len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  for (let d = 40; d < len - 30; d += 52) for (const side of [-1, 1]) {
    const cx = a.x + ux * d - uy * side * 46, cy = a.y + uy * d + ux * side * 46;
    tryTree(cx - 18, cy - 18, 36, "zelkova", { allowIn: ["lawn", "garden", "plaza"] });
  }
}
// Dense groves (배봉산 자락, 자작마루 숲, 전농관 뒤 숲, 하늘못 둘레)
for (const area of ground.filter(g => g.kind === "forest" && g.points.some(p => pointInPolygon(p, boundary)))) {
  const xs = area.points.map(p => p.x), ys = area.points.map(p => p.y);
  for (let y = Math.min(...ys); y < Math.max(...ys); y += 42) for (let x = Math.min(...xs); x < Math.max(...xs); x += 46) {
    const s = 34 + Math.round(rng() * 18), jx = (rng() - .5) * 18, jy = (rng() - .5) * 18;
    if (pointInPolygon({ x: x + s / 2, y: y + s / 2 }, area.points) && rng() > .18) tryTree(x + jx, y + jy, s, rng() > .7 ? "pine" : rng() > .5 ? "cherry" : "oak", { allowIn: ["forest"] });
  }
}
// Scattered garden trees on remaining grass and in planted gardens.
for (let y = 30; y < height - 30; y += 44) for (let x = 30; x < width - 30; x += 48) {
  if (rng() < .22) continue;
  const s = 30 + Math.round(rng() * 20), r = rng();
  tryTree(x + (rng() - .5) * 26, y + (rng() - .5) * 26, s, r > .82 ? "cherry" : r > .6 ? "pine" : r > .5 ? "zelkova" : "oak", { allowIn: ["garden"] });
}

const authoredCampus: GameMapDefinition = { ...campus, objects: [...objects, ...trees] };
const enlargedCampus = scaleGameMap(authoredCampus, 1.8);
export const CAMPUS_MAP: GameMapDefinition = {
  ...enlargedCampus,
  // Enlarge geography and artwork only. Ability ranges still use 32px tiles,
  // and interactions retain their existing reach in player-space pixels.
  tileSize: authoredCampus.tileSize,
  gates: enlargedCampus.gates.map((g, i) => ({ ...g, interactionRadius: authoredCampus.gates[i]!.interactionRadius })),
  hideSpots: enlargedCampus.hideSpots.map((h, i) => ({ ...h, interactionRadius: authoredCampus.hideSpots[i]!.interactionRadius })),
};

export const CAMPUS_NIGHT_MAP: GameMapDefinition = {
  ...CAMPUS_MAP,
  id: "MAP_UOS_CAMPUS_NIGHT",
  name: "서울시립대학교 캠퍼스 · 밤",
  lighting: "night",
};
