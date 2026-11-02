import {
  PLAYER_BODY_SIZE,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  TILE_INDEX,
  TILE_SIZE,
} from "./config.js";
import { getTestMapTile } from "./map.js";
import type { MovementInput } from "../messages/index.js";

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export function calculateVelocity(input: MovementInput, speed: number): Velocity {
  const horizontal = Number(input.right) - Number(input.left);
  const vertical = Number(input.down) - Number(input.up);

  if (horizontal === 0 && vertical === 0) {
    return { x: 0, y: 0 };
  }

  const magnitude = Math.hypot(horizontal, vertical);

  return {
    x: (horizontal / magnitude) * speed,
    y: (vertical / magnitude) * speed,
  };
}

export function collidesWithTestMap(x: number, y: number): boolean {
  const halfSize = PLAYER_BODY_SIZE / 2;
  const left = Math.floor((x - halfSize) / TILE_SIZE);
  const right = Math.floor((x + halfSize - 0.001) / TILE_SIZE);
  const top = Math.floor((y - halfSize) / TILE_SIZE);
  const bottom = Math.floor((y + halfSize - 0.001) / TILE_SIZE);

  for (let tileY = top; tileY <= bottom; tileY += 1) {
    for (let tileX = left; tileX <= right; tileX += 1) {
      if (getTestMapTile(tileX, tileY) !== TILE_INDEX.floor) {
        return true;
      }
    }
  }

  return false;
}

export function moveWithTestMapCollision(
  position: Position,
  input: MovementInput,
  speed: number,
  deltaSeconds: number,
): Position {
  const velocity = calculateVelocity(input, speed);
  const halfSize = PLAYER_BODY_SIZE / 2;
  const maxX = TEST_MAP_WIDTH * TILE_SIZE - halfSize;
  const maxY = TEST_MAP_HEIGHT * TILE_SIZE - halfSize;

  const nextX = Math.min(maxX, Math.max(halfSize, position.x + velocity.x * deltaSeconds));
  const resolvedX = collidesWithTestMap(nextX, position.y) ? position.x : nextX;
  const nextY = Math.min(maxY, Math.max(halfSize, position.y + velocity.y * deltaSeconds));
  const resolvedY = collidesWithTestMap(resolvedX, nextY) ? position.y : nextY;

  return { x: resolvedX, y: resolvedY };
}

