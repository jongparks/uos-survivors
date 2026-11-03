import { describe, expect, it } from "vitest";
import { assignCharacters, MATCH_DISTRIBUTIONS, validateAssignments } from "./assignment.js";
import { CHARACTER_IDS as C, SPECIAL_HUMAN_CHARACTER_IDS, SPECIAL_ZOMBIE_CHARACTER_IDS } from "./characters.js";

describe("fixed-count random match assignment", () => {
  it.each([4, 5, 6, 7, 8])("assigns the exact distribution without duplicate special humans at %s players", count => {
    const ids = Array.from({ length: count }, (_, i) => `p${i}`);
    for (let trial = 0; trial < 100; trial++) {
      const result = assignCharacters(ids), chars = [...result.values()];
      expect(validateAssignments(ids, result)).toBe(true);
      expect(result.size).toBe(count);
      expect(chars.filter(c => c === C.normalHuman)).toHaveLength(MATCH_DISTRIBUTIONS[count]!.normalHuman);
      expect(chars.filter(c => SPECIAL_ZOMBIE_CHARACTER_IDS.includes(c as typeof SPECIAL_ZOMBIE_CHARACTER_IDS[number]))).toHaveLength(1);
      const special = chars.filter(c => SPECIAL_HUMAN_CHARACTER_IDS.includes(c as typeof SPECIAL_HUMAN_CHARACTER_IDS[number]));
      expect(special).toHaveLength(MATCH_DISTRIBUTIONS[count]!.specialHuman);
      expect(new Set(special).size).toBe(special.length); expect(chars).not.toContain(C.normalZombie);
    }
  });
  it("randomizes the player receiving the zombie and does not mutate inputs", () => {
    const ids = ["host", "second", "third", "fourth"], original = [...ids];
    const first = assignCharacters(ids, () => 0), last = assignCharacters(ids, () => 0.9999);
    const zombie = (result: typeof first) => [...result].find(([, c]) => SPECIAL_ZOMBIE_CHARACTER_IDS.includes(c as typeof SPECIAL_ZOMBIE_CHARACTER_IDS[number]))![0];
    expect(zombie(first)).toBe("second"); expect(zombie(last)).toBe("host"); expect(ids).toEqual(original);
  });
  it.each([0, 1, 2, 3, 9])("refuses unsupported participant count %s", count => {
    expect(() => assignCharacters(Array.from({ length: count }, (_, i) => `${i}`))).toThrow();
  });
  it("fails validation for duplicate special humans, wrong factions or incomplete membership", () => {
    const ids = ["a", "b", "c", "d"];
    expect(validateAssignments(ids, new Map([["a", C.drunkenZombie], ["b", C.fossil], ["c", C.fossil], ["d", C.normalHuman]]))).toBe(false);
    expect(validateAssignments(ids, new Map([["a", C.normalZombie], ["b", C.fossil], ["c", C.sportsStudent], ["d", C.normalHuman]]))).toBe(false);
    expect(() => assignCharacters(["same", "same", "c", "d"])).toThrow();
  });
});
