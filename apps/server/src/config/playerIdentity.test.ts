import { describe, expect, it } from "vitest";

import { generateRoomCodeCandidate, normalizeNickname } from "./playerIdentity.js";

describe("player identity", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeNickname("  시대   생존자  ")).toBe("시대 생존자");
  });

  it("rejects invalid nickname values", () => {
    expect(normalizeNickname(42)).toBeNull();
    expect(normalizeNickname("A")).toBeNull();
    expect(normalizeNickname("12345678901234567")).toBeNull();
  });

  it("generates a six-character invite code without ambiguous symbols", () => {
    const code = generateRoomCodeCandidate(() => 0.25);

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

