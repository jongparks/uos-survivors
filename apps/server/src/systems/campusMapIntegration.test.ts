import { describe, expect, it } from "vitest";
import { getGameMap, getMapTiles, collidesWithMap, scaleGameMap, GameState, PlayerState, GAME_PHASE, CHARACTER_IDS, PLAYER_ROLE } from "@uos-survivors/shared";
import { LateDashSystem } from "./lateDashSystem.js";
import { VomitSystem } from "./vomitSystem.js";
import { FossilHideSystem } from "./fossilHideSystem.js";
import { ComputerRewindSystem } from "./computerRewindSystem.js";

describe("campus map integration", () => {
  it("scales collision, geometry, spawn, gate and hide coordinates together", () => {
    const map = getGameMap("MAP_UOS_CAMPUS_V2"), scaled = scaleGameMap(map, 2, "SCALED");
    expect(scaled.worldWidth).toBe(map.worldWidth * 2); expect(scaled.tileSize).toBe(64);
    expect(scaled.spawns[0]!.x).toBe(map.spawns[0]!.x * 2);
    expect(scaled.gates[0]!.interactionRadius).toBe(map.gates[0]!.interactionRadius * 2);
    expect(getMapTiles(scaled)).toEqual(getMapTiles(map));
    expect(map.worldWidth).toBe(5616); expect(map.worldHeight).toBe(3024);
    expect(map.tileSize).toBe(32); expect(map.artScale).toBe(1.8);
    expect(map.gates.every(g => g.interactionRadius === 48)).toBe(true);
    expect(map.hideSpots.every(h => h.interactionRadius === 40)).toBe(true);
  });
  it("uses 32px tiles for dash and projectile abilities, instead of test-map constants", () => {
    const state = new GameState(); state.mapId = "MAP_UOS_CAMPUS_V2"; state.phase = GAME_PHASE.playing;
    const map = getGameMap(state.mapId);
    const start = map.spawns.find(p => Array.from({ length: 7 }, (_, i) => p.x + i * 32).every(x => !collidesWithMap(x, p.y, map)))!;
    expect(start).toBeDefined();
    const player = new PlayerState(); Object.assign(player, { role: PLAYER_ROLE.zombie, characterId: CHARACTER_IDS.lateZombie, ...start }); state.players.set("z", player);
    const dash = new LateDashSystem(); dash.tryActivate(state, "z", 1000); dash.updatePlayer(state, "z", 1500, () => {}, () => {});
    expect(player.x - start.x).toBeCloseTo(96);
    player.characterId = CHARACTER_IDS.drunkenZombie; player.x = start.x;
    const vomit = new VomitSystem(); vomit.tryActivate(state, "z", 2000); vomit.update(state, 2500, 0, () => {}, () => {});
    expect([...state.vomitProjectiles.values()][0]?.remainingRange).toBe(160);
  });
  it("activates exactly five valid outdoor hiding spots", () => {
    const map = getGameMap("MAP_UOS_CAMPUS_V2"), hide = new FossilHideSystem(map.hideSpots);
    hide.prepareForMatch(); expect(hide.getAvailableSpotViews()).toHaveLength(5);
    expect(hide.getAvailableSpotViews().every(p => !collidesWithMap(p.x, p.y, map))).toBe(true);
  });
  it("does not rewind into campus buildings", () => {
    const state = new GameState(); state.mapId = "MAP_UOS_CAMPUS_V2"; state.phase = GAME_PHASE.playing;
    const building = getGameMap(state.mapId).objects.find(o => o.kind === "building")!;
    const p = new PlayerState(); Object.assign(p, { characterId: CHARACTER_IDS.computerStudent, x: building.x + 16, y: building.y + 16 }); state.players.set("cs", p);
    const rewind = new ComputerRewindSystem();
    for (let now = 1000; now <= 4100; now += 50) rewind.record(state, "cs", now);
    expect(rewind.tryActivate(state, "cs", 4100)).toBe(false); expect(p.rewindCooldownEndsAt).toBe(0);
  });
});
