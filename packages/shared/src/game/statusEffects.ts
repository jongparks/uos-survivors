import { PLAYER_ROLE } from "./rules.js";
import { DRUNKEN_ZOMBIE_CONFIG } from "./characters.js";
import type { GameState, PlayerState } from "../state/gameState.js";

export function getPuddleSpeedMultiplier(state: GameState, player: PlayerState, now: number): number {
  if (player.role !== PLAYER_ROLE.human) return 1;
  for (const puddle of state.vomitPuddles.values()) {
    if (now < puddle.expiresAt && Math.hypot(player.x - puddle.x, player.y - puddle.y) <= puddle.radius) {
      return DRUNKEN_ZOMBIE_CONFIG.puddleSpeedMultiplier;
    }
  }
  return 1;
}
