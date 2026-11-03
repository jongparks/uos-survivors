import { describe, expect, it } from "vitest";
import { GAME_MAPS, getGameMap } from "./registry.js";
import { validateGameMap } from "./validation.js";
describe("registered outdoor maps", () => {
  for (const map of Object.values(GAME_MAPS)) it(`${map.id} validates spawns, gates, hiding spots and all open-gate travel pairs`, () => {
    expect(validateGameMap(map)).toEqual([]);
  });
  it("refuses unknown maps instead of silently choosing different collision data", () => expect(() => getGameMap("UNKNOWN")).toThrow());
});
