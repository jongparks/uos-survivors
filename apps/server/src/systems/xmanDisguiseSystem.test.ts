import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, PLAYER_ACTIVITY, getCharacterSpeedMultiplier, isHumanDisguise } from "@uos-survivors/shared";
import { tryToggleXmanDisguise, updateXmanDisguise, resetXmanDisguise } from "./xmanDisguiseSystem.js";
import { resolveZombieAttack } from "./combatSystem.js";
import { tryActivateSportsSprint } from "./sportsSprintSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const p = new PlayerState(); Object.assign(p, { characterId: CHARACTER_IDS.xmanZombie, role: PLAYER_ROLE.zombie, x: 100, y: 100 }); state.players.set("x", p);
  return { state, p };
}

describe("새터 잠입", () => {
  it("disguises for 10 seconds with a 40 second cooldown, without changing actual team", () => {
    const { state, p } = setup();
    expect(tryToggleXmanDisguise(state, "x", 1000)).toBe(true);
    expect(p.disguiseEndsAt).toBe(11000); expect(p.disguiseCooldownEndsAt).toBe(41000);
    expect(p.role).toBe(PLAYER_ROLE.zombie); expect(p.characterId).toBe(CHARACTER_IDS.xmanZombie);
    expect(isHumanDisguise(p.characterId, p.role, p.isDisguised)).toBe(true);
    expect(getCharacterSpeedMultiplier(p.characterId, p.role, p.sprintState, p.isDisguised)).toBe(1);
    expect(tryActivateSportsSprint(p, 1100)).toBe(false);
    updateXmanDisguise(p, 11000);
    expect(p.isDisguised).toBe(false); expect(p.attackLockedUntil).toBe(11500);
    expect(getCharacterSpeedMultiplier(p.characterId, p.role, p.sprintState, p.isDisguised)).toBe(1.08);
    expect(tryToggleXmanDisguise(state, "x", 40999)).toBe(false);
    expect(tryToggleXmanDisguise(state, "x", 41000)).toBe(true);
  });

  it("manually cancels during cooldown and blocks attacks for exactly 500ms", () => {
    const { state, p } = setup(); tryToggleXmanDisguise(state, "x", 1000);
    expect(tryToggleXmanDisguise(state, "x", 2000)).toBe(true);
    expect(p.isDisguised).toBe(false); expect(p.attackLockedUntil).toBe(2500);
    expect(p.disguiseCooldownEndsAt).toBe(41000);
    resolveZombieAttack(state, "x", 2499); expect(p.lastBasicAttackAt).toBe(0);
    resolveZombieAttack(state, "x", 2500); expect(p.lastBasicAttackAt).toBe(2500);
  });

  it.each([false, true])("attack reveals immediately, even on a miss: hit=%s", hit => {
    const { state, p } = setup();
    if (hit) { const human = new PlayerState(); human.x = 140; human.y = 100; state.players.set("human", human); }
    tryToggleXmanDisguise(state, "x", 1000);
    const target = resolveZombieAttack(state, "x", 1100);
    expect(target).toEqual(hit ? { type: "human", id: "human" } : null);
    expect(p.isDisguised).toBe(false); expect(p.attackLockedUntil).toBe(0);
    expect(p.lastBasicAttackAt).toBe(1100); expect(p.nextAttackAt).toBe(3100);
    expect(p.disguiseCooldownEndsAt).toBe(41000);
  });

  it("does not reveal on rejected attacks, and timeout cannot bypass its attack lock", () => {
    const { state, p } = setup(); tryToggleXmanDisguise(state, "x", 1000);
    p.nextAttackAt = 4000;
    resolveZombieAttack(state, "x", 2000); expect(p.isDisguised).toBe(true);
    resolveZombieAttack(state, "x", 11000); expect(p.isDisguised).toBe(false);
    expect(p.attackLockedUntil).toBe(11500); expect(p.lastBasicAttackAt).toBe(0);
  });

  it("ends on stun and resets without changing another skill's cooldown", () => {
    const { state, p } = setup(); tryToggleXmanDisguise(state, "x", 1000);
    p.stunnedUntil = 3000; updateXmanDisguise(p, 2000);
    expect(p.isDisguised).toBe(false); expect(p.disguiseCooldownEndsAt).toBe(41000);
    p.vomitCooldownEndsAt = 50000; resetXmanDisguise(p);
    expect(p.disguiseCooldownEndsAt).toBe(0); expect(p.vomitCooldownEndsAt).toBe(50000);
  });

  it("preserves the active state across disconnect/reconnect until the server deadline", () => {
    const { state, p } = setup(); tryToggleXmanDisguise(state, "x", 1000);
    p.connected = false; updateXmanDisguise(p, 2000); p.connected = true;
    expect(p.isDisguised).toBe(true); expect(p.disguiseEndsAt).toBe(11000);
    updateXmanDisguise(p, 11000); expect(p.isDisguised).toBe(false);
  });

  it.each([CHARACTER_IDS.normalZombie, CHARACTER_IDS.fossil, CHARACTER_IDS.lateZombie])("rejects %s", characterId => {
    const { state, p } = setup(); p.characterId = characterId;
    expect(tryToggleXmanDisguise(state, "x", 1000)).toBe(false);
    p.characterId = CHARACTER_IDS.xmanZombie; p.role = PLAYER_ROLE.human;
    expect(tryToggleXmanDisguise(state, "x", 1000)).toBe(false);
    p.role = PLAYER_ROLE.zombie; p.activity = PLAYER_ACTIVITY.hidden;
    expect(tryToggleXmanDisguise(state, "x", 1000)).toBe(false);
  });
});
