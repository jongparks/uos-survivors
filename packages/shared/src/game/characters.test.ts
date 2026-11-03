import { describe, expect, it } from "vitest";

import { CHARACTER_IDS, pickRandomHumanCharacter } from "./characters.js";

describe("human character assignment", () => {
  it("maps a server random roll to either available human character", () => {
    expect(pickRandomHumanCharacter(0)).toBe(CHARACTER_IDS.fossil);
    expect(pickRandomHumanCharacter(0.333)).toBe(CHARACTER_IDS.fossil);
    expect(pickRandomHumanCharacter(0.334)).toBe(CHARACTER_IDS.sportsStudent);
    expect(pickRandomHumanCharacter(0.666)).toBe(CHARACTER_IDS.sportsStudent);
    expect(pickRandomHumanCharacter(0.667)).toBe(CHARACTER_IDS.sculptureStudent);
    expect(pickRandomHumanCharacter(0.999)).toBe(CHARACTER_IDS.sculptureStudent);
  });
});
