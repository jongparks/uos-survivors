import {
  CHARACTER_IDS,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  SPORTS_STUDENT_CONFIG,
  SPRINT_STATE,
  getSportsSpeedMultiplier,
  type PlayerState,
} from "@uos-survivors/shared";

export function resetSportsSprint(player: PlayerState): void {
  player.sprintState = SPRINT_STATE.ready;
  player.skillStartedAt = 0;
  player.sprintEndsAt = 0;
  player.exhaustionEndsAt = 0;
  player.cooldownEndsAt = 0;
}

export function updateSportsSprint(player: PlayerState, now: number): void {
  if (
    player.characterId !== CHARACTER_IDS.sportsStudent ||
    player.role !== PLAYER_ROLE.human
  ) {
    resetSportsSprint(player);
    return;
  }

  if (player.sprintState === SPRINT_STATE.sprinting && now >= player.sprintEndsAt) {
    player.sprintState =
      now < player.exhaustionEndsAt ? SPRINT_STATE.exhausted : SPRINT_STATE.cooldown;
  }

  if (player.sprintState === SPRINT_STATE.exhausted && now >= player.exhaustionEndsAt) {
    player.sprintState = SPRINT_STATE.cooldown;
  }

  if (player.sprintState === SPRINT_STATE.cooldown && now >= player.cooldownEndsAt) {
    resetSportsSprint(player);
  }
}

export function tryActivateSportsSprint(player: PlayerState, now: number): boolean {
  updateSportsSprint(player, now);
  if (
    player.characterId !== CHARACTER_IDS.sportsStudent ||
    player.role !== PLAYER_ROLE.human ||
    player.activity !== PLAYER_ACTIVITY.normal ||
    !player.connected ||
    player.sprintState !== SPRINT_STATE.ready
  ) {
    return false;
  }

  player.sprintState = SPRINT_STATE.sprinting;
  player.skillStartedAt = now;
  player.sprintEndsAt = now + SPORTS_STUDENT_CONFIG.sprintDurationMs;
  player.exhaustionEndsAt = player.sprintEndsAt + SPORTS_STUDENT_CONFIG.exhaustionDurationMs;
  player.cooldownEndsAt = now + SPORTS_STUDENT_CONFIG.cooldownMs;
  return true;
}

export function getPlayerSpeedMultiplier(player: PlayerState): number {
  return player.characterId === CHARACTER_IDS.sportsStudent &&
    player.role === PLAYER_ROLE.human
    ? getSportsSpeedMultiplier(player.sprintState)
    : 1;
}
