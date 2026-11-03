import {
  getGameMap, CHARACTER_IDS, ENGINEERING_TRAP_CONFIG as C, EngineeringTrapState, GAME_PHASE, PLAYER_ACTIVITY,
  PLAYER_ROLE, PLAYER_BODY_SIZE, TILE_SIZE, collidesWithTestMap,
  type GameState, type PlayerState, type Position,
} from "@uos-survivors/shared";
import { endXmanDisguise } from "./xmanDisguiseSystem.js";

export function canSeeEngineeringTrap(viewer: PlayerState, trap: EngineeringTrapState, tileSize = TILE_SIZE): boolean {
  return viewer.role === PLAYER_ROLE.human || Math.hypot(viewer.x - trap.x, viewer.y - trap.y) <= C.zombieVisibilityTiles * tileSize;
}

export class EngineeringTrapSystem {
  private serial = 0;
  private readonly casts = new Map<string, Position>();

  tryActivate(state: GameState, id: string, now: number): boolean {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.engineeringStudent ||
      p.role !== PLAYER_ROLE.human || p.escaped || !p.connected || p.activity !== PLAYER_ACTIVITY.normal || now < p.stunnedUntil || now < p.assignmentLockEndsAt ||
      now < p.trapCooldownEndsAt || this.casts.has(id) ||
      [...state.engineeringTraps.values()].some(t => t.ownerSessionId === id)) return false;
    p.trapCastEndsAt = now + C.castTimeMs;
    this.casts.set(id, { x: p.x, y: p.y }); return true;
  }

  update(state: GameState, now: number): void {
    if (state.phase !== GAME_PHASE.playing) { this.clear(state); return; }
    state.engineeringTraps.forEach((trap, id) => {
      const owner = state.players.get(trap.ownerSessionId);
      if (now >= trap.expiresAt || !owner || owner.role !== PLAYER_ROLE.human || owner.escaped) state.engineeringTraps.delete(id);
    });
    for (const [id, start] of this.casts) {
      const p = state.players.get(id);
      if (!p || p.role !== PLAYER_ROLE.human || p.escaped || p.characterId !== CHARACTER_IDS.engineeringStudent || !p.connected ||
        p.activity !== PLAYER_ACTIVITY.normal || now < p.stunnedUntil || now < p.assignmentLockEndsAt) { this.cancel(id, p); continue; }
      if (now < p.trapCastEndsAt) continue;
      this.cancel(id, p);
      if (collidesWithTestMap(start.x, start.y, getGameMap(state.mapId))) continue;
      const trap = new EngineeringTrapState();
      Object.assign(trap, { ownerSessionId: id, x: start.x, y: start.y, createdAt: now,
        activatesAt: now + C.activationDelayMs, expiresAt: now + C.lifetimeMs });
      state.engineeringTraps.set(`trap-${++this.serial}`, trap);
      p.trapCooldownEndsAt = now + C.cooldownMs;
    }
  }

  checkPlayer(state: GameState, p: PlayerState, now: number, from: Position = p): boolean {
    if (state.phase !== GAME_PHASE.playing || p.role !== PLAYER_ROLE.zombie || !p.connected ||
      (p.characterId === CHARACTER_IDS.lateZombie && p.dashEndsAt > 0)) return false;
    const end = { x: p.x, y: p.y };
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - from.x, end.y - from.y) / 8));
    for (let i = 0; i <= steps; i++) {
      const point = { x: from.x + (end.x - from.x) * i / steps, y: from.y + (end.y - from.y) * i / steps };
      for (const [id, trap] of state.engineeringTraps) {
        if (now < trap.activatesAt || now >= trap.expiresAt || Math.abs(point.x - trap.x) >= PLAYER_BODY_SIZE || Math.abs(point.y - trap.y) >= PLAYER_BODY_SIZE) continue;
        if (p.characterId === CHARACTER_IDS.xmanZombie && p.isDisguised) {
          endXmanDisguise(p, now, "disabled"); p.attackLockedUntil = Math.max(p.attackLockedUntil, now + 500);
        }
        if (now >= p.rootedUntil) p.rootedUntil = now + C.rootDurationMs;
        p.x = point.x; p.y = point.y;
        state.engineeringTraps.delete(id); return true;
      }
    }
    return false;
  }

  cancel(id: string, p?: PlayerState): void { this.casts.delete(id); if (p) p.trapCastEndsAt = 0; }
  removeOwner(state: GameState, id: string): void {
    this.cancel(id, state.players.get(id));
    state.engineeringTraps.forEach((t, key) => { if (t.ownerSessionId === id) state.engineeringTraps.delete(key); });
  }
  clear(state: GameState): void {
    this.casts.clear(); state.engineeringTraps.clear();
    state.players.forEach(p => { p.trapCastEndsAt = 0; p.trapCooldownEndsAt = 0; p.rootedUntil = 0; });
  }
}
