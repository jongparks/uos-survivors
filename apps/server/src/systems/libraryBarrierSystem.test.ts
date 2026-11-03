import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, TILE_SIZE, PLAYER_SPEED, tileToWorld, applyMovementWithBarriers, type BarrierRectangle } from "@uos-survivors/shared";
import { LibraryBarrierSystem, preservesNavigation } from "./libraryBarrierSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const owner = new PlayerState(); Object.assign(owner, { characterId: CHARACTER_IDS.libraryNpc, role: PLAYER_ROLE.zombie, x: tileToWorld(2), y: tileToWorld(2) });
  state.players.set("owner", owner);
  return { state, owner, system: new LibraryBarrierSystem() };
}

describe("자리 맡아놨습니다", () => {
  it("places one 2x1 barrier two tiles ahead, expires at 12 seconds and retains 30 second cooldown", () => {
    const { state, owner, system } = setup();
    expect(system.tryActivate(state, "owner", 1000)).toBe(true);
    const b = [...state.bookBarriers.values()][0]!;
    expect(b.x - owner.x).toBe(2 * TILE_SIZE); expect(b.width).toBe(96); expect(b.height).toBe(48);
    expect(b.expiresAt).toBe(13000); expect(owner.barrierCooldownEndsAt).toBe(31000);
    expect(system.tryActivate(state, "owner", 1001)).toBe(false);
    system.update(state, 12999); expect(state.bookBarriers.size).toBe(1);
    system.update(state, 13000); expect(state.bookBarriers.size).toBe(0);
    expect(system.tryActivate(state, "owner", 30999)).toBe(false);
    expect(system.tryActivate(state, "owner", 31000)).toBe(true);
    state.phase = GAME_PHASE.finished; system.update(state, 31001); expect(state.bookBarriers.size).toBe(0);
  });

  it("rejects walls, outside-map locations and player overlap without spending cooldown", () => {
    const { state, owner, system } = setup();
    owner.facingX = -1; expect(system.tryActivate(state, "owner", 1000)).toBe(false);
    expect(owner.barrierCooldownEndsAt).toBe(0);
    owner.facingX = 1;
    const human = new PlayerState(); human.x = tileToWorld(4); human.y = owner.y; state.players.set("human", human);
    expect(system.tryActivate(state, "owner", 1000)).toBe(false);
    human.role = PLAYER_ROLE.zombie; expect(system.tryActivate(state, "owner", 1000)).toBe(false);
    expect(owner.barrierCooldownEndsAt).toBe(0);
  });

  it("rejects an existing barrier or protected destination and resets cleanly", () => {
    const { state, owner, system } = setup();
    system.tryActivate(state, "owner", 1000);
    const other = new PlayerState(); Object.assign(other, { characterId: owner.characterId, role: owner.role, x: owner.x, y: owner.y }); state.players.set("other", other);
    expect(system.tryActivate(state, "other", 1001)).toBe(false); expect(other.barrierCooldownEndsAt).toBe(0);
    system.clear(state); expect(state.bookBarriers.size).toBe(0); expect(owner.barrierCooldownEndsAt).toBe(0);
    const protectedSystem = new LibraryBarrierSystem([{ x: tileToWorld(4), y: owner.y }]);
    expect(protectedSystem.tryActivate(state, "owner", 2000)).toBe(false);
  });

  it.each([CHARACTER_IDS.normalZombie, CHARACTER_IDS.drunkenZombie, CHARACTER_IDS.graduateZombie])("rejects the ability for %s", characterId => {
    const { state, owner, system } = setup(); owner.characterId = characterId;
    expect(system.tryActivate(state, "owner", 1000)).toBe(false);
  });

  it("allows closing one passage when alternatives remain, but rejects closing the final route", () => {
    const points = [{ x: tileToWorld(14), y: tileToWorld(10) }, { x: tileToWorld(18), y: tileToWorld(10) }];
    const candidate: BarrierRectangle = { x: tileToWorld(16), y: tileToWorld(10), width: 96, height: 48, expiresAt: 99999 };
    expect(preservesNavigation([], candidate, points)).toBe(true);
    const existing = [
      { x: tileToWorld(16), y: 96, width: 48, height: 96, expiresAt: 99999 },
      { x: tileToWorld(16), y: 936, width: 48, height: 144, expiresAt: 99999 },
    ];
    expect(preservesNavigation(existing, candidate, points)).toBe(false);
  });

  it.each([PLAYER_ROLE.human, PLAYER_ROLE.zombie])("blocks only humans and does not tunnel during long steps: %s", role => {
    const position = { x: tileToWorld(2), y: tileToWorld(2) };
    const barrier = { x: tileToWorld(4), y: position.y, width: 96, height: 48, expiresAt: 10000 };
    applyMovementWithBarriers(position, { moveX: 1, moveY: 0 }, PLAYER_SPEED, 1, role, [barrier], 1000);
    if (role === PLAYER_ROLE.human) expect(position.x).toBeLessThan(barrier.x - barrier.width / 2);
    else expect(position.x).toBeGreaterThan(barrier.x + barrier.width / 2);
    const before = position.x;
    applyMovementWithBarriers(position, { moveX: 1, moveY: 0 }, PLAYER_SPEED, 1, role, [barrier], 10000);
    expect(position.x).toBeGreaterThan(before);
  });
});
