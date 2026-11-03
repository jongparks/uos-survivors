import { pointInPolygon, type GameMapDefinition, type MapPoint, type StaticMapObject } from "./types.js";

// Relative positions traced from the official outdoor guide (not a collision
// image). Footprints/path widths are intentionally reconstructed for play.
const width = 3120, height = 1680, tile = 32;
const point = (x: number, y: number): MapPoint => ({ x: Math.round(x / 2048 * width / tile) * tile + 16, y: Math.round(y / 1107 * height / tile) * tile + 16 });
const rect = (x: number, y: number, w: number, h: number): MapPoint[] => {
  const p = point(x, y); return [p, { x: p.x + w / 2048 * width, y: p.y }, { x: p.x + w / 2048 * width, y: p.y + h / 1107 * height }, { x: p.x, y: p.y + h / 1107 * height }];
};
const buildingData: Array<[string, number, number, number, number]> = [
  ["100주년기념관", 225, 445, 100, 180], ["전농관", 410, 650, 110, 80],
  ["미래관", 530, 385, 65, 65], ["조형관", 405, 490, 100, 55],
  ["대학본부", 645, 355, 105, 60], ["시대융합관", 790, 350, 105, 45],
  ["창의혁신관", 940, 330, 42, 110], ["배봉관", 1020, 365, 100, 65],
  ["창공관", 1185, 405, 160, 50], ["시대인재관", 1235, 310, 65, 45],
  ["중앙도서관", 1455, 295, 175, 120], ["생활관", 1700, 295, 155, 75],
  ["국제학사", 1610, 435, 130, 90], ["건설공학관", 695, 555, 58, 140],
  ["학생회관", 1095, 585, 110, 110], ["인문학관", 1280, 575, 75, 120],
  ["21세기관", 805, 730, 135, 85], ["대강당", 1035, 775, 100, 70],
  ["정보기술관", 1200, 800, 140, 65], ["자연과학관", 905, 895, 155, 55],
  ["미디어관", 1140, 910, 30, 40], ["박물관", 500, 765, 95, 25],
  ["경농관", 385, 815, 210, 30], ["자작마루", 660, 820, 55, 40],
  ["법학관", 390, 975, 225, 65], ["웰니스센터", 395, 930, 100, 35],
  ["토목구조실험동", 630, 980, 38, 65], ["건축구조실험동", 690, 965, 40, 55],
  ["과학기술관", 635, 155, 50, 140], ["스마트연구동", 420, 45, 140, 30],
  ["직장어린이집", 625, 65, 35, 45], ["음악관", 1570, 665, 90, 70],
];
const objects: StaticMapObject[] = buildingData.map(([name, x, y, w, h], i) => {
  const p = point(x, y); return { id: `building-${i}`, name, kind: "building", x: p.x - 16, y: p.y - 16,
    width: Math.max(32, Math.round(w / 2048 * width / tile) * tile), height: Math.max(32, Math.round(h / 1107 * height / tile) * tile) };
});
const pond = point(1410, 520);
objects.push({ id: "sky-pond", name: "하늘못", kind: "pond", x: pond.x - 16, y: pond.y - 16, width: 64, height: 192 });
const gatePoints = [point(250, 700), point(590, 95), point(950, 970), point(1310, 370)];
const spawns = [point(350, 715), point(605, 465), point(810, 510), point(1020, 535), point(1220, 745), point(1500, 480), point(760, 910), point(580, 330)];
const hidePositions = [point(360, 650), point(610, 510), point(850, 470), point(1040, 500), point(1230, 740), point(1490, 490), point(760, 900), point(580, 325)];

const campus: GameMapDefinition = {
  id: "MAP_UOS_CAMPUS_V2", name: "서울시립대학교 캠퍼스", tileSize: tile, worldWidth: width, worldHeight: height,
  source: "https://www.uos.ac.kr/kor/html/auos/guide/map/map.do?identified=anonymous",
  boundary: [[150, 675], [180, 460], [335, 320], [375, 45], [525, 5], [680, 30], [715, 290], [1000, 260], [1165, 330], [1360, 205], [1540, 205], [1900, 335], [1990, 650], [1840, 980], [1460, 940], [1370, 1010], [1080, 980], [940, 1040], [380, 1100], [335, 950], [155, 830]].map(([x, y]) => point(x!, y!)),
  objects,
  ground: [
    { kind: "field", points: rect(425, 150, 140, 190) },
    { kind: "plaza", points: rect(800, 480, 250, 215) },
    ...[[240, 685, 1110, 55], [360, 875, 1015, 50], [590, 80, 40, 810], [770, 460, 45, 450], [980, 450, 45, 460], [1350, 390, 45, 500], [630, 465, 920, 45], [1180, 730, 45, 180]].map(([x, y, w, h]) => ({ kind: "path" as const, points: rect(x!, y!, w!, h!) })),
  ],
  decorations: spawns.map((p, i) => ({ x: p.x + 32, y: p.y + 32, kind: i % 2 ? "lamp" as const : "bench" as const })),
  spawns,
  gates: gatePoints.map((p, i) => ({ ...p, id: `GATE_${"ABCD"[i]}`, name: ["정문", "미래문", "이음문", "하늘문"][i]!, side: ["WEST", "NORTH", "SOUTH", "NORTHEAST"][i]!, interactionRadius: 48 })),
  hideSpots: hidePositions.map((p, i) => ({ ...p, id: `campus-hide-${i}`, zoneId: `zone-${i}`, exitX: p.x, exitY: p.y, interactionRadius: 40 })),
  protectedPoints: [...gatePoints, ...spawns],
};

// Garden trees have explicit trunks/collision footprints. Keep planted groups
// off roads and well away from mandatory interaction/arrival points.
const trees: StaticMapObject[] = [];
for (let y = 160; y < height - 64; y += 112) for (let x = 320; x < width - 100; x += 128) {
  const seed = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0);
  if (seed % 5 === 0) continue;
  const p = { x: Math.floor((x + seed % 97 - 48) / tile) * tile, y: Math.floor((y + (seed >>> 8) % 65 - 32) / tile) * tile };
  const corners = [p, { x: p.x + 64, y: p.y }, { x: p.x, y: p.y + 64 }, { x: p.x + 64, y: p.y + 64 }];
  if (!corners.every(c => pointInPolygon(c, campus.boundary))) continue;
  if (campus.ground.some(a => {
    const xs = a.points.map(c => c.x), ys = a.points.map(c => c.y);
    return p.x < Math.max(...xs) + 16 && p.x + 64 > Math.min(...xs) - 16 && p.y < Math.max(...ys) + 16 && p.y + 64 > Math.min(...ys) - 16;
  })) continue;
  if (objects.some(o => p.x < o.x + o.width + 24 && p.x + 64 > o.x - 24 && p.y < o.y + o.height + 24 && p.y + 64 > o.y - 24)) continue;
  if ([...spawns, ...gatePoints, ...hidePositions].some(q => Math.hypot(q.x - p.x - 32, q.y - p.y - 32) < 110)) continue;
  trees.push({ id: `garden-tree-${trees.length}`, name: "", kind: "tree", ...p, width: 64, height: 64 });
}
export const CAMPUS_MAP: GameMapDefinition = { ...campus, objects: [...objects, ...trees] };
