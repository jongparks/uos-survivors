import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_ID, GAME_MAPS, getGameMap, getMapTiles } from "./registry.js";
import { validateGameMap } from "./validation.js";
describe("registered outdoor maps", () => {
  for (const map of Object.values(GAME_MAPS)) it(`${map.id} validates spawns, gates, hiding spots and all open-gate travel pairs`, () => {
    expect(validateGameMap(map)).toEqual([]);
  });
  it("refuses unknown maps instead of silently choosing different collision data", () => expect(() => getGameMap("UNKNOWN")).toThrow());
  it("keeps the same collision and interaction geometry in both campus variants", () => {
    const day = getGameMap(DEFAULT_MAP_ID);
    const night = getGameMap("MAP_UOS_CAMPUS_NIGHT");
    expect(night.lighting).toBe("night");
    expect(getMapTiles(night)).toEqual(getMapTiles(day));
    expect(night.gates).toEqual(day.gates);
    expect(night.spawns).toEqual(day.spawns);
    expect(night.hideSpots).toEqual(day.hideSpots);
  });
});
