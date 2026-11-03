import {
  CHARACTER_IDS, GAME_PHASE, GRADUATE_ZOMBIE_CONFIG as C, PLAYER_ACTIVITY, PLAYER_ROLE,
  type GameState, type GraduateTrackingView, type PlayerState,
} from "@uos-survivors/shared";

interface TrackingRuntime { targetId: string; trackingEndsAt: number; cooldownEndsAt: number }
const detectable = (p: PlayerState | undefined): p is PlayerState =>
  !!p && !p.escaped && p.role === PLAYER_ROLE.human && p.activity === PLAYER_ACTIVITY.normal && p.connected;

export class GraduateTrackingSystem {
  private readonly runtimes = new Map<string, TrackingRuntime>();

  tryActivate(state: GameState, id: string, now: number): boolean {
    const owner = state.players.get(id);
    if (!owner || state.phase !== GAME_PHASE.playing || !owner.connected ||
      owner.characterId !== CHARACTER_IDS.graduateZombie || owner.role !== PLAYER_ROLE.zombie ||
      owner.activity !== PLAYER_ACTIVITY.normal || now < owner.stunnedUntil ||
      now < (this.runtimes.get(id)?.cooldownEndsAt ?? 0)) return false;
    let targetId = "", best = Infinity;
    for (const [candidateId, candidate] of [...state.players.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!detectable(candidate)) continue;
      const distance = (candidate.x - owner.x) ** 2 + (candidate.y - owner.y) ** 2;
      if (distance < best) { best = distance; targetId = candidateId; }
    }
    if (!targetId) return false;
    this.runtimes.set(id, { targetId, trackingEndsAt: now + C.detectionDurationMs, cooldownEndsAt: now + C.cooldownMs });
    return true;
  }

  view(state: GameState, id: string, now: number): GraduateTrackingView {
    const runtime = this.runtimes.get(id);
    if (!runtime) return { target: null, trackingEndsAt: 0, cooldownEndsAt: 0 };
    const candidate = state.players.get(runtime.targetId);
    if (state.phase !== GAME_PHASE.playing || now >= runtime.trackingEndsAt || !detectable(candidate)) {
      runtime.targetId = ""; runtime.trackingEndsAt = 0;
    }
    return {
      target: runtime.targetId && candidate ? { id: runtime.targetId, x: candidate.x, y: candidate.y } : null,
      trackingEndsAt: runtime.trackingEndsAt, cooldownEndsAt: runtime.cooldownEndsAt,
    };
  }

  remove(id: string): void { this.runtimes.delete(id); }
  clear(): void { this.runtimes.clear(); }
}
