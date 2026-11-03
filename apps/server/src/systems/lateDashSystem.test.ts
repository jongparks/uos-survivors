import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, PLAYER_ACTIVITY, SculptureDecoyState, BookBarrierState, getCharacterSpeedMultiplier, tileToWorld } from "@uos-survivors/shared";
import { LateDashSystem } from "./lateDashSystem.js";
import { infectHuman } from "./infectionSystem.js";
import { SculptureDecoySystem } from "./sculptureDecoySystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const p = new PlayerState(); Object.assign(p, { characterId: CHARACTER_IDS.lateZombie, role: PLAYER_ROLE.zombie, x: tileToWorld(2), y: tileToWorld(2) });
  state.players.set("late", p);
  return { state, p, system: new LateDashSystem() };
}

describe("출석 마감", () => {
  it("locks normalized direction and moves exactly three tiles in 500ms, with 25 second cooldown", () => {
    const { state, p, system } = setup(); p.facingX = 1; p.facingY = 1;
    expect(system.tryActivate(state, "late", 1000)).toBe(true);
    expect(system.tryActivate(state, "late", 1001)).toBe(false);
    p.facingX = -1;
    system.updatePlayer(state, "late", 1250, () => {}, () => {});
    expect(Math.hypot(p.x - p.dashStartX, p.y - p.dashStartY)).toBeCloseTo(72);
    expect(p.facingX).toBeCloseTo(Math.SQRT1_2);
    system.updatePlayer(state, "late", 1500, () => {}, () => {});
    expect(Math.hypot(p.x - p.dashStartX, p.y - p.dashStartY)).toBeCloseTo(144);
    expect(p.dashEndsAt).toBe(0); expect(p.dashCooldownEndsAt).toBe(26000);
    expect(system.updatePlayer(state, "late", 1600, () => {}, () => {})).toBe(false);
    expect(getCharacterSpeedMultiplier(p.characterId, p.role, "ready")).toBe(1.08);
    expect(system.tryActivate(state, "late", 25999)).toBe(false);
    expect(system.tryActivate(state, "late", 26000)).toBe(true);
  });

  it("hits only the first human in a long tick and uses common infection", () => {
    const { state, p, system } = setup();
    for (const [id, distance] of [["near", 60], ["far", 100]] as const) {
      const human = new PlayerState(); human.x = p.x + distance; human.y = p.y; state.players.set(id, human);
    }
    system.tryActivate(state, "late", 1000);
    system.updatePlayer(state, "late", 1500, id => { infectHuman(state, id, 1500); }, () => {});
    expect(state.players.get("near")?.characterId).toBe(CHARACTER_IDS.normalZombie);
    expect(state.players.get("far")?.role).toBe(PLAYER_ROLE.human);
    expect(p.x).toBeLessThan(p.dashStartX + 60); expect(p.dashEndsAt).toBe(0);
  });

  it("stops before a wall without stun or exhaustion, including delayed ticks", () => {
    const { state, p, system } = setup(); p.facingX = -1;
    system.tryActivate(state, "late", 1000);
    system.updatePlayer(state, "late", 2000, () => { throw new Error("unexpected infection"); }, () => {});
    expect(p.x).toBeGreaterThan(61); expect(p.x).toBeLessThan(62);
    expect(p.dashEndsAt).toBe(0); expect(p.stunnedUntil).toBe(0); expect(p.exhaustionEndsAt).toBe(0);
  });

  it("ignores hidden humans and books but destroys a decoy and applies its stun", () => {
    const { state, p, system } = setup();
    const hidden = new PlayerState(); Object.assign(hidden, { x: p.x + 30, y: p.y, activity: PLAYER_ACTIVITY.hidden }); state.players.set("hidden", hidden);
    const book = new BookBarrierState(); Object.assign(book, { x: p.x + 40, y: p.y, width: 96, height: 48, expiresAt: 99999 }); state.bookBarriers.set("book", book);
    const decoy = new SculptureDecoyState(); decoy.x = p.x + 100; decoy.y = p.y; state.decoys.set("decoy", decoy);
    system.tryActivate(state, "late", 1000);
    system.updatePlayer(state, "late", 1500, () => { throw new Error("hidden target infected"); }, (id, attacker) => { new SculptureDecoySystem().hitDecoy(state, id, attacker, 1500); });
    expect(hidden.role).toBe(PLAYER_ROLE.human); expect(state.bookBarriers.size).toBe(1);
    expect(state.decoys.size).toBe(0); expect(p.stunnedUntil).toBe(3000); expect(p.dashEndsAt).toBe(0);
    expect(p.x).toBeGreaterThan(book.x);
  });

  it("cancels on external stun and match end without continuing movement", () => {
    const { state, p, system } = setup(); system.tryActivate(state, "late", 1000);
    p.stunnedUntil = 2000;
    system.updatePlayer(state, "late", 1200, () => {}, () => {});
    expect(p.x).toBe(p.dashStartX); expect(p.dashEndsAt).toBe(0); expect(p.dashCooldownEndsAt).toBe(26000);
    system.clear(state); p.stunnedUntil = 0; system.tryActivate(state, "late", 3000);
    state.phase = GAME_PHASE.finished;
    system.updatePlayer(state, "late", 3200, () => {}, () => {}); expect(p.dashEndsAt).toBe(0);
  });
});
