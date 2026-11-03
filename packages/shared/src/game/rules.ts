export const GAME_PHASE = {
  waiting: "waiting",
  playing: "playing",
  finished: "finished",
} as const;
export type GamePhase = (typeof GAME_PHASE)[keyof typeof GAME_PHASE];

export const PLAYER_ROLE = {
  human: "human",
  zombie: "zombie",
} as const;
export type PlayerRole = (typeof PLAYER_ROLE)[keyof typeof PLAYER_ROLE];

export const MATCH_WINNER = {
  none: "none",
  human: "human",
  zombie: "zombie",
} as const;
export type MatchWinner = (typeof MATCH_WINNER)[keyof typeof MATCH_WINNER];

export const COMBAT_RULES = {
  minimumPlayersToStart: 4,
  zombieAttackRange: 68,
  zombieAttackConeCosine: 0.35,
  // Basic attack resolves once immediately; no windup or movement recovery lock.
  zombieAttackCooldownMs: 2_000,
  infectionAttackLockMs: 1_500,
} as const;
