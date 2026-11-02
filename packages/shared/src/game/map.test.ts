import { describe, expect, it } from "vitest";

import { TEST_MAP_HEIGHT, TEST_MAP_WIDTH, TILE_INDEX } from "./config.js";
import { areSpawnTilesWalkable, getTestMapTile, TEST_MAP_DATA } from "./map.js";

describe("test map", () => {
  it("uses the configured dimensions", () => {
    expect(TEST_MAP_DATA).toHaveLength(TEST_MAP_HEIGHT);
    expect(TEST_MAP_DATA.every((row) => row.length === TEST_MAP_WIDTH)).toBe(true);
  });

  it("surrounds the playable area with walls", () => {
    for (let x = 0; x < TEST_MAP_WIDTH; x += 1) {
      expect(getTestMapTile(x, 0)).toBe(TILE_INDEX.wall);
      expect(getTestMapTile(x, TEST_MAP_HEIGHT - 1)).toBe(TILE_INDEX.wall);
    }

    for (let y = 0; y < TEST_MAP_HEIGHT; y += 1) {
      expect(getTestMapTile(0, y)).toBe(TILE_INDEX.wall);
      expect(getTestMapTile(TEST_MAP_WIDTH - 1, y)).toBe(TILE_INDEX.wall);
    }
  });

  it("keeps all eight player spawns on floor tiles", () => {
    expect(areSpawnTilesWalkable()).toBe(true);
  });
});

