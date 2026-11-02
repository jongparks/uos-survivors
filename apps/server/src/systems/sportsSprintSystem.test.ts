import { describe, expect, it } from "vitest";

import {
  CHARACTER_IDS,
  PLAYER_ROLE,
  SPORTS_STUDENT_CONFIG,
  SPRINT_STATE,
  PlayerState,
} from "@uos-survivors/shared";

import {
  getPlayerSpeedMultiplier,
  resetSportsSprint,
  tryActivateSportsSprint,
  updateSportsSprint,
} from "./sportsSprintSystem.js";

function createSportsStudent(): PlayerState {
  const player = new PlayerState();
  player.characterId = CHARACTER_IDS.sportsStudent;
  player.role = PLAYER_ROLE.human;
  return player;
}

describe("Sports Science Student sprint", () => {
  it("activates for six seconds at 140% speed and rejects duplicate requests", () => {
    const player = createSportsStudent();

    expect(tryActivateSportsSprint(player, 1_000)).toBe(true);
    expect(player.sprintState).toBe(SPRINT_STATE.sprinting);
    expect(player.sprintEndsAt).toBe(1_000 + SPORTS_STUDENT_CONFIG.sprintDurationMs);
    expect(getPlayerSpeedMultiplier(player)).toBe(1.4);
    expect(tryActivateSportsSprint(player, 2_000)).toBe(false);
    expect(player.sprintEndsAt).toBe(1_000 + SPORTS_STUDENT_CONFIG.sprintDurationMs);
  });

  it("transitions through two seconds of exhaustion and the remaining cooldown", () => {
    const player = createSportsStudent();
    tryActivateSportsSprint(player, 1_000);

    updateSportsSprint(player, 7_000);
    expect(player.sprintState).toBe(SPRINT_STATE.exhausted);
    expect(getPlayerSpeedMultiplier(player)).toBe(0.65);

    updateSportsSprint(player, 9_000);
    expect(player.sprintState).toBe(SPRINT_STATE.cooldown);
    expect(getPlayerSpeedMultiplier(player)).toBe(1);
    expect(tryActivateSportsSprint(player, 25_999)).toBe(false);

    updateSportsSprint(player, 26_000);
    expect(player.sprintState).toBe(SPRINT_STATE.ready);
    expect(tryActivateSportsSprint(player, 26_000)).toBe(true);
  });

  it("catches up correctly after a delayed server tick", () => {
    const player = createSportsStudent();
    tryActivateSportsSprint(player, 1_000);

    updateSportsSprint(player, 30_000);
    expect(player.sprintState).toBe(SPRINT_STATE.ready);
    expect(player.cooldownEndsAt).toBe(0);
  });

  it("rejects other characters and zombies", () => {
    const fossil = new PlayerState();
    expect(tryActivateSportsSprint(fossil, 1_000)).toBe(false);

    const zombie = createSportsStudent();
    zombie.role = PLAYER_ROLE.zombie;
    expect(tryActivateSportsSprint(zombie, 1_000)).toBe(false);
  });

  it("reset removes every active human sprint effect", () => {
    const player = createSportsStudent();
    tryActivateSportsSprint(player, 1_000);

    resetSportsSprint(player);
    expect(player.sprintState).toBe(SPRINT_STATE.ready);
    expect(player.skillStartedAt).toBe(0);
    expect(player.cooldownEndsAt).toBe(0);
    expect(getPlayerSpeedMultiplier(player)).toBe(1);
  });
});
