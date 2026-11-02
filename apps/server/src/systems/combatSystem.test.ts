import { describe, expect, it } from "vitest";

import {
  COMBAT_RULES,
  GAME_PHASE,
  GameState,
  PLAYER_ROLE,
  PlayerState,
} from "@uos-survivors/shared";

import { findZombieAttackTarget, resolveZombieAttack } from "./combatSystem.js";
import { finishIfAllHumansInfected, infectHuman } from "./infectionSystem.js";

function addPlayer(
  state: GameState,
  sessionId: string,
  role: string,
  x: number,
  y: number,
): PlayerState {
  const player = new PlayerState();
  player.role = role;
  player.x = x;
  player.y = y;
  state.players.set(sessionId, player);
  return player;
}

describe("zombie combat", () => {
  it("selects the closest human inside the forward attack cone", () => {
    const state = new GameState();
    const zombie = addPlayer(state, "zombie", PLAYER_ROLE.zombie, 100, 100);
    zombie.facingX = 1;
    zombie.facingY = 0;
    addPlayer(state, "front", PLAYER_ROLE.human, 140, 100);
    addPlayer(state, "behind", PLAYER_ROLE.human, 70, 100);

    expect(findZombieAttackTarget(state, "zombie")).toBe("front");
  });

  it("applies an attack cooldown even when the attack misses", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    const zombie = addPlayer(state, "zombie", PLAYER_ROLE.zombie, 100, 100);

    expect(resolveZombieAttack(state, "zombie", 1_000)).toBeNull();
    expect(zombie.nextAttackAt).toBe(1_000 + COMBAT_RULES.zombieAttackCooldownMs);
    expect(resolveZombieAttack(state, "zombie", 1_001)).toBeNull();
  });

  it("infects immediately, locks attacks for 1.5 seconds, and finishes the match", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    addPlayer(state, "zombie", PLAYER_ROLE.zombie, 100, 100);
    const human = addPlayer(state, "human", PLAYER_ROLE.human, 140, 100);

    expect(infectHuman(state, "human", 2_000)).toBe(true);
    expect(human.role).toBe(PLAYER_ROLE.zombie);
    expect(human.attackLockedUntil).toBe(2_000 + COMBAT_RULES.infectionAttackLockMs);
    expect(finishIfAllHumansInfected(state)).toBe(true);
    expect(state.phase).toBe(GAME_PHASE.finished);
  });
});
