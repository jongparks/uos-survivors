import { describe, expect, it } from "vitest";

import { CHARACTER_IDS, pickRandomHumanCharacter } from "./characters.js";

describe("human character assignment", () => {
  it("maps a server random roll to either available human character", () => {
    expect(pickRandomHumanCharacter(0)).toBe(CHARACTER_IDS.fossil);
    expect(pickRandomHumanCharacter(0.249)).toBe(CHARACTER_IDS.fossil);
    expect(pickRandomHumanCharacter(0.25)).toBe(CHARACTER_IDS.sportsStudent);
    expect(pickRandomHumanCharacter(0.499)).toBe(CHARACTER_IDS.sportsStudent);
    expect(pickRandomHumanCharacter(0.5)).toBe(CHARACTER_IDS.sculptureStudent);
    expect(pickRandomHumanCharacter(0.75)).toBe(CHARACTER_IDS.engineeringStudent);
    expect(pickRandomHumanCharacter(0.999)).toBe(CHARACTER_IDS.engineeringStudent);
  });
});
