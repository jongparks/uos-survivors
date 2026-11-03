import { describe, expect, it } from "vitest";

import {
  CHARACTER_IDS,
  GAME_PHASE,
  GameState,
  PLAYER_ROLE,
  PLAYER_SPEED,
  PlayerState,
  SCULPTURE_STUDENT_CONFIG,
  tileToWorld,
} from "@uos-survivors/shared";

import { SculptureDecoySystem } from "./sculptureDecoySystem.js";

function addSculptureStudent(state: GameState, sessionId = "sculptor"): PlayerState {
  const player = new PlayerState();
  player.nickname = "조각학도";
  player.characterId = CHARACTER_IDS.sculptureStudent;
  player.role = PLAYER_ROLE.human;
  player.x = tileToWorld(3);
  player.y = tileToWorld(3);
  state.players.set(sessionId, player);
  return player;
}

describe("Sculpture Student decoy", () => {
  it("replays recent server movement from the owner's current position at 85% speed", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    const player = addSculptureStudent(state);
    const system = new SculptureDecoySystem();
    system.recordMovement("sculptor", player, { moveX: 1, moveY: 0 }, 5_000);
    system.recordMovement("sculptor", player, { moveX: 1, moveY: 0 }, 10_000);

    const id = system.tryActivate(state, "sculptor", 10_000);
    expect(id).not.toBeNull();
    const decoy = state.decoys.get(id ?? "");
    expect(decoy?.x).toBe(player.x);

    system.update(state, 10_100, 0.1);
    expect((decoy?.x ?? 0) - player.x).toBeCloseTo(
      PLAYER_SPEED * SCULPTURE_STUDENT_CONFIG.decoySpeedMultiplier * 0.1,
      4,
    );
    expect(player.x).toBe(tileToWorld(3));
  });

  it("keeps only the last five seconds of movement including stationary input", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    const player = addSculptureStudent(state);
    const system = new SculptureDecoySystem();
    system.recordMovement("sculptor", player, { moveX: -1, moveY: 0 }, 4_000);
    system.recordMovement("sculptor", player, { moveX: 0, moveY: 0 }, 6_000);
    system.recordMovement("sculptor", player, { moveX: 1, moveY: 0 }, 7_000);
    const id = system.tryActivate(state, "sculptor", 10_000) ?? "";
    const decoy = state.decoys.get(id);

    system.update(state, 10_500, 0.1);
    expect(decoy?.x).toBe(player.x);
    system.update(state, 12_100, 0.1);
    expect(decoy?.x).toBeGreaterThan(player.x);
  });

  it("allows only one active decoy and enforces the thirty-second cooldown", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    const player = addSculptureStudent(state);
    const system = new SculptureDecoySystem();
    const id = system.tryActivate(state, "sculptor", 1_000);

    expect(id).not.toBeNull();
    expect(system.tryActivate(state, "sculptor", 1_001)).toBeNull();
    system.removeDecoy(state, id ?? "");
    expect(system.tryActivate(state, "sculptor", 30_999)).toBeNull();
    expect(system.tryActivate(state, "sculptor", 31_000)).not.toBeNull();
    expect(player.decoyCooldownEndsAt).toBe(61_000);
  });

  it("stuns only the attacking zombie once when the decoy is hit", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    addSculptureStudent(state);
    const zombie = new PlayerState();
    zombie.role = PLAYER_ROLE.zombie;
    state.players.set("zombie", zombie);
    const system = new SculptureDecoySystem();
    const id = system.tryActivate(state, "sculptor", 1_000) ?? "";

    expect(system.hitDecoy(state, id, zombie, 2_000)).toBe(true);
    expect(zombie.stunnedUntil).toBe(
      2_000 + SCULPTURE_STUDENT_CONFIG.zombieStunDurationMs,
    );
    expect(system.hitDecoy(state, id, zombie, 2_100)).toBe(false);
    expect(zombie.stunnedUntil).toBe(3_500);
  });

  it("expires naturally after five seconds without applying a stun", () => {
    const state = new GameState();
    state.phase = GAME_PHASE.playing;
    const player = addSculptureStudent(state);
    const system = new SculptureDecoySystem();
    system.tryActivate(state, "sculptor", 1_000);

    system.update(state, 6_000, 1 / 30);
    expect(state.decoys.size).toBe(0);
    expect(player.activeDecoyId).toBe("");
  });
});
