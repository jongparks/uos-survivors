import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, SculptureDecoyState, TILE_SIZE, VomitPuddleState, getPuddleSpeedMultiplier, tileToWorld } from "@uos-survivors/shared";
import { VomitSystem } from "./vomitSystem.js";
import { infectHuman } from "./infectionSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const owner = new PlayerState();
  Object.assign(owner, { role: PLAYER_ROLE.zombie, characterId: CHARACTER_IDS.drunkenZombie, x: tileToWorld(2), y: tileToWorld(2) });
  state.players.set("owner", owner);
  return { state, owner, system: new VomitSystem() };
}

describe("숙취 폭발", () => {
  it("hits the boundary before a human behind the wall, leaving a puddle at the last valid position", () => {
    const { state, owner, system } = setup();
    owner.x = tileToWorld(1); owner.facingX = -1;
    const human = new PlayerState(); human.x = 0; human.y = owner.y; state.players.set("behind", human);
    system.tryActivate(state, "owner", 1000); system.update(state, 1500, 0, () => {}, () => {});
    let hits = 0;
    system.update(state, 2000, 1, () => { hits++; }, () => {});
    expect(hits).toBe(0); expect(state.vomitProjectiles.size).toBe(0);
    const puddle = [...state.vomitPuddles.values()][0];
    expect(puddle?.x).toBeGreaterThan(TILE_SIZE);
    expect(puddle?.x).toBeLessThan(owner.x);
  });
  it("locks direction, waits 500ms, rejects duplicate requests and preserves cooldown on stun", () => {
    const { state, owner, system } = setup();
    expect(system.tryActivate(state, "owner", 1000)).toBe(true);
    expect(system.tryActivate(state, "owner", 1001)).toBe(false);
    owner.facingX = -1;
    system.update(state, 1499, 0.1, () => {}, () => {});
    expect(state.vomitProjectiles.size).toBe(0);
    system.update(state, 1500, 0.1, () => {}, () => {});
    expect(state.vomitProjectiles.size).toBe(1);
    expect([...state.vomitProjectiles.values()][0]?.directionX).toBe(1);
    expect(owner.vomitCooldownEndsAt).toBe(31000);
    system.clear(state);
    system.tryActivate(state, "owner", 2000); owner.stunnedUntil = 4000;
    system.update(state, 2500, 0.1, () => {}, () => {});
    expect(state.vomitProjectiles.size).toBe(0);
    expect(owner.vomitCooldownEndsAt).toBe(32000);
  });

  it("continuously hits only the first human and reuses infection cleanup without a puddle", () => {
    const { state, owner, system } = setup();
    for (const [id, offset] of [["first", 40], ["second", 80]] as const) {
      const human = new PlayerState(); Object.assign(human, { x: owner.x + offset, y: owner.y, activeDecoyId: "old", decoyCooldownEndsAt: 9999 });
      state.players.set(id, human);
    }
    system.tryActivate(state, "owner", 1000); system.update(state, 1500, 0, () => {}, () => {});
    system.update(state, 2000, 0.5, id => { infectHuman(state, id, 2000); }, () => {});
    expect(state.players.get("first")?.role).toBe(PLAYER_ROLE.zombie);
    expect(state.players.get("first")?.activeDecoyId).toBe("");
    expect(state.players.get("second")?.role).toBe(PLAYER_ROLE.human);
    expect(state.vomitPuddles.size).toBe(0);
    expect(state.vomitProjectiles.size).toBe(0);
  });

  it("decoy intercepts the projectile and stuns its owner without a puddle", () => {
    const { state, owner, system } = setup();
    const decoy = new SculptureDecoyState(); decoy.x = owner.x + 40; decoy.y = owner.y; state.decoys.set("decoy", decoy);
    system.tryActivate(state, "owner", 1000); system.update(state, 1500, 0, () => {}, () => {});
    system.update(state, 1600, 1, () => {}, (id, attacker) => { state.decoys.delete(id); attacker.stunnedUntil = 3100; });
    expect(owner.stunnedUntil).toBe(3100); expect(state.decoys.size).toBe(0); expect(state.vomitPuddles.size).toBe(0);
  });

  it("range expiration creates a 4 second puddle; slow never stacks or affects zombies", () => {
    const { state, owner, system } = setup();
    system.tryActivate(state, "owner", 1000); system.update(state, 1500, 0, () => {}, () => {});
    system.update(state, 2200, 1, () => {}, () => {});
    const puddle = [...state.vomitPuddles.values()][0]; expect(puddle).toBeDefined();
    expect(puddle!.x - owner.x).toBeLessThanOrEqual(5 * TILE_SIZE);
    const human = new PlayerState(); human.x = puddle!.x; human.y = puddle!.y;
    const duplicate = new VomitPuddleState(); Object.assign(duplicate, { x: human.x, y: human.y, radius: TILE_SIZE, expiresAt: 6200 }); state.vomitPuddles.set("duplicate", duplicate);
    expect(getPuddleSpeedMultiplier(state, human, 2200)).toBe(0.75);
    expect(getPuddleSpeedMultiplier(state, owner, 2200)).toBe(1);
    human.x += 2 * TILE_SIZE; expect(getPuddleSpeedMultiplier(state, human, 2200)).toBe(1);
    system.update(state, 6200, 0, () => {}, () => {}); expect(state.vomitPuddles.size).toBe(0);
  });
});
