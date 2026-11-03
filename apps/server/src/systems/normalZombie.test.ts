import { describe, expect, it } from "vitest";
import {
  CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, PLAYER_ACTIVITY,
  SPRINT_STATE, SculptureDecoyState, getCharacterSpeedMultiplier, pickInitialZombieCharacter,
  PLAYER_SPEED, tileToWorld, moveWithTestMapCollision,
} from "@uos-survivors/shared";
import { infectHuman } from "./infectionSystem.js";
import { VomitSystem } from "./vomitSystem.js";
import { resolveZombieAttack } from "./combatSystem.js";

describe("일반 좀비", () => {
  it.each([CHARACTER_IDS.normalZombie, CHARACTER_IDS.drunkenZombie])("allows %s to use shared basic combat", characterId => {
    const state = new GameState(); state.phase = GAME_PHASE.playing;
    const zombie = new PlayerState(); Object.assign(zombie, { characterId, role: PLAYER_ROLE.zombie, x: 100, y: 100 });
    const human = new PlayerState(); human.x = 140; human.y = 100;
    state.players.set("zombie", zombie); state.players.set("human", human);
    expect(resolveZombieAttack(state, "zombie", 1000)).toEqual({ type: "human", id: "human" });
    expect(resolveZombieAttack(state, "zombie", 1001)).toBeNull();
  });
  it("never appears in initial assignment", () => {
    for (const roll of [-1, 0, 0.25, 0.5, 0.999, 1]) {
      expect([CHARACTER_IDS.drunkenZombie, CHARACTER_IDS.graduateZombie]).toContain(pickInitialZombieCharacter(roll));
    }
  });

  it.each([CHARACTER_IDS.fossil, CHARACTER_IDS.sportsStudent, CHARACTER_IDS.sculptureStudent])("cleans %s and converts the existing player exactly once", characterId => {
    const state = new GameState(); state.phase = GAME_PHASE.playing;
    const human = new PlayerState();
    Object.assign(human, { characterId, activity: PLAYER_ACTIVITY.hidden, activeHideSpotId: "spot", hideStartedAt: 10, hideEndsAt: 10000,
      sprintState: SPRINT_STATE.sprinting, sprintEndsAt: 10000, exhaustionEndsAt: 12000, cooldownEndsAt: 30000,
      activeDecoyId: "decoy", decoyCooldownEndsAt: 30000, stunnedUntil: 5000 });
    state.players.set("same-session", human);
    const decoy = new SculptureDecoyState(); decoy.ownerSessionId = "same-session"; state.decoys.set("decoy", decoy);
    expect(infectHuman(state, "same-session", 1000)).toBe(true);
    expect(state.players.get("same-session")).toBe(human);
    expect(state.players.size).toBe(1);
    expect(human.characterId).toBe(CHARACTER_IDS.normalZombie);
    expect(human.activity).toBe(PLAYER_ACTIVITY.normal);
    expect(human.activeHideSpotId).toBe(""); expect(human.hideEndsAt).toBe(0);
    expect(human.sprintState).toBe(SPRINT_STATE.ready); expect(human.exhaustionEndsAt).toBe(0);
    expect(human.cooldownEndsAt).toBe(0); expect(human.decoyCooldownEndsAt).toBe(0);
    expect(human.stunnedUntil).toBe(0); expect(state.decoys.size).toBe(0);
    expect(infectHuman(state, "same-session", 2000)).toBe(false);
    expect(human.attackLockedUntil).toBe(2500);
    expect(new VomitSystem().tryActivate(state, "same-session", 4000)).toBe(false);
  });

  it("uses 108% base speed with normalized diagonals and wall collision", () => {
    const speed = PLAYER_SPEED * getCharacterSpeedMultiplier(CHARACTER_IDS.normalZombie, PLAYER_ROLE.zombie, SPRINT_STATE.sprinting);
    expect(speed).toBeCloseTo(PLAYER_SPEED * 1.08);
    const start = { x: tileToWorld(2), y: tileToWorld(2) };
    const diagonal = moveWithTestMapCollision(start, { moveX: 1, moveY: 1 }, speed, 0.1);
    expect(Math.hypot(diagonal.x - start.x, diagonal.y - start.y)).toBeCloseTo(speed * 0.1);
    const wall = { x: tileToWorld(1), y: tileToWorld(2) };
    const result = moveWithTestMapCollision(wall, { moveX: -1, moveY: 0 }, speed, 0.2);
    expect(result).toEqual(wall);
  });
});
