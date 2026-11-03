import {
  CAMPUS_MATCH_RULES as C, EscapeGateState, GAME_PHASE, MATCH_WINNER, PERSONAL_RESULT, PLAYER_ACTIVITY, PLAYER_ROLE,
  getGameMap, type GameState, type PlayerState,
} from "@uos-survivors/shared";
import { finishMatch, finishIfNoActiveHumans } from "./matchOutcomeSystem.js";

export class MatchTimerGateSystem {
  private readonly selectedGates = new Set<string>();
  private readonly channels = new Map<string, { gateId: string; x: number; y: number; startedAt: number }>();
  initializeGates(state: GameState): void {
    state.gates.clear();
    for (const gate of getGameMap(state.mapId).gates) {
      const entry = new EscapeGateState(); Object.assign(entry, { name: gate.name, x: gate.x, y: gate.y, interactionRadius: gate.interactionRadius, status: "LOCKED" });
      state.gates.set(gate.id, entry);
    }
  }
  start(state: GameState, now: number, random: () => number = Math.random): void {
    this.reset(state); this.initializeGates(state);
    state.matchStartedAt = now; state.matchEndsAt = now + C.durationMs; state.exitsOpenAt = now + C.exitsOpenAfterMs;
    state.roundStage = "SURVIVAL"; state.escapedCount = 0;
    const ids = [...state.gates.keys()];
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j]!, ids[i]!]; }
    ids.slice(0, C.openGateCount).forEach(id => this.selectedGates.add(id));
  }
  update(state: GameState, now: number): void {
    if (state.phase !== GAME_PHASE.playing) { this.channels.clear(); if (state.phase === GAME_PHASE.finished) state.gates.forEach(g => { g.status = "CLOSED"; }); return; }
    if (state.matchEndsAt && now >= state.matchEndsAt) { finishMatch(state); this.channels.clear(); return; }
    if (state.matchEndsAt) {
      state.exitWarning = now >= state.matchStartedAt + C.warningAfterMs;
      if (now >= state.exitsOpenAt) {
        state.roundStage = "ESCAPE";
        state.gates.forEach((gate, id) => { gate.status = this.selectedGates.has(id) ? "OPEN" : "LOCKED"; });
      }
    }
    for (const [id, channel] of this.channels) {
      const p = state.players.get(id);
      if (!p || !p.connected || p.role !== PLAYER_ROLE.human || p.escaped || p.activity !== PLAYER_ACTIVITY.normal ||
        now < p.stunnedUntil || now < p.assignmentLockEndsAt || p.x !== channel.x || p.y !== channel.y) this.cancel(id, p);
    }
    finishIfNoActiveHumans(state);
  }
  nearbyOpenGate(state: GameState, p: PlayerState): string | undefined {
    return [...state.gates.entries()].find(([, gate]) => gate.status === "OPEN" && Math.hypot(p.x - gate.x, p.y - gate.y) <= gate.interactionRadius)?.[0];
  }
  interact(state: GameState, id: string, held: boolean, now: number): boolean {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || !state.matchEndsAt || now >= state.matchEndsAt ||
      p.role !== PLAYER_ROLE.human || p.escaped || !p.connected || p.activity !== PLAYER_ACTIVITY.normal ||
      now < p.stunnedUntil || now < p.assignmentLockEndsAt || !held) { this.cancel(id, p); return false; }
    const gateId = this.nearbyOpenGate(state, p);
    if (!gateId) { this.cancel(id, p); return false; }
    let channel = this.channels.get(id);
    if (channel && (channel.gateId !== gateId || channel.x !== p.x || channel.y !== p.y)) { this.cancel(id, p); return false; }
    if (!channel) { channel = { gateId, x: p.x, y: p.y, startedAt: now }; this.channels.set(id, channel); p.escapeStartedAt = now; p.escapingGateId = gateId; }
    if (now - channel.startedAt < C.escapeHoldMs) return false;
    p.escaped = true; p.personalResult = PERSONAL_RESULT.escaped; state.escapedCount++;
    const result = state.roundResults.get(id); if (result) result.result = PERSONAL_RESULT.escaped;
    state.winner = MATCH_WINNER.human; this.cancel(id, p); finishIfNoActiveHumans(state); return true;
  }
  cancel(id: string, p?: PlayerState): void {
    this.channels.delete(id); if (p) { p.escapeStartedAt = 0; p.escapingGateId = ""; }
  }
  reset(state: GameState): void {
    this.channels.clear(); this.selectedGates.clear(); state.exitWarning = false; state.matchEndsAt = 0; state.exitsOpenAt = 0; state.escapedCount = 0; state.roundStage = "WAITING";
    state.players.forEach(p => { p.escaped = false; p.personalResult = ""; p.escapeStartedAt = 0; p.escapingGateId = ""; });
  }
}
