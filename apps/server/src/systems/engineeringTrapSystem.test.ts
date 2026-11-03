import { describe, expect, it } from "vitest";
import { Encoder, Decoder, StateView } from "@colyseus/schema";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, EngineeringTrapState, TILE_SIZE, tileToWorld } from "@uos-survivors/shared";
import { EngineeringTrapSystem, canSeeEngineeringTrap } from "./engineeringTrapSystem.js";
import { LateDashSystem } from "./lateDashSystem.js";
import { tryToggleXmanDisguise } from "./xmanDisguiseSystem.js";
import { calculateHumanDanger } from "./humanDangerSystem.js";
import { resolveZombieAttack } from "./combatSystem.js";
import { infectHuman } from "./infectionSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const engineer = new PlayerState(); Object.assign(engineer, { characterId: CHARACTER_IDS.engineeringStudent, x: tileToWorld(3), y: tileToWorld(3) }); state.players.set("engineer", engineer);
  const zombie = new PlayerState(); Object.assign(zombie, { role: PLAYER_ROLE.zombie, characterId: CHARACTER_IDS.normalZombie, x: tileToWorld(6), y: engineer.y }); state.players.set("zombie", zombie);
  return { state, engineer, zombie, system: new EngineeringTrapSystem() };
}
function armed(state: GameState, x: number, y: number, id = "trap") {
  const trap = new EngineeringTrapState(); Object.assign(trap, { ownerSessionId: "engineer", x, y, createdAt: 0, activatesAt: 1, expiresAt: 20000 }); state.engineeringTraps.set(id, trap); return trap;
}

