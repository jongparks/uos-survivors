import { PLAYER_BODY_SIZE, PLAYER_SPEED, TILE_INDEX } from "../config.js";
import { getMapTile } from "./registry.js";
import type { GameMapDefinition, MapPoint } from "./types.js";
import { collidesWithMap } from "../movement.js";

export function mapDistances(map: GameMapDefinition, origin: MapPoint): Map<number, number> {
  const w = Math.ceil(map.worldWidth / map.tileSize), h = Math.ceil(map.worldHeight / map.tileSize);
  const sx = Math.floor(origin.x / map.tileSize), sy = Math.floor(origin.y / map.tileSize);
  const distances = new Map<number, number>();
  if (collidesWithMap((sx + 0.5) * map.tileSize, (sy + 0.5) * map.tileSize, map)) return distances;
  const queue = [{ x: sx, y: sy }]; distances.set(sy * w + sx, 0);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!, distance = distances.get(p.y * w + p.x)!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx, y = p.y + dy, key = y * w + x;
      if (x < 0 || y < 0 || x >= w || y >= h || distances.has(key) || getMapTile(map, x, y) !== TILE_INDEX.floor ||
        collidesWithMap((x + 0.5) * map.tileSize, (y + 0.5) * map.tileSize, map)) continue;
      distances.set(key, distance + 1); queue.push({ x, y });
    }
  }
  return distances;
}

export function validateGameMap(map: GameMapDefinition): string[] {
  const errors: string[] = [];
  if (map.tileSize <= PLAYER_BODY_SIZE || map.worldWidth <= 0 || map.worldHeight <= 0) errors.push("Invalid map scale");
  if (map.spawns.length < 8 || map.gates.length !== 4 || new Set(map.gates.map(g => g.id)).size !== 4 || map.hideSpots.length < 5) errors.push("Map requires 8 spawns, 4 unique gates and at least 5 hiding spots");
  const w = Math.ceil(map.worldWidth / map.tileSize), key = (p: MapPoint) => Math.floor(p.y / map.tileSize) * w + Math.floor(p.x / map.tileSize);
  const reachable = mapDistances(map, map.spawns[0] ?? { x: 0, y: 0 });
  const points = [...map.spawns.map((p, i) => ({ ...p, id: `spawn-${i}` })), ...map.gates, ...map.hideSpots];
  for (const p of points) {
    if (collidesWithMap(p.x, p.y, map)) errors.push(`${p.id}: collides`);
    else if (!reachable.has(key(p))) errors.push(`${p.id}: unreachable`);
  }
  const distances = map.gates.map(gate => mapDistances(map, gate));
  for (let a = 0; a < distances.length; a++) for (let b = a + 1; b < distances.length; b++) {
    for (const pointKey of reachable.keys()) {
      const distance = Math.min(distances[a]!.get(pointKey) ?? Infinity, distances[b]!.get(pointKey) ?? Infinity);
      if (distance * map.tileSize / PLAYER_SPEED > 60) { errors.push(`Gate pair ${a}/${b}: exit travel exceeds 60 seconds`); break; }
    }
  }
  return errors;
}
