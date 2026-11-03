import {
  getGameMap, getMapTile,
  CHARACTER_IDS, GAME_PHASE, LATE_ZOMBIE_CONFIG as C, PLAYER_ACTIVITY, PLAYER_ROLE,
  PLAYER_BODY_SIZE, TILE_INDEX, type GameState, type PlayerState,
} from "@uos-survivors/shared";

// Continuous swept-body test: ray versus target box expanded by the moving body.
function entry(x: number, y: number, dx: number, dy: number, cx: number, cy: number, halfWidth: number, halfHeight: number): number {
  let near = 0, far = Infinity;
  for (const [origin, direction, min, max] of [[x, dx, cx - halfWidth, cx + halfWidth], [y, dy, cy - halfHeight, cy + halfHeight]] as const) {
    if (direction === 0) { if (origin <= min || origin >= max) return Infinity; }
    else {
      const a = (min - origin) / direction, b = (max - origin) / direction;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    }
  }
  return near <= far && far > 0 ? near : Infinity;
}

export class LateDashSystem {
  private readonly traveled = new Map<string, number>();
  tryActivate(state: GameState, id: string, now: number): boolean {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.lateZombie ||
      p.role !== PLAYER_ROLE.zombie || !p.connected || p.activity !== PLAYER_ACTIVITY.normal ||
      now < p.stunnedUntil || now < p.rootedUntil || now < p.dashCooldownEndsAt || this.traveled.has(id)) return false;
    const length = Math.hypot(p.facingX, p.facingY);
    if (!length) return false;
    p.dashStartedAt = now; p.dashEndsAt = now + C.dashDurationMs; p.dashCooldownEndsAt = now + C.cooldownMs;
    p.dashStartX = p.x; p.dashStartY = p.y;
    p.dashDirectionX = p.facingX / length; p.dashDirectionY = p.facingY / length;
    this.traveled.set(id, 0); return true;
  }

  cancel(id: string, player?: PlayerState): void {
    this.traveled.delete(id);
    if (player) player.dashEndsAt = 0;
  }
  clear(state: GameState): void {
    this.traveled.clear();
    state.players.forEach(p => { p.dashStartedAt = 0; p.dashEndsAt = 0; p.dashCooldownEndsAt = 0; });
  }

  // Returns true if this tick's movement belongs to the dash, even if it ends.
  updatePlayer(state: GameState, id: string, now: number, infect: (id: string) => void, hitDecoy: (id: string, attacker: PlayerState) => void): boolean {
    const traveled = this.traveled.get(id), p = state.players.get(id);
    if (traveled === undefined) return false;
    if (!p || !p.connected || state.phase !== GAME_PHASE.playing || p.role !== PLAYER_ROLE.zombie ||
      p.activity !== PLAYER_ACTIVITY.normal || now < p.stunnedUntil || now < p.rootedUntil) { this.cancel(id, p); return true; }

    const map = getGameMap(state.mapId), TILE_SIZE = map.tileSize;
    const TEST_MAP_WIDTH = Math.ceil(map.worldWidth / TILE_SIZE), TEST_MAP_HEIGHT = Math.ceil(map.worldHeight / TILE_SIZE);
    const total = TILE_SIZE * C.dashDistanceTiles;
    const step = Math.max(0, Math.min(total, total * (now - p.dashStartedAt) / C.dashDurationMs) - traveled);
    let distance = Infinity, kind = "wall", targetId = "";
    const half = PLAYER_BODY_SIZE / 2;
    const test = (x: number, y: number, w: number, h: number) => entry(p.x, p.y, p.dashDirectionX, p.dashDirectionY, x, y, w / 2 + half, h / 2 + half);
    for (let y = -1; y <= TEST_MAP_HEIGHT; y++) for (let x = -1; x <= TEST_MAP_WIDTH; x++) {
      if (getMapTile(map, x, y) === TILE_INDEX.floor) continue;
      distance = Math.min(distance, test((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE, TILE_SIZE, TILE_SIZE));
    }
    for (const [key, decoy] of [...state.decoys.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const d = test(decoy.x, decoy.y, PLAYER_BODY_SIZE, PLAYER_BODY_SIZE);
      if (d < distance) { distance = d; kind = "decoy"; targetId = key; }
    }
    for (const [key, human] of [...state.players.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (human.role !== PLAYER_ROLE.human || human.escaped || !human.connected || human.activity === PLAYER_ACTIVITY.hidden) continue;
      const d = test(human.x, human.y, PLAYER_BODY_SIZE, PLAYER_BODY_SIZE);
      if (d < distance) { distance = d; kind = "human"; targetId = key; }
    }
    const travel = Math.min(step, Math.max(0, distance - 0.001));
    p.x += p.dashDirectionX * travel; p.y += p.dashDirectionY * travel;
    p.facingX = p.dashDirectionX; p.facingY = p.dashDirectionY;
    this.traveled.set(id, traveled + travel);
    if (distance <= step) {
      this.cancel(id, p);
      if (kind === "human") infect(targetId);
      if (kind === "decoy") hitDecoy(targetId, p);
    } else if (now >= p.dashEndsAt || traveled + travel >= total - 0.001) this.cancel(id, p);
    return true;
  }
}
