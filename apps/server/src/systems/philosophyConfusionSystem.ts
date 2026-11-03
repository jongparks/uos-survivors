import {
  CHARACTER_IDS, GAME_PHASE, PHILOSOPHY_STUDENT_CONFIG as C, PLAYER_ACTIVITY, PLAYER_ROLE, TILE_SIZE,
  type GameState, type PlayerState,
} from "@uos-survivors/shared";

export function tryActivateSocraticMethod(state: GameState, id: string, now: number): string | null {
  const caster = state.players.get(id);
  if (!caster || state.phase !== GAME_PHASE.playing || !caster.connected ||
    caster.characterId !== CHARACTER_IDS.philosophyStudent || caster.role !== PLAYER_ROLE.human ||
    caster.activity !== PLAYER_ACTIVITY.normal || now < caster.stunnedUntil || now < caster.philosophyCooldownEndsAt) return null;
  let nearest: PlayerState | undefined, nearestId = "", best = (C.rangeTiles * TILE_SIZE) ** 2;
  for (const [targetId, target] of [...state.players.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (target.role !== PLAYER_ROLE.zombie || !target.connected || target.activity !== PLAYER_ACTIVITY.normal) continue;
    const distance = (target.x - caster.x) ** 2 + (target.y - caster.y) ** 2;
    if (distance <= best && (!nearest || distance < best)) { nearest = target; nearestId = targetId; best = distance; }
  }
  if (!nearest || now < nearest.confusionEndsAt) return null;
  nearest.confusionEndsAt = now + C.confusionDurationMs;
  caster.philosophyCooldownEndsAt = now + C.cooldownMs;
  return nearestId;
}

export function updateConfusion(p: PlayerState, now: number): void {
  if (p.role !== PLAYER_ROLE.zombie || now >= p.confusionEndsAt) p.confusionEndsAt = 0;
}
export function resetPhilosophyState(p: PlayerState): void {
  p.confusionEndsAt = 0; p.philosophyCooldownEndsAt = 0;
}
