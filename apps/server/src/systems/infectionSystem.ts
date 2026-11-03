import {
  COMBAT_RULES,
  GAME_PHASE,
  MATCH_WINNER,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  SPRINT_STATE,
  CHARACTER_IDS,
  type GameState,
} from "@uos-survivors/shared";

export function infectHuman(state: GameState, sessionId: string, now: number): boolean {
  const player = state.players.get(sessionId);

  if (!player || player.role !== PLAYER_ROLE.human) {
    return false;
  }

  player.role = PLAYER_ROLE.zombie;
  state.decoys.forEach((decoy, id) => {
    if (decoy.ownerSessionId === sessionId || id === player.activeDecoyId) state.decoys.delete(id);
  });
  player.characterId = CHARACTER_IDS.normalZombie;
  player.vomitCastEndsAt = 0;
  player.vomitCooldownEndsAt = 0;
  player.activity = PLAYER_ACTIVITY.normal;
  player.activeHideSpotId = "";
  player.hideStartedAt = 0;
  player.hideEndsAt = 0;
  player.sprintState = SPRINT_STATE.ready;
  player.skillStartedAt = 0;
  player.sprintEndsAt = 0;
  player.exhaustionEndsAt = 0;
  player.cooldownEndsAt = 0;
  player.activeDecoyId = "";
  player.decoyCooldownEndsAt = 0;
  player.stunnedUntil = 0;
  player.attackLockedUntil = now + COMBAT_RULES.infectionAttackLockMs;
  player.nextAttackAt = player.attackLockedUntil;
  player.lastBasicAttackAt = 0;
  player.barrierCooldownEndsAt = 0;
  player.isDisguised = false;
  player.disguiseEndsAt = 0;
  player.disguiseCooldownEndsAt = 0;
  player.dashStartedAt = 0;
  player.dashEndsAt = 0;
  player.dashCooldownEndsAt = 0;
  return true;
}

export function finishIfAllHumansInfected(state: GameState): boolean {
  if (state.phase !== GAME_PHASE.playing) {
    return false;
  }

  const humanCount = Array.from(state.players.values()).filter(
    (player) => player.role === PLAYER_ROLE.human,
  ).length;

  if (humanCount > 0) {
    return false;
  }

  state.phase = GAME_PHASE.finished;
  state.winner = MATCH_WINNER.zombie;
  return true;
}
