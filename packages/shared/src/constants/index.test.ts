import { describe, expect, it } from "vitest";

import { GAME_LIMITS, GAME_SERVER, ROOM_NAMES } from "./index.js";

describe("shared bootstrap configuration", () => {
  it("keeps the Phase 0 connection contract stable", () => {
    expect(GAME_SERVER.port).toBe(2567);
    expect(ROOM_NAMES.bootstrap).toBe("bootstrap");
    expect(GAME_LIMITS.maxPlayersPerRoom).toBe(8);
  });
});

