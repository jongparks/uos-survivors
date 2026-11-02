export const PLAYER_SPEED = 220;
export const PLAYER_BODY_SIZE = 26;

export const TILE_SIZE = 48;
export const TEST_MAP_WIDTH = 34;
export const TEST_MAP_HEIGHT = 22;

export const TILE_INDEX = {
  floor: 1,
  wall: 2,
} as const;

export const PLAYER_SPAWNS = [
  { tileX: 3, tileY: 3 },
  { tileX: 5, tileY: 3 },
  { tileX: 3, tileY: 10 },
  { tileX: 5, tileY: 12 },
  { tileX: 20, tileY: 3 },
  { tileX: 21, tileY: 10 },
  { tileX: 30, tileY: 10 },
  { tileX: 30, tileY: 18 },
] as const;

export function tileToWorld(tile: number): number {
  return (tile + 0.5) * TILE_SIZE;
}

