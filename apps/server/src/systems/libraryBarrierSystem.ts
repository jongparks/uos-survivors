import {
  CHARACTER_IDS, GAME_PHASE, PLAYER_ACTIVITY, PLAYER_ROLE, PLAYER_BODY_SIZE,
  LIBRARY_NPC_CONFIG as C, TILE_SIZE, TEST_MAP_WIDTH, TEST_MAP_HEIGHT, TILE_INDEX,
  BookBarrierState, bodyOverlapsBarrier, overlapsRectangle, collidesWithTestMap, getTestMapTile,
  type BarrierRectangle, type Position, type GameState,
} from "@uos-survivors/shared";
import { PROTECTED_NAVIGATION_POINTS } from "../maps/protectedNavigationPoints.js";

export function preservesNavigation(before: readonly BarrierRectangle[], candidate: BarrierRectangle, points: readonly Position[]): boolean {
  const spacing = TILE_SIZE / 2;
  const width = TEST_MAP_WIDTH * 2, height = TEST_MAP_HEIGHT * 2;
  const key = (p: Position) => Math.round(p.y / spacing) * width + Math.round(p.x / spacing);
  const reachable = (origin: Position, barriers: readonly BarrierRectangle[]) => {
    const valid = (x: number, y: number) => !collidesWithTestMap(x, y) && !barriers.some(b => bodyOverlapsBarrier({ x, y }, b));
    const sx = Math.round(origin.x / spacing), sy = Math.round(origin.y / spacing);
    const seen = new Set<number>();
    if (!valid(sx * spacing, sy * spacing)) return seen;
    const queue = [{ x: sx, y: sy }]; seen.add(sy * width + sx);
    for (let index = 0; index < queue.length; index++) {
      const p = queue[index]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = p.x + dx, y = p.y + dy, id = y * width + x;
        if (x < 0 || y < 0 || x >= width || y >= height || seen.has(id) ||
          !valid(x * spacing, y * spacing) || !valid((x + p.x) * spacing / 2, (y + p.y) * spacing / 2)) continue;
        seen.add(id); queue.push({ x, y });
      }
    }
    return seen;
  };
  for (const point of points) {
    const original = reachable(point, before), proposed = reachable(point, [...before, candidate]);
    for (const goal of points) if (original.has(key(goal)) && !proposed.has(key(goal))) return false;
  }
  return true;
}

export class LibraryBarrierSystem {
  private serial = 0;
  constructor(private readonly protectedPoints: readonly Position[] = PROTECTED_NAVIGATION_POINTS) {}

  tryActivate(state: GameState, id: string, now: number): boolean {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.libraryNpc ||
      p.role !== PLAYER_ROLE.zombie || !p.connected || p.activity !== PLAYER_ACTIVITY.normal ||
      now < p.stunnedUntil || now < p.barrierCooldownEndsAt) return false;
    const existing = [...state.bookBarriers.values()].filter(b => now < b.expiresAt);
    if (existing.some(b => b.ownerSessionId === id)) return false;
    const length = Math.hypot(p.facingX, p.facingY);
    if (!length) return false;
    // Fixed horizontal 2x1 footprint, centered exactly two tiles ahead. No
    // fallback placement: an invalid destination fails without spending cooldown.
    const candidate = new BookBarrierState();
    Object.assign(candidate, {
      ownerSessionId: id, x: p.x + p.facingX / length * TILE_SIZE * C.placementRangeTiles,
      y: p.y + p.facingY / length * TILE_SIZE * C.placementRangeTiles,
      width: TILE_SIZE * C.barrierWidthTiles, height: TILE_SIZE * C.barrierHeightTiles,
      createdAt: now, expiresAt: now + C.barrierDurationMs,
    });
    const left = candidate.x - candidate.width / 2, top = candidate.y - candidate.height / 2;
    for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + candidate.height - 0.001) / TILE_SIZE); y++) {
      for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + candidate.width - 0.001) / TILE_SIZE); x++) {
        if (getTestMapTile(x, y) !== TILE_INDEX.floor) return false;
      }
    }
    if (existing.some(b => overlapsRectangle(candidate, b)) ||
      [...state.players.values()].some(player => overlapsRectangle(candidate, { x: player.x, y: player.y, width: PLAYER_BODY_SIZE, height: PLAYER_BODY_SIZE }))) return false;
    const points = [...this.protectedPoints, ...[...state.players.values()].filter(player => player.role === PLAYER_ROLE.human).map(player => ({ x: player.x, y: player.y }))];
    if (!preservesNavigation(existing, candidate, points)) return false;
    state.bookBarriers.set(`books-${++this.serial}`, candidate);
    p.barrierCooldownEndsAt = now + C.cooldownMs;
    return true;
  }

  update(state: GameState, now: number): void {
    state.bookBarriers.forEach((b, id) => {
      if (state.phase !== GAME_PHASE.playing || now >= b.expiresAt) state.bookBarriers.delete(id);
    });
  }
  clear(state: GameState): void {
    state.bookBarriers.clear();
    state.players.forEach(p => { p.barrierCooldownEndsAt = 0; });
  }
}
