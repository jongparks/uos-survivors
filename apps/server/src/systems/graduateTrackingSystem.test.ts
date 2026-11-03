import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ACTIVITY, PLAYER_ROLE, SculptureDecoyState } from "@uos-survivors/shared";
import { GraduateTrackingSystem } from "./graduateTrackingSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const owner = new PlayerState(); owner.role = PLAYER_ROLE.zombie; owner.characterId = CHARACTER_IDS.graduateZombie;
  state.players.set("owner", owner);
  const near = new PlayerState(); near.x = 30; near.y = 40; state.players.set("near", near);
  const far = new PlayerState(); far.x = 60; state.players.set("far", far);
  return { state, owner, near, far, system: new GraduateTrackingSystem() };
}

describe("교수님이 찾으신다", () => {
  it("selects by straight-line distance, locks one target and tracks live position for four seconds", () => {
    const { state, near, far, system } = setup();
    expect(system.tryActivate(state, "owner", 1000)).toBe(true);
    expect(system.view(state, "owner", 1000)).toEqual({ target: { id: "near", x: 30, y: 40 }, trackingEndsAt: 5000, cooldownEndsAt: 36000 });
    near.x = 100; far.x = 1;
    expect(system.view(state, "owner", 2000).target).toEqual({ id: "near", x: 100, y: 40 });
    expect(system.tryActivate(state, "owner", 2000)).toBe(false);
    expect(system.view(state, "owner", 5000).target).toBeNull();
    expect(system.tryActivate(state, "owner", 35999)).toBe(false);
    expect(system.tryActivate(state, "owner", 36000)).toBe(true);
  });

  it("excludes hidden humans and decoys and does not consume cooldown without a target", () => {
    const { state, near, far, system } = setup();
    near.activity = PLAYER_ACTIVITY.hidden; far.role = PLAYER_ROLE.zombie;
    state.decoys.set("fake", new SculptureDecoyState());
    expect(system.tryActivate(state, "owner", 1000)).toBe(false);
    expect(system.view(state, "owner", 1000).cooldownEndsAt).toBe(0);
    near.activity = PLAYER_ACTIVITY.normal;
    expect(system.tryActivate(state, "owner", 1001)).toBe(true);
  });

  it.each(["hidden", "infected", "removed", "disconnected"])("ends on %s without switching or losing cooldown", reason => {
    const { state, near, system } = setup(); system.tryActivate(state, "owner", 1000);
    if (reason === "hidden") near.activity = PLAYER_ACTIVITY.hidden;
    if (reason === "infected") near.role = PLAYER_ROLE.zombie;
    if (reason === "removed") state.players.delete("near");
    if (reason === "disconnected") near.connected = false;
    expect(system.view(state, "owner", 1100)).toEqual({ target: null, trackingEndsAt: 0, cooldownEndsAt: 36000 });
    near.activity = PLAYER_ACTIVITY.normal; near.role = PLAYER_ROLE.human; near.connected = true;
    expect(system.view(state, "owner", 1200).target).toBeNull();
  });

  it("keeps runtime private per owner and restores valid tracking after reconnect", () => {
    const { state, owner, system } = setup(); system.tryActivate(state, "owner", 1000);
    expect(system.view(state, "far", 1100).target).toBeNull();
    owner.connected = false; owner.connected = true;
    expect(system.view(state, "owner", 2000).target?.id).toBe("near");
    owner.stunnedUntil = 40000;
    expect(system.tryActivate(state, "owner", 36000)).toBe(false);
    system.remove("owner"); expect(system.view(state, "owner", 2000).target).toBeNull();
  });

  it.each([CHARACTER_IDS.normalZombie, CHARACTER_IDS.drunkenZombie, CHARACTER_IDS.fossil])("rejects %s", characterId => {
    const { state, owner, system } = setup(); owner.characterId = characterId;
    expect(system.tryActivate(state, "owner", 1000)).toBe(false);
  });
});
