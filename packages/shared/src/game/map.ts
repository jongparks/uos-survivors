import { PLAYER_SPAWNS, TEST_MAP_HEIGHT, TEST_MAP_WIDTH, TILE_INDEX } from "./config.js";

function isObstacle(x: number, y: number): boolean {
  const outerWall = x === 0 || y === 0 || x === TEST_MAP_WIDTH - 1 || y === TEST_MAP_HEIGHT - 1;
  const westBuilding = x >= 7 && x <= 10 && y >= 5 && y <= 8;
  const centralDivider = x === 16 && y >= 3 && y <= 17 && y !== 10;
  const eastBuilding = x >= 23 && x <= 29 && y >= 4 && y <= 6;
  const southPlanter = x >= 22 && x <= 27 && y >= 15 && y <= 17;

  return outerWall || westBuilding || centralDivider || eastBuilding || southPlanter;
}

export const TEST_MAP_DATA = Array.from({ length: TEST_MAP_HEIGHT }, (_, y) =>
  Array.from({ length: TEST_MAP_WIDTH }, (_, x) =>
    isObstacle(x, y) ? TILE_INDEX.wall : TILE_INDEX.floor,
  ),
);

export function getTestMapTile(x: number, y: number): number | undefined {
  return TEST_MAP_DATA[y]?.[x];
}

export function areSpawnTilesWalkable(): boolean {
  return PLAYER_SPAWNS.every(
    ({ tileX, tileY }) => getTestMapTile(tileX, tileY) === TILE_INDEX.floor,
  );
}

