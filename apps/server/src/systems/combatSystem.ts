import {
  COMBAT_RULES,
  GAME_PHASE,
  PLAYER_ROLE,
  type GameState,
  type PlayerState,
} from "@uos-survivors/shared";

function isInsideAttackCone(attacker: PlayerState, target: PlayerState): boolean {
  const deltaX = target.x - attacker.x;
  const deltaY = target.y - attacker.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance > COMBAT_RULES.zombieAttackRange) {
    return false;
  }

  if (distance === 0) {
    return true;
  }

  const facingMagnitude = Math.hypot(attacker.facingX, attacker.facingY) || 1;
  const directionDot =
    (deltaX / distance) * (attacker.facingX / facingMagnitude) +
    (deltaY / distance) * (attacker.facingY / facingMagnitude);

  return directionDot >= COMBAT_RULES.zombieAttackConeCosine;
}

export function findZombieAttackTarget(
  state: GameState,
  attackerSessionId: string,
): string | null {
  const attacker = state.players.get(attackerSessionId);

  if (!attacker) {
    return null;
  }

  let closestTarget: string | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  state.players.forEach((target, targetSessionId) => {
    if (
      targetSessionId === attackerSessionId ||
      !target.connected ||
      target.role !== PLAYER_ROLE.human ||
      !isInsideAttackCone(attacker, target)
    ) {
      return;
    }

    const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    if (distance < closestDistance) {
      closestTarget = targetSessionId;
      closestDistance = distance;
    }
  });

  return closestTarget;
}

export function resolveZombieAttack(
  state: GameState,
  attackerSessionId: string,
  now: number,
): string | null {
  const attacker = state.players.get(attackerSessionId);

  if (
    state.phase !== GAME_PHASE.playing ||
    !attacker?.connected ||
    attacker.role !== PLAYER_ROLE.zombie ||
    now < attacker.nextAttackAt ||
    now < attacker.attackLockedUntil
  ) {
    return null;
  }

  attacker.nextAttackAt = now + COMBAT_RULES.zombieAttackCooldownMs;
  return findZombieAttackTarget(state, attackerSessionId);
}
