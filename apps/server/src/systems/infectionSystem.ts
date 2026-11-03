import {
  COMBAT_RULES,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  SPRINT_STATE,
  CHARACTER_IDS,
  type GameState,
} from "@uos-survivors/shared";
import { finishIfNoActiveHumans } from "./matchOutcomeSystem.js";

export function infectHuman(state: GameState, sessionId: string, now: number): boolean {
  const player = state.players.get(sessionId);

  if (!player || player.role !== PLAYER_ROLE.human || player.escaped) {
    return false;
  }

  player.role = PLAYER_ROLE.zombie;
  player.personalResult = "INFECTED";
  player.escapeStartedAt = 0; player.escapingGateId = "";
  const result = state.roundResults.get(sessionId); if (result) result.result = "INFECTED";
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
  player.rootedUntil = 0;
  player.assignmentLockEndsAt = 0;
  player.professorCooldownEndsAt = 0;
  player.confusionEndsAt = 0;
  player.philosophyCooldownEndsAt = 0;
  player.trapCastEndsAt = 0;
  player.trapCooldownEndsAt = 0;
  player.rewindCooldownEndsAt = 0;
  player.lastRewindAt = 0;
  player.rewindFromX = 0;
  player.rewindFromY = 0;
  state.engineeringTraps.forEach((trap, id) => { if (trap.ownerSessionId === sessionId) state.engineeringTraps.delete(id); });
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
  return finishIfNoActiveHumans(state);
}