describe("공대생 밤샘 제작", () => {
  it("casts 500ms, arms 500ms after successful placement, lives 20s and starts a 30s cooldown", () => {
    const { state, engineer, zombie, system } = setup();
    expect(system.tryActivate(state, "engineer", 1000)).toBe(true); expect(engineer.trapCastEndsAt).toBe(1500);
    expect(system.tryActivate(state, "engineer", 1001)).toBe(false);
    system.update(state, 1499); expect(state.engineeringTraps.size).toBe(0); expect(engineer.trapCooldownEndsAt).toBe(0);
    system.update(state, 1500); const trap = [...state.engineeringTraps.values()][0]!;
    expect(trap.activatesAt).toBe(2000); expect(trap.expiresAt).toBe(21500); expect(engineer.trapCooldownEndsAt).toBe(31500);
    zombie.x = trap.x; zombie.y = trap.y;
    expect(system.checkPlayer(state, zombie, 1999)).toBe(false);
    expect(system.checkPlayer(state, zombie, 2000)).toBe(true);
    expect(zombie.rootedUntil).toBe(4500); expect(state.engineeringTraps.size).toBe(0);
  });
  it("expires unused traps and cancels interrupted casts without cooldown", () => {
    const { state, engineer, system } = setup(); system.tryActivate(state, "engineer", 1000);
    engineer.stunnedUntil = 2000; system.update(state, 1500);
    expect(state.engineeringTraps.size).toBe(0); expect(engineer.trapCooldownEndsAt).toBe(0);
    engineer.stunnedUntil = 0; system.tryActivate(state, "engineer", 2000); system.update(state, 2500);
    system.update(state, 22499); expect(state.engineeringTraps.size).toBe(1);
    system.update(state, 22500); expect(state.engineeringTraps.size).toBe(0);
  });
  it("ROOT allows basic attacks, does not stun, stack, or refresh its duration", () => {
    const { state, engineer, zombie, system } = setup(); zombie.x = engineer.x - 35;
    armed(state, zombie.x, zombie.y); system.checkPlayer(state, zombie, 1000);
    expect(zombie.stunnedUntil).toBe(0); expect(zombie.rootedUntil).toBe(3500);
    expect(resolveZombieAttack(state, "zombie", 1100)).toEqual({ type: "human", id: "engineer" });
    armed(state, zombie.x, zombie.y, "second"); system.checkPlayer(state, zombie, 2000);
    expect(zombie.rootedUntil).toBe(3500); expect(state.engineeringTraps.size).toBe(0);
  });
  it.each([false, true])("Late Student dash passes traps; only an overlapping endpoint triggers: %s", endpoint => {
    const { state, zombie, system } = setup(); zombie.characterId = CHARACTER_IDS.lateZombie; zombie.facingX = 1;
    const start = zombie.x;
    armed(state, start + (endpoint ? 144 : 72), zombie.y);
    const dash = new LateDashSystem(); expect(dash.tryActivate(state, "zombie", 1000)).toBe(true);
    dash.updatePlayer(state, "zombie", 1250, () => {}, () => {});
    expect(system.checkPlayer(state, zombie, 1250)).toBe(false); expect(state.engineeringTraps.size).toBe(1);
    // The nominal deadline has elapsed, but the server still must process the final dash segment.
    expect(system.checkPlayer(state, zombie, 1500)).toBe(false);
    dash.updatePlayer(state, "zombie", 1500, () => {}, () => {});
    expect(system.checkPlayer(state, zombie, 1500)).toBe(endpoint);
    expect(zombie.rootedUntil).toBe(endpoint ? 4000 : 0);
    if (!endpoint) expect(state.engineeringTraps.size).toBe(1);
  });
  it("rooted Late Student cannot dash; normal walking still triggers", () => {
    const { state, zombie, system } = setup(); zombie.characterId = CHARACTER_IDS.lateZombie;
    armed(state, zombie.x, zombie.y); system.checkPlayer(state, zombie, 1000);
    expect(new LateDashSystem().tryActivate(state, "zombie", 1100)).toBe(false);
  });
  it.each([false, true])("reveals X-Man only if disguised, without resetting cooldown: %s", disguised => {
    const { state, engineer, zombie, system } = setup(); zombie.characterId = CHARACTER_IDS.xmanZombie; zombie.x = engineer.x + 40;
    if (disguised) tryToggleXmanDisguise(state, "zombie", 1000);
    expect(calculateHumanDanger(state, engineer)).toBe(disguised ? "WARNING" : "DANGER");
    armed(state, zombie.x, zombie.y); system.checkPlayer(state, zombie, 1500);
    expect(zombie.isDisguised).toBe(false); expect(zombie.rootedUntil).toBe(4000);
    expect(zombie.attackLockedUntil).toBe(disguised ? 2000 : 0);
    expect(zombie.disguiseCooldownEndsAt).toBe(disguised ? 41000 : 0);
    expect(calculateHumanDanger(state, engineer)).toBe("DANGER");
  });
  it("only sends traps to humans and zombies within 1.5 tiles through StateView", () => {
    const { state, engineer, zombie } = setup(); const trap = armed(state, engineer.x, engineer.y);
    const encoder = new Encoder(state);
    const snapshot = (viewer: PlayerState) => {
      const view = new StateView();
      if (canSeeEngineeringTrap(viewer, trap)) view.add(trap);
      const it = { offset: 0 }; encoder.encodeAll(it);
      const bytes = encoder.encodeAllView(view, it.offset, it);
      const decoded = new GameState(); new Decoder(decoded).decode(bytes); view.dispose(); return decoded;
    };
    expect(snapshot(engineer).engineeringTraps.size).toBe(1);
    expect(snapshot(zombie).engineeringTraps.size).toBe(0);
    zombie.x = trap.x + TILE_SIZE * 1.5;
    expect(snapshot(zombie).engineeringTraps.size).toBe(1);
  });
  it("removes traps and casting on infection", () => {
    const { state, engineer, system } = setup(); system.tryActivate(state, "engineer", 1000); system.update(state, 1500);
    expect(infectHuman(state, "engineer", 1600)).toBe(true);
    expect(state.engineeringTraps.size).toBe(0); expect(engineer.trapCastEndsAt).toBe(0); expect(engineer.trapCooldownEndsAt).toBe(0);
  });
});
