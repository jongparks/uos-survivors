import {
  CHARACTER_IDS, DANGER_LEVEL, GAME_PHASE, HUMAN_DANGER_CONFIG as C,
  PLAYER_ACTIVITY, PLAYER_ROLE, TILE_SIZE,
  type DangerLevel, type DangerUpdate, type GameState, type PlayerState,
} from "@uos-survivors/shared";

export function calculateHumanDanger(state: GameState, human: PlayerState): DangerLevel {
  if (state.phase !== GAME_PHASE.playing || human.role !== PLAYER_ROLE.human || !human.connected ||
    (human.characterId === CHARACTER_IDS.fossil && human.activity === PLAYER_ACTIVITY.hidden)) return DANGER_LEVEL.none;
  let result: DangerLevel = DANGER_LEVEL.none;
  for (const zombie of state.players.values()) {
    if (zombie.role !== PLAYER_ROLE.zombie || !zombie.connected || zombie.activity !== PLAYER_ACTIVITY.normal) continue;
    const distance = Math.hypot(human.x - zombie.x, human.y - zombie.y) / TILE_SIZE;
    if (distance > C.maxRangeTiles) continue;
    if (distance < C.dangerRangeTiles && !(zombie.characterId === CHARACTER_IDS.xmanZombie && zombie.isDisguised)) return DANGER_LEVEL.danger;
    result = DANGER_LEVEL.warning;
  }
  return result;
}

export class HumanDangerSystem {
  private lastUpdatedAt = -Infinity;
  private signature = "";
  private readonly lastLevels = new Map<string, DangerLevel>();

  update(state: GameState, now: number, send: (id: string, update: DangerUpdate) => void): void {
    // Movement updates are sampled every 100ms. Team/disguise/visibility changes
    // invalidate that interval so infection and reveals are handled this tick.
    const signature = state.phase + [...state.players.entries()].map(([id, p]) =>
      `${id}:${p.role}:${p.characterId}:${p.isDisguised}:${p.activity}:${p.connected}`).join("|");
    if (signature === this.signature && now - this.lastUpdatedAt < C.intervalMs) return;
    this.signature = signature; this.lastUpdatedAt = now;
    for (const id of this.lastLevels.keys()) {
      const p = state.players.get(id);
      if (!p || p.role !== PLAYER_ROLE.human || !p.connected) this.lastLevels.delete(id);
    }
    state.players.forEach((human, id) => {
      if (human.role !== PLAYER_ROLE.human || !human.connected) return;
      const level = calculateHumanDanger(state, human);
      if (this.lastLevels.get(id) !== level) { this.lastLevels.set(id, level); send(id, { level }); }
    });
  }
  forget(id: string): void { this.lastLevels.delete(id); }
}
