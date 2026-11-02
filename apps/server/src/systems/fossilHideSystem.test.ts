import { describe, expect, it } from "vitest";

import {
  CHARACTER_IDS,
  FOSSIL_CONFIG,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  PlayerState,
} from "@uos-survivors/shared";

import type { HideSpotCandidate } from "../maps/hideSpotRegistry.js";
import { FossilHideSystem } from "./fossilHideSystem.js";

function createCandidates(count = 5): HideSpotCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `spot-${index + 1}`,
    zoneId: `zone-${index + 1}`,
    x: 100 + index * 100,
    y: 100,
    exitX: 112 + index * 100,
    exitY: 100,
    interactionRadius: 32,
  }));
}

function createFossil(): PlayerState {
  const player = new PlayerState();
  player.characterId = CHARACTER_IDS.fossil;
  player.role = PLAYER_ROLE.human;
  player.x = 100;
  player.y = 100;
  return player;
}

describe("Fossil hide system", () => {
  it("selects five distributed spots and consumes one when Fossil enters", () => {
    const system = new FossilHideSystem(createCandidates(), () => 0.5);
    const fossil = createFossil();

    system.prepareForMatch();

    expect(system.getAvailableSpotViews()).toHaveLength(FOSSIL_CONFIG.hideSpotCount);
    expect(system.interact(fossil, 1_000)).toBe("entered");
    expect(fossil.activity).toBe(PLAYER_ACTIVITY.hidden);
    expect(fossil.hideEndsAt).toBe(1_000 + FOSSIL_CONFIG.hideDurationMs);
    expect(system.getAvailableSpotViews()).toHaveLength(FOSSIL_CONFIG.hideSpotCount - 1);
  });

  it("allows an early exit at the registered exit and never restores the consumed spot", () => {
    const system = new FossilHideSystem(createCandidates(), () => 0.5);
    const fossil = createFossil();
    system.prepareForMatch();

    expect(system.interact(fossil, 1_000)).toBe("entered");
    expect(system.interact(fossil, 2_000)).toBe("exited");
    expect(fossil.activity).toBe(PLAYER_ACTIVITY.normal);
    expect(fossil.x).toBe(112);
    expect(system.interact(fossil, 3_000)).toBe("rejected");
  });

  it("automatically exits after twenty seconds", () => {
    const system = new FossilHideSystem(createCandidates(), () => 0.5);
    const fossil = createFossil();
    system.prepareForMatch();
    system.interact(fossil, 1_000);

    expect(system.update(fossil, 1_000 + FOSSIL_CONFIG.hideDurationMs - 1)).toBe(false);
    expect(system.update(fossil, 1_000 + FOSSIL_CONFIG.hideDurationMs)).toBe(true);
    expect(fossil.activity).toBe(PLAYER_ACTIVITY.normal);
  });

  it("rejects non-Fossil characters and invalid map configurations", () => {
    const invalidSystem = new FossilHideSystem(createCandidates(4));
    expect(() => invalidSystem.prepareForMatch()).toThrow(/at least 5/);

    const system = new FossilHideSystem(createCandidates());
    const player = createFossil();
    player.characterId = "HUMAN_999";
    system.prepareForMatch();
    expect(system.interact(player, 1_000)).toBe("rejected");
  });

  it("keeps the skill disabled without fake spots until a map registers candidates", () => {
    const system = new FossilHideSystem([]);
    const fossil = createFossil();

    expect(() => system.prepareForMatch()).not.toThrow();
    expect(system.getAvailableSpotViews()).toEqual([]);
    expect(system.interact(fossil, 1_000)).toBe("rejected");
  });
});
