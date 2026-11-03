import { PLAYER_SPAWNS, TILE_SIZE, TEST_MAP_WIDTH, TEST_MAP_HEIGHT, tileToWorld, TILE_INDEX } from "../config.js";
import { TEST_MAP_DATA } from "../map.js";
import { CAMPUS_MAP, CAMPUS_NIGHT_MAP } from "./campus.js";
import { pointInPolygon, type GameMapDefinition } from "./types.js";

const spawns = PLAYER_SPAWNS.map(p => ({ x: tileToWorld(p.tileX), y: tileToWorld(p.tileY) }));
export const TEST_GAME_MAP: GameMapDefinition = {
  id: "MAP_TEST", name: "개발용 테스트 맵", tileSize: TILE_SIZE, worldWidth: TILE_SIZE * TEST_MAP_WIDTH, worldHeight: TILE_SIZE * TEST_MAP_HEIGHT,
  boundary: [{ x: 0, y: 0 }, { x: 1632, y: 0 }, { x: 1632, y: 1056 }, { x: 0, y: 1056 }],
  objects: [], ground: [], decorations: [], collisionTiles: TEST_MAP_DATA, spawns,
  gates: [spawns[0]!, spawns[4]!, spawns[2]!, spawns[7]!].map((p, i) => ({ ...p, id: `GATE_${"ABCD"[i]}`, name: ["정문", "미래문", "이음문", "하늘문"][i]!, side: "TEST", interactionRadius: 48 })),
  hideSpots: spawns.slice(0, 6).map((p, i) => ({ ...p, id: `test-hide-${i}`, zoneId: `${i}`, exitX: p.x, exitY: p.y, interactionRadius: 36 })), protectedPoints: spawns,
};
export const GAME_MAPS: Readonly<Record<string, GameMapDefinition>> = {
  [CAMPUS_MAP.id]: CAMPUS_MAP,
  [CAMPUS_NIGHT_MAP.id]: CAMPUS_NIGHT_MAP,
  [TEST_GAME_MAP.id]: TEST_GAME_MAP,
};
export const DEFAULT_MAP_ID = CAMPUS_MAP.id;
export function getGameMap(id = TEST_GAME_MAP.id): GameMapDefinition {
  const map = GAME_MAPS[id]; if (!map) throw new Error(`등록되지 않은 맵: ${id}`); return map;
}
const tiles = new WeakMap<GameMapDefinition, readonly (readonly number[])[]>();
export function getMapTiles(map: GameMapDefinition): readonly (readonly number[])[] {
  if (map.collisionTiles) return map.collisionTiles;
  let result = tiles.get(map);
  if (!result) {
    result = Array.from({ length: Math.ceil(map.worldHeight / map.tileSize) }, (_, y) => Array.from({ length: Math.ceil(map.worldWidth / map.tileSize) }, (_, x) => {
      const p = { x: (x + 0.5) * map.tileSize, y: (y + 0.5) * map.tileSize };
      return pointInPolygon(p, map.boundary) && !map.objects.some(o => p.x >= o.x && p.x < o.x + o.width && p.y >= o.y && p.y < o.y + o.height) ? TILE_INDEX.floor : TILE_INDEX.wall;
    })); tiles.set(map, result);
  }
  return result;
}
export function getMapTile(map: GameMapDefinition, x: number, y: number): number | undefined { return getMapTiles(map)[y]?.[x]; }
