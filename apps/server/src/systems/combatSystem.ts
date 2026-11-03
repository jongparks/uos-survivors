import {
  COMBAT_RULES,
  GAME_PHASE,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  type GameState,
  type PlayerState,
} from "@uos-survivors/shared";

export interface CombatTarget {
  type: "human" | "decoy";
  id: string;
}

interface TargetPosition {
  x: number;
  y: number;
}

function isInsideAttackCone(attacker: PlayerState, target: TargetPosition): boolean {
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
): CombatTarget | null {
  const attacker = state.players.get(attackerSessionId);

  if (!attacker) {
    return null;
  }

  let closestTarget: CombatTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  state.players.forEach((target, targetSessionId) => {
    if (
      targetSessionId === attackerSessionId ||
      !target.connected ||
      target.role !== PLAYER_ROLE.human ||
      target.activity === PLAYER_ACTIVITY.hidden ||
      !isInsideAttackCone(attacker, target)
    ) {
      return;
    }

    const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    if (distance < closestDistance) {
      closestTarget = { type: "human", id: targetSessionId };
      closestDistance = distance;
    }
  });

  state.decoys.forEach((decoy, decoyId) => {
    if (!isInsideAttackCone(attacker, decoy)) {
      return;
    }
    const distance = Math.hypot(decoy.x - attacker.x, decoy.y - attacker.y);
    if (distance < closestDistance) {
      closestTarget = { type: "decoy", id: decoyId };
      closestDistance = distance;
    }
  });

  return closestTarget;
}

export function resolveZombieAttack(
  state: GameState,
  attackerSessionId: string,
  now: number,
): CombatTarget | null {
  const attacker = state.players.get(attackerSessionId);

  if (
    state.phase !== GAME_PHASE.playing ||
    !attacker?.connected ||
    attacker.role !== PLAYER_ROLE.zombie ||
    now < attacker.nextAttackAt ||
    now < attacker.attackLockedUntil ||
    now < attacker.stunnedUntil
  ) {
    return null;
  }

  attacker.nextAttackAt = now + COMBAT_RULES.zombieAttackCooldownMs;
  attacker.lastBasicAttackAt = now;
  return findZombieAttackTarget(state, attackerSessionId);
}
