import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_ID, GAME_MAPS, getGameMap, getMapTiles } from "./registry.js";
import { validateGameMap } from "./validation.js";
import { collidesWithMap } from "../movement.js";
import { CAMPUS_MAP } from "./campus.js";
describe("registered outdoor maps", () => {
  for (const map of Object.values(GAME_MAPS)) it(`${map.id} validates spawns, gates, hiding spots and all open-gate travel pairs`, () => {
    expect(validateGameMap(map)).toEqual([]);
  });
  it("refuses unknown maps instead of silently choosing different collision data", () => expect(() => getGameMap("UNKNOWN")).toThrow());
  it("keeps the same collision and interaction geometry in both campus variants", () => {
    const day = CAMPUS_MAP;
    const night = getGameMap(DEFAULT_MAP_ID);
    expect(night.lighting).toBe("night");
    expect(() => getGameMap(day.id)).toThrow();
    expect(getMapTiles(night)).toEqual(getMapTiles(day));
    expect(night.gates).toEqual(day.gates);
    expect(night.spawns).toEqual(day.spawns);
    expect(night.hideSpots).toEqual(day.hideSpots);
    const bodies = night.decorations.filter(decoration => decoration.kind === "fallenBody");
    expect(bodies).not.toHaveLength(0);
    for (const body of bodies) expect(collidesWithMap(body.x, body.y, night)).toBe(false);
  });
  it("blocks individual cars and leaves the empty parking bay and footbridge walkable", () => {
    const map = getGameMap(DEFAULT_MAP_ID);
    const [first, second] = map.objects.filter(object => object.id.startsWith("prop-2-car-"));
    expect(first && second).toBeTruthy();
    const y = first!.y + first!.height / 2;
    expect(collidesWithMap(first!.x + first!.width / 2, y, map)).toBe(true);
    expect(collidesWithMap((first!.x + first!.width + second!.x) / 2, y, map)).toBe(false);

    const [upper, lower] = map.objects.filter(object => object.kind === "pond");
    const bridgeX = upper!.x + upper!.width / 2;
    expect(collidesWithMap(bridgeX, upper!.y + upper!.height / 2, map)).toBe(true);
    expect(collidesWithMap(bridgeX, (upper!.y + upper!.height + lower!.y) / 2, map)).toBe(false);
  });
});
