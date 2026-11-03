import { describe, expect, it } from "vitest";

import { CHARACTER_IDS, pickRandomHumanCharacter } from "./characters.js";

describe("human character assignment", () => {
  it("maps a server random roll to either available human character", () => {
    expect(pickRandomHumanCharacter(0)).toBe(CHARACTER_IDS.fossil);
    expect(pickRandomHumanCharacter(0.199)).toBe(CHARACTER_IDS.fossil);
    expect(pickRandomHumanCharacter(0.2)).toBe(CHARACTER_IDS.sportsStudent);
    expect(pickRandomHumanCharacter(0.399)).toBe(CHARACTER_IDS.sportsStudent);
    expect(pickRandomHumanCharacter(0.4)).toBe(CHARACTER_IDS.sculptureStudent);
    expect(pickRandomHumanCharacter(0.6)).toBe(CHARACTER_IDS.engineeringStudent);
    expect(pickRandomHumanCharacter(0.8)).toBe(CHARACTER_IDS.computerStudent);
    expect(pickRandomHumanCharacter(0.999)).toBe(CHARACTER_IDS.computerStudent);
  });
});
