import {
  PLAYER_BODY_SIZE,
  TILE_INDEX,
} from "./config.js";
import { TEST_GAME_MAP, getMapTile } from "./maps/registry.js";
import type { GameMapDefinition } from "./maps/types.js";
import type { MovementAxes } from "../messages/index.js";
import { overlapsMapFootprint } from "./maps/footprints.js";

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export function calculateVelocity(input: MovementAxes, speed: number): Velocity {
  const horizontal = input.moveX;
  const vertical = input.moveY;

  if (horizontal === 0 && vertical === 0) {
    return { x: 0, y: 0 };
  }

  const magnitude = Math.hypot(horizontal, vertical);

  return {
    x: (horizontal / magnitude) * speed,
    y: (vertical / magnitude) * speed,
  };
}

export function collidesWithTestMap(x: number, y: number, map: GameMapDefinition = TEST_GAME_MAP): boolean {
  const TILE_SIZE = map.tileSize;
  const halfSize = PLAYER_BODY_SIZE / 2;
  if (x - halfSize < 0 || y - halfSize < 0 || x + halfSize > map.worldWidth || y + halfSize > map.worldHeight) return true;
  if (!map.collisionTiles) return overlapsMapFootprint(map, x, y, halfSize);
  const left = Math.floor((x - halfSize) / TILE_SIZE);
  const right = Math.floor((x + halfSize - 0.001) / TILE_SIZE);
  const top = Math.floor((y - halfSize) / TILE_SIZE);
  const bottom = Math.floor((y + halfSize - 0.001) / TILE_SIZE);

  for (let tileY = top; tileY <= bottom; tileY += 1) {
    for (let tileX = left; tileX <= right; tileX += 1) {
      if (getMapTile(map, tileX, tileY) !== TILE_INDEX.floor) {
        return true;
      }
    }
  }

  return false;
}

export function moveWithTestMapCollision(
  position: Position,
  input: MovementAxes,
  speed: number,
  deltaSeconds: number,
  map: GameMapDefinition = TEST_GAME_MAP,
): Position {
  const velocity = calculateVelocity(input, speed);
  const halfSize = PLAYER_BODY_SIZE / 2;
  const maxX = map.worldWidth - halfSize;
  const maxY = map.worldHeight - halfSize;

  const nextX = Math.min(maxX, Math.max(halfSize, position.x + velocity.x * deltaSeconds));
  const diagonalY = Math.min(maxY, Math.max(halfSize, position.y + velocity.y * deltaSeconds));
  if (!map.collisionTiles && !collidesWithTestMap(nextX, diagonalY, map)) return { x: nextX, y: diagonalY };
  const resolvedX = collidesWithTestMap(nextX, position.y, map) ? position.x : nextX;
  const nextY = diagonalY;
  const resolvedY = collidesWithTestMap(resolvedX, nextY, map) ? position.y : nextY;

  return { x: resolvedX, y: resolvedY };
}

export function applyMovementWithTestMapCollision(
  position: Position,
  input: MovementAxes,
  speed: number,
  deltaSeconds: number,
  map: GameMapDefinition = TEST_GAME_MAP,
): void {
  const nextPosition = moveWithTestMapCollision(position, input, speed, deltaSeconds, map);

  position.x = nextPosition.x;
  position.y = nextPosition.y;
}
export const collidesWithMap = collidesWithTestMap;
export const moveWithMapCollision = moveWithTestMapCollision;

/** Returns the clear distance along a straight dash, stopping at the first footprint. */
export function clearDashDistance(map: GameMapDefinition, position: Position, direction: Velocity, distance: number): number {
  const steps = Math.ceil(distance / 2);
  let clear = 0;
  for (let i = 1; i <= steps; i++) {
    const next = distance * i / steps;
    if (!collidesWithMap(position.x + direction.x * next, position.y + direction.y * next, map)) {
      clear = next;
      continue;
    }
    let blocked = next;
    for (let j = 0; j < 7; j++) {
      const mid = (clear + blocked) / 2;
      if (collidesWithMap(position.x + direction.x * mid, position.y + direction.y * mid, map)) blocked = mid;
      else clear = mid;
    }
    break;
  }
  return clear;
}

