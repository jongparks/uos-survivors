import {
  CHARACTER_IDS, DRUNKEN_ZOMBIE_CONFIG as C, GAME_PHASE, PLAYER_ACTIVITY,
  PLAYER_BODY_SIZE, PLAYER_ROLE, TILE_SIZE, TILE_INDEX, TEST_MAP_WIDTH, TEST_MAP_HEIGHT,
  getTestMapTile, VomitProjectileState, VomitPuddleState,
  type GameState, type PlayerState,
} from "@uos-survivors/shared";

// Entry distance along a normalized ray. Expanding boxes by the projectile radius
// also catches wall edges; ties resolve walls, decoys, then humans in stable ID order.
function boxEntry(x: number, y: number, dx: number, dy: number, left: number, top: number, right: number, bottom: number): number {
  let near = 0, far = Infinity;
  for (const [origin, direction, min, max] of [[x, dx, left, right], [y, dy, top, bottom]] as const) {
    if (direction === 0) { if (origin < min || origin > max) return Infinity; }
    else {
      const a = (min - origin) / direction, b = (max - origin) / direction;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    }
  }
  return near <= far ? near : Infinity;
}

function circleEntry(x: number, y: number, dx: number, dy: number, cx: number, cy: number, radius: number): number {
  const ox = x - cx, oy = y - cy;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const b = ox * dx + oy * dy, discriminant = b * b - c;
  if (discriminant < 0) return Infinity;
  const entry = -b - Math.sqrt(discriminant);
  return entry >= 0 ? entry : Infinity;
}

export class VomitSystem {
  private serial = 0;
  private readonly casts = new Map<string, { x: number; y: number }>();

  tryActivate(state: GameState, id: string, now: number): boolean {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.drunkenZombie ||
      p.role !== PLAYER_ROLE.zombie || !p.connected || p.activity !== PLAYER_ACTIVITY.normal ||
      now < p.stunnedUntil || now < p.attackLockedUntil || now < p.vomitCooldownEndsAt || this.casts.has(id)) return false;
    const length = Math.hypot(p.facingX, p.facingY) || 1;
    this.casts.set(id, { x: p.facingX / length, y: p.facingY / length });
    p.vomitCastEndsAt = now + C.castTimeMs;
    p.vomitCooldownEndsAt = now + C.cooldownMs;
    return true;
  }

  cancel(id: string, player?: PlayerState): void {
    this.casts.delete(id);
    if (player) player.vomitCastEndsAt = 0;
  }

  clear(state: GameState): void {
    this.casts.clear(); state.vomitProjectiles.clear(); state.vomitPuddles.clear();
    state.players.forEach(p => { p.vomitCastEndsAt = 0; p.vomitCooldownEndsAt = 0; });
  }

  update(state: GameState, now: number, dt: number, infect: (id: string) => void, hitDecoy: (id: string, owner: PlayerState) => void): void {
    if (state.phase !== GAME_PHASE.playing) return;
    state.vomitPuddles.forEach((p, id) => { if (now >= p.expiresAt) state.vomitPuddles.delete(id); });
    const spawned = new Set<string>();
    for (const [id, direction] of this.casts) {
      const p = state.players.get(id);
      if (!p || !p.connected || p.role !== PLAYER_ROLE.zombie || now < p.stunnedUntil) { this.cancel(id, p); continue; }
      if (now < p.vomitCastEndsAt) continue;
      const projectile = new VomitProjectileState();
      Object.assign(projectile, { ownerSessionId: id, x: p.x, y: p.y, directionX: direction.x, directionY: direction.y, remainingRange: TILE_SIZE * C.projectileRangeTiles });
      const key = `vomit-${++this.serial}`;
      state.vomitProjectiles.set(key, projectile); spawned.add(key); this.cancel(id, p);
    }
    state.vomitProjectiles.forEach((p, id) => {
      if (spawned.has(id)) return;
      const radius = PLAYER_BODY_SIZE / 2 * C.projectileRadiusMultiplier;
      const step = Math.min(p.remainingRange, TILE_SIZE * C.projectileSpeedTilesPerSecond * dt);
      let distance = Infinity;
      let target = "wall", targetId = "";
      for (let y = -1; y <= TEST_MAP_HEIGHT; y++) for (let x = -1; x <= TEST_MAP_WIDTH; x++) {
        if (getTestMapTile(x, y) === TILE_INDEX.floor) continue;
        const d = boxEntry(p.x, p.y, p.directionX, p.directionY, x * TILE_SIZE - radius, y * TILE_SIZE - radius, (x + 1) * TILE_SIZE + radius, (y + 1) * TILE_SIZE + radius);
        if (d < distance) distance = d;
      }
      for (const [key, decoy] of [...state.decoys.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const d = circleEntry(p.x, p.y, p.directionX, p.directionY, decoy.x, decoy.y, PLAYER_BODY_SIZE / 2 + radius);
        if (d < distance) { distance = d; target = "decoy"; targetId = key; }
      }
      for (const [key, human] of [...state.players.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (human.role !== PLAYER_ROLE.human || human.activity === PLAYER_ACTIVITY.hidden) continue;
        const d = circleEntry(p.x, p.y, p.directionX, p.directionY, human.x, human.y, PLAYER_BODY_SIZE / 2 + radius);
        if (d < distance) { distance = d; target = "human"; targetId = key; }
      }
      const travel = Math.min(step, distance);
      p.x += p.directionX * Math.max(0, travel - (distance <= step && target === "wall" ? 0.01 : 0));
      p.y += p.directionY * Math.max(0, travel - (distance <= step && target === "wall" ? 0.01 : 0));
      p.remainingRange -= travel;
      if (distance > step && p.remainingRange > 0.001) return;
      state.vomitProjectiles.delete(id);
      if (distance <= step && target === "human") { infect(targetId); return; }
      if (distance <= step && target === "decoy") {
        const owner = state.players.get(p.ownerSessionId);
        if (owner) { hitDecoy(targetId, owner); this.cancel(p.ownerSessionId, owner); }
        else state.decoys.delete(targetId);
        return;
      }
      const puddle = new VomitPuddleState();
      Object.assign(puddle, { ownerSessionId: p.ownerSessionId, x: p.x, y: p.y, radius: TILE_SIZE * C.puddleRadiusTiles, createdAt: now, expiresAt: now + C.puddleDurationMs });
      state.vomitPuddles.set(`puddle-${++this.serial}`, puddle);
    });
  }
}
