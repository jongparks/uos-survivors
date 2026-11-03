import {
  getGameMap, getMapTile, TEST_GAME_MAP, type GameMapDefinition,
  CHARACTER_IDS, GAME_PHASE, PLAYER_ACTIVITY, PLAYER_ROLE, PLAYER_BODY_SIZE,
  LIBRARY_NPC_CONFIG as C, TILE_INDEX,
  BookBarrierState, bodyOverlapsBarrier, overlapsRectangle, collidesWithTestMap, type BarrierRectangle, type Position, type GameState,
} from "@uos-survivors/shared";


export function preservesNavigation(before: readonly BarrierRectangle[], candidate: BarrierRectangle, points: readonly Position[], map: GameMapDefinition = TEST_GAME_MAP): boolean {
  const spacing = map.tileSize / 2, width = Math.ceil(map.worldWidth / spacing), height = Math.ceil(map.worldHeight / spacing);
  const key = (p: Position) => Math.round(p.y / spacing) * width + Math.round(p.x / spacing);
  const components = (barriers: readonly BarrierRectangle[]) => {
    const labels = new Int32Array(width * height).fill(-1);
    const valid = (x: number, y: number) => !collidesWithTestMap(x, y, map) && !barriers.some(b => bodyOverlapsBarrier({ x, y }, b));
    const walkable = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) walkable[y * width + x] = valid(x * spacing, y * spacing) ? 1 : 0;
    let component = 0;
    for (let origin = 0; origin < walkable.length; origin++) {
      if (!walkable[origin] || labels[origin] !== -1) continue;
      const queue = [origin]; labels[origin] = component;
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i]!, x = id % width, y = Math.floor(id / width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy, next = ny * width + nx;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !walkable[next] || labels[next] !== -1 ||
            !valid((x + nx) * spacing / 2, (y + ny) * spacing / 2)) continue;
          labels[next] = component; queue.push(next);
        }
      }
      component++;
    }
    return labels;
  };
  const previous = components(before), proposed = components([...before, candidate]);
  for (const a of points) for (const b of points) {
    const first = key(a), second = key(b);
    if ((previous[first] ?? -1) >= 0 && previous[first] === previous[second] &&
      ((proposed[first] ?? -1) < 0 || proposed[first] !== proposed[second])) return false;
  }
  return true;
}

export class LibraryBarrierSystem {
  private serial = 0;
  constructor(private readonly protectedPoints?: readonly Position[]) {}

  tryActivate(state: GameState, id: string, now: number): boolean {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.libraryNpc ||
      p.role !== PLAYER_ROLE.zombie || !p.connected || p.activity !== PLAYER_ACTIVITY.normal ||
      now < p.stunnedUntil || now < p.barrierCooldownEndsAt) return false;
    const map = getGameMap(state.mapId), TILE_SIZE = map.tileSize;
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
        if (getMapTile(map, x, y) !== TILE_INDEX.floor) return false;
      }
    }
    if (existing.some(b => overlapsRectangle(candidate, b)) ||
      [...state.players.values()].some(player => !player.escaped && overlapsRectangle(candidate, { x: player.x, y: player.y, width: PLAYER_BODY_SIZE, height: PLAYER_BODY_SIZE }))) return false;
    const points = [...(this.protectedPoints ?? map.protectedPoints), ...[...state.players.values()].filter(player => player.role === PLAYER_ROLE.human && !player.escaped).map(player => ({ x: player.x, y: player.y }))];
    if (!preservesNavigation(existing, candidate, points, map)) return false;
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
