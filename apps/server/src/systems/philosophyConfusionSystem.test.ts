import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, TILE_SIZE, getConfusedMovement, calculateVelocity } from "@uos-survivors/shared";
import { tryActivateSocraticMethod, updateConfusion } from "./philosophyConfusionSystem.js";
import { resolveZombieAttack } from "./combatSystem.js";
import { LateDashSystem } from "./lateDashSystem.js";
import { tryToggleXmanDisguise } from "./xmanDisguiseSystem.js";
import { EngineeringTrapSystem } from "./engineeringTrapSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const caster = new PlayerState(); Object.assign(caster, { characterId: CHARACTER_IDS.philosophyStudent, x: 120, y: 120 }); state.players.set("caster", caster);
  const zombie = new PlayerState(); Object.assign(zombie, { role: PLAYER_ROLE.zombie, x: 200, y: 120, facingX: -1 }); state.players.set("zombie", zombie);
  return { state, caster, zombie };
}

describe("철학도 소크라테스의 문답법", () => {
  it("chooses the nearest real zombie across walls, inclusive at three tiles", () => {
    const { state, caster, zombie } = setup(); caster.x = 15.5 * TILE_SIZE; caster.y = 8.5 * TILE_SIZE;
    zombie.x = caster.x + 3 * TILE_SIZE; zombie.y = caster.y;
    expect(tryActivateSocraticMethod(state, "caster", 1000)).toBe("zombie");
    expect(zombie.confusionEndsAt).toBe(4000); expect(caster.philosophyCooldownEndsAt).toBe(41000);
    expect(tryActivateSocraticMethod(state, "caster", 1001)).toBeNull();
  });
  it("does not skip a confused nearest target, stack, refresh, or spend cooldown on failure", () => {
    const { state, caster, zombie } = setup();
    zombie.confusionEndsAt = 4000;
    const farther = new PlayerState(); farther.role = PLAYER_ROLE.zombie; farther.x = 220; farther.y = 120; state.players.set("farther", farther);
    expect(tryActivateSocraticMethod(state, "caster", 1000)).toBeNull();
    expect(caster.philosophyCooldownEndsAt).toBe(0); expect(zombie.confusionEndsAt).toBe(4000); expect(farther.confusionEndsAt).toBe(0);
    zombie.x = 500; farther.x = 600;
    expect(tryActivateSocraticMethod(state, "caster", 1001)).toBeNull(); expect(caster.philosophyCooldownEndsAt).toBe(0);
  });
  it.each([[0, -1], [0, 1], [-1, 0], [1, 0], [1, -1]])("reverses axes (%s,%s), keeps diagonal speed and leaves action inputs intact", (moveX, moveY) => {
    const { zombie } = setup(); zombie.confusionEndsAt = 4000;
    const input = { moveX, moveY, useSkill: true, interact: true };
    const result = getConfusedMovement(zombie, input, 1000);
    expect(result.moveX).toBe(-moveX); expect(result.moveY).toBe(-moveY);
    expect(Math.hypot(...Object.values(calculateVelocity(result, 220)))).toBeCloseTo(220);
    expect(input.useSkill).toBe(true); expect(input.interact).toBe(true);
    updateConfusion(zombie, 4000); expect(getConfusedMovement(zombie, input, 4000)).toEqual({ moveX, moveY });
  });
  it("does not prevent basic attacks", () => {
    const { state, caster, zombie } = setup(); zombie.x = caster.x + 40;
    tryActivateSocraticMethod(state, "caster", 1000);
    expect(resolveZombieAttack(state, "zombie", 1001)).toEqual({ type: "human", id: "caster" });
    expect(zombie.nextAttackAt).toBe(3001);
  });
  it("does not reveal disguised X-Man or change its skill cooldown", () => {
    const { state, zombie } = setup(); zombie.characterId = CHARACTER_IDS.xmanZombie;
    tryToggleXmanDisguise(state, "zombie", 1000);
    expect(tryActivateSocraticMethod(state, "caster", 1100)).toBe("zombie");
    expect(zombie.isDisguised).toBe(true); expect(zombie.disguiseCooldownEndsAt).toBe(41000);
  });
  it("does not reverse an ongoing dash, but reverses movement after it ends", () => {
    const { state, caster, zombie } = setup(); caster.x = 120; caster.y = 220;
    zombie.characterId = CHARACTER_IDS.lateZombie; zombie.facingX = 1;
    const dash = new LateDashSystem(); dash.tryActivate(state, "zombie", 1000);
    expect(tryActivateSocraticMethod(state, "caster", 1100)).toBe("zombie");
    dash.updatePlayer(state, "zombie", 1500, () => {}, () => {});
    expect(zombie.x).toBeCloseTo(344); expect(zombie.dashEndsAt).toBe(0); expect(zombie.facingX).toBe(1);
    expect(getConfusedMovement(zombie, { moveX: 1, moveY: 0 }, 1501).moveX).toBe(-1);
  });
  it("keeps ROOT and CONFUSION timers independent", () => {
    const { state, zombie } = setup(); zombie.rootedUntil = 3500;
    tryActivateSocraticMethod(state, "caster", 1000);
    expect(zombie.rootedUntil).toBe(3500); expect(zombie.confusionEndsAt).toBe(4000);
    new EngineeringTrapSystem().checkPlayer(state, zombie, 1100);
    updateConfusion(zombie, 3501); expect(zombie.confusionEndsAt).toBe(4000);
    expect(getConfusedMovement(zombie, { moveX: 1, moveY: 1 }, 3501)).toEqual({ moveX: -1, moveY: -1 });
  });
  it("rejects infected or stunned casters without cooldown", () => {
    const { state, caster } = setup(); caster.stunnedUntil = 2000;
    expect(tryActivateSocraticMethod(state, "caster", 1000)).toBeNull();
    caster.stunnedUntil = 0; caster.role = PLAYER_ROLE.zombie;
    expect(tryActivateSocraticMethod(state, "caster", 1000)).toBeNull(); expect(caster.philosophyCooldownEndsAt).toBe(0);
  });
});
