// Run after building shared. Measures the longest shortest path between all
// walkable tile centers, with eight-direction movement and no corner cutting.
// This is a grid approximation, not a timed human playtest.
import { getGameMap, DEFAULT_MAP_ID, collidesWithMap, PLAYER_SPEED } from "../../../packages/shared/dist/index.js";

const map = getGameMap(process.argv[2] ?? DEFAULT_MAP_ID), t = map.tileSize;
const nodes = [], index = new Map();
for (let y = 0; y < Math.floor(map.worldHeight / t); y++) for (let x = 0; x < Math.floor(map.worldWidth / t); x++) {
  if (collidesWithMap((x + .5) * t, (y + .5) * t, map)) continue;
  index.set(`${x},${y}`, nodes.length); nodes.push({ x, y });
}
const edges = nodes.map(p => {
  const result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const target = index.get(`${p.x + dx},${p.y + dy}`);
    if (target === undefined) continue;
    if (dx && dy && (!index.has(`${p.x + dx},${p.y}`) || !index.has(`${p.x},${p.y + dy}`))) continue;
    if (collidesWithMap((p.x + .5 + dx * .5) * t, (p.y + .5 + dy * .5) * t, map)) continue;
    result.push([target, Math.hypot(dx, dy) * t]);
  }
  return result;
});
function distances(start) {
  const d = new Float64Array(nodes.length).fill(Infinity), heap = [];
  function push(value) {
    heap.push(value); let i = heap.length - 1;
    while (i) { const parent = (i - 1) >> 1; if (heap[parent][0] <= value[0]) break; heap[i] = heap[parent]; i = parent; }
    heap[i] = value;
  }
  function pop() {
    const result = heap[0], value = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1][0] < heap[child][0]) child++;
        if (heap[child][0] >= value[0]) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = value;
    }
    return result;
  }
  d[start] = 0; push([0, start]);
  while (heap.length) {
    const [cost, from] = pop(); if (cost > d[from]) continue;
    for (const [to, length] of edges[from]) if (cost + length < d[to]) { d[to] = cost + length; push([d[to], to]); }
  }
  return d;
}
let longest = 0, pair = [];
for (let from = 0; from < nodes.length; from++) {
  const d = distances(from);
  for (let to = from + 1; to < nodes.length; to++) if (Number.isFinite(d[to]) && d[to] > longest) { longest = d[to]; pair = [from, to]; }
}
console.log(JSON.stringify({
  mapId: map.id, world: [map.worldWidth, map.worldHeight], speed: PLAYER_SPEED,
  walkableNodes: nodes.length, longestShortestPathPixels: longest, seconds: longest / PLAYER_SPEED,
  endpoints: pair.map(i => ({ x: (nodes[i].x + .5) * t, y: (nodes[i].y + .5) * t })),
  method: "Eight-direction tile-center approximation; no abilities or other players",
}, null, 2));
