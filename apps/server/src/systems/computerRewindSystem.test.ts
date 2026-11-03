import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, BookBarrierState, EngineeringTrapState } from "@uos-survivors/shared";
import { ComputerRewindSystem, findValidRewindPosition } from "./computerRewindSystem.js";
import { infectHuman } from "./infectionSystem.js";
import { HumanDangerSystem } from "./humanDangerSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const p = new PlayerState(); Object.assign(p, { characterId: CHARACTER_IDS.computerStudent, x: 120, y: 120 }); state.players.set("cs", p);
  return { state, p, system: new ComputerRewindSystem() };
}
function recordPath(state: GameState, p: PlayerState, system: ComputerRewindSystem, until: number, step = 50) {
  for (let now = 0; now < until; now += step) { p.x = 120 + now * 0.04; system.record(state, "cs", now); }
  p.x = 120 + until * 0.04; system.record(state, "cs", until);
}

describe("Ctrl + Z", () => {
  it("requires three seconds of history and interpolates the exact target time from 50ms samples", () => {
    const { state, p, system } = setup(); recordPath(state, p, system, 2999, 37);
    expect(system.tryActivate(state, "cs", 2999)).toBe(false); expect(p.rewindCooldownEndsAt).toBe(0);
    p.x = 120 + 3333 * 0.04; system.record(state, "cs", 3333);
    expect(system.tryActivate(state, "cs", 3333)).toBe(true);
    expect(p.x).toBeCloseTo(120 + 333 * 0.04); expect(p.rewindCooldownEndsAt).toBe(43333);
    expect(system.tryActivate(state, "cs", 3334)).toBe(false);
  });
  it("rewinds only position, preserves facing and status, and can land on an engineering trap", () => {
    const { state, p, system } = setup(); recordPath(state, p, system, 3250);
    p.facingX = -1; p.sprintState = "exhausted"; p.cooldownEndsAt = 9000; p.attackLockedUntil = 6000;
    const trap = new EngineeringTrapState(); trap.x = 130; trap.y = 120; state.engineeringTraps.set("trap", trap);
    expect(system.tryActivate(state, "cs", 3250)).toBe(true);
    expect(p.x).toBeCloseTo(130); expect(p.facingX).toBe(-1); expect(p.sprintState).toBe("exhausted");
    expect(p.cooldownEndsAt).toBe(9000); expect(p.attackLockedUntil).toBe(6000); expect(p.role).toBe(PLAYER_ROLE.human);
    expect(state.engineeringTraps.size).toBe(1);
  });
  it("searches only forward along the old path past barriers and player collisions", () => {
    const { state, p, system } = setup(); recordPath(state, p, system, 3300);
    const book = new BookBarrierState(); Object.assign(book, { x: 120, y: 120, width: 96, height: 48, expiresAt: 99999 }); state.bookBarriers.set("book", book);
    const other = new PlayerState(); other.x = 190; other.y = 120; state.players.set("other", other);
    expect(system.tryActivate(state, "cs", 3300)).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(216); expect(p.x).toBeLessThan(217); expect(p.y).toBe(120);
  });
  it("does not spend cooldown when the entire recorded path is blocked", () => {
    const { state, p, system } = setup(); recordPath(state, p, system, 3300);
    const book = new BookBarrierState(); Object.assign(book, { x: 200, y: 120, width: 400, height: 48, expiresAt: 99999 }); state.bookBarriers.set("book", book);
    const before = p.x; expect(system.tryActivate(state, "cs", 3300)).toBe(false);
    expect(p.x).toBe(before); expect(p.rewindCooldownEndsAt).toBe(0);
  });
  it("rejects stun, forced actions, other characters and infection without reversing it", () => {
    const { state, p, system } = setup(); recordPath(state, p, system, 3300);
    p.stunnedUntil = 4000; expect(system.tryActivate(state, "cs", 3300)).toBe(false);
    p.stunnedUntil = 0; p.trapCastEndsAt = 4000; expect(system.tryActivate(state, "cs", 3300)).toBe(false);
    p.trapCastEndsAt = 0; p.characterId = CHARACTER_IDS.engineeringStudent; expect(system.tryActivate(state, "cs", 3300)).toBe(false);
    p.characterId = CHARACTER_IDS.computerStudent; infectHuman(state, "cs", 3300);
    expect(system.tryActivate(state, "cs", 3300)).toBe(false); expect(p.characterId).toBe(CHARACTER_IDS.normalZombie);
  });
  it("does not invent traversable points between prior teleport endpoints", () => {
    const history = [{ timestamp: 0, x: 0, y: 0 }, { timestamp: 100, x: 10, y: 0 },
      { timestamp: 100, x: 100, y: 0 }, { timestamp: 200, x: 110, y: 0 }];
    expect(findValidRewindPosition(history, 50, p => p.x === 50)).toBeNull();
  });
  it("keeps enough recent history after circular-buffer rollover and clears it on reset", () => {
    const { state, p, system } = setup();
    for (let now = 0; now <= 10000; now += 50) { p.x = 120 + now * 0.005; system.record(state, "cs", now); }
    expect(system.tryActivate(state, "cs", 10000)).toBe(true); expect(p.x).toBeCloseTo(155);
    system.clear(state); expect(system.tryActivate(state, "cs", 50000)).toBe(false); expect(p.rewindCooldownEndsAt).toBe(0);
  });
  it("supports immediate danger recalculation after a positional jump within the 100ms interval", () => {
    const { state, p } = setup();
    const zombie = new PlayerState(); zombie.role = PLAYER_ROLE.zombie; zombie.x = 150; zombie.y = 120; state.players.set("z", zombie);
    const danger = new HumanDangerSystem(); const levels: string[] = [];
    danger.update(state, 1000, (_id, update) => levels.push(update.level)); expect(levels.at(-1)).toBe("DANGER");
    p.x = 500; danger.invalidate(); danger.update(state, 1001, (_id, update) => levels.push(update.level));
    expect(levels.at(-1)).toBe("NONE");
  });
});
