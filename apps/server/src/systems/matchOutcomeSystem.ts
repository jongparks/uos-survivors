import { GAME_PHASE, MATCH_WINNER, PERSONAL_RESULT, PLAYER_ROLE, type GameState } from "@uos-survivors/shared";

export function finishMatch(state: GameState): void {
  state.phase = GAME_PHASE.finished; state.roundStage = "FINISHED";
  state.winner = state.escapedCount > 0 ? MATCH_WINNER.human : MATCH_WINNER.zombie;
  state.gates.forEach(gate => { gate.status = "CLOSED"; });
  state.players.forEach(p => {
    p.escapeStartedAt = 0; p.escapingGateId = "";
    if (p.role === PLAYER_ROLE.human && !p.escaped) p.personalResult = PERSONAL_RESULT.failed;
  });
  state.roundResults.forEach(result => { if (result.startedAsHuman && !result.result) result.result = PERSONAL_RESULT.failed; });
}
export function finishIfNoActiveHumans(state: GameState): boolean {
  if (state.phase !== GAME_PHASE.playing || [...state.players.values()].some(p => p.role === PLAYER_ROLE.human && !p.escaped)) return false;
  finishMatch(state); return true;
}
