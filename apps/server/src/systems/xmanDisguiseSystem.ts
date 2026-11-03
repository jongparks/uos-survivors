import { CHARACTER_IDS, GAME_PHASE, PLAYER_ACTIVITY, PLAYER_ROLE, XMAN_ZOMBIE_CONFIG as C, type GameState, type PlayerState } from "@uos-survivors/shared";

export function resetXmanDisguise(p: PlayerState): void {
  p.isDisguised = false; p.disguiseEndsAt = 0; p.disguiseCooldownEndsAt = 0;
}

export function endXmanDisguise(p: PlayerState, now: number, cause: "attack" | "manual" | "timeout" | "disabled"): void {
  if (!p.isDisguised) return;
  p.isDisguised = false; p.disguiseEndsAt = 0;
  if (cause === "manual" || cause === "timeout") {
    p.attackLockedUntil = Math.max(p.attackLockedUntil, now + C.attackDelayAfterManualCancelMs);
  }
}

export function updateXmanDisguise(p: PlayerState, now: number): void {
  if (!p.isDisguised) return;
  if (p.characterId !== CHARACTER_IDS.xmanZombie || p.role !== PLAYER_ROLE.zombie ||
    p.activity !== PLAYER_ACTIVITY.normal || now < p.stunnedUntil) endXmanDisguise(p, now, "disabled");
  else if (now >= p.disguiseEndsAt) endXmanDisguise(p, now, "timeout");
}

export function tryToggleXmanDisguise(state: GameState, id: string, now: number): boolean {
  const p = state.players.get(id);
  if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.xmanZombie ||
    p.role !== PLAYER_ROLE.zombie || !p.connected || p.activity !== PLAYER_ACTIVITY.normal || now < p.stunnedUntil) return false;
  updateXmanDisguise(p, now);
  if (p.isDisguised) { endXmanDisguise(p, now, "manual"); return true; }
  if (now < p.disguiseCooldownEndsAt) return false;
  p.isDisguised = true; p.disguiseEndsAt = now + C.disguiseDurationMs; p.disguiseCooldownEndsAt = now + C.cooldownMs;
  return true;
}
