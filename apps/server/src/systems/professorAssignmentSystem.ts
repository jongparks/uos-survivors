import {
  getGameMap,
  ASSIGNMENT_DIRECTIONS, CHARACTER_IDS, GAME_PHASE, PLAYER_ACTIVITY, PLAYER_ROLE, PROFESSOR_CONFIG as C, type AssignmentChallengeView, type AssignmentDirection, type GameState,
} from "@uos-survivors/shared";

interface Challenge extends AssignmentChallengeView { casterId: string; targetId: string }
type Send = (targetId: string, view: AssignmentChallengeView) => void;
export class ProfessorAssignmentSystem {
  private serial = 0;
  private readonly challenges = new Map<string, Challenge>();
  constructor(private readonly random: () => number = Math.random) {}
  private view(challenge: Challenge, event: AssignmentChallengeView["event"]): AssignmentChallengeView {
    return { id: challenge.id, sequence: [...challenge.sequence], progressIndex: challenge.progressIndex, expiresAt: challenge.expiresAt, event };
  }
  sync(targetId: string, send: Send): void {
    const challenge = this.challenges.get(targetId);
    if (challenge) send(targetId, this.view(challenge, "started"));
    else send(targetId, { id: "", sequence: [], progressIndex: 0, expiresAt: 0, event: "cancelled" });
  }
  tryActivate(state: GameState, id: string, now: number, send: Send): boolean {
    this.update(state, now, send);
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.characterId !== CHARACTER_IDS.professor || p.role !== PLAYER_ROLE.zombie ||
      !p.connected || p.activity !== PLAYER_ACTIVITY.normal || now < p.stunnedUntil || now < p.professorCooldownEndsAt) return false;
    let targetId = "", best = (C.rangeTiles * getGameMap(state.mapId).tileSize) ** 2;
    for (const [candidateId, candidate] of [...state.players.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (candidate.role !== PLAYER_ROLE.human || candidate.escaped || !candidate.connected || candidate.activity !== PLAYER_ACTIVITY.normal ||
        now < candidate.assignmentLockEndsAt || this.challenges.has(candidateId)) continue;
      const distance = (candidate.x - p.x) ** 2 + (candidate.y - p.y) ** 2;
      if (distance <= best && (!targetId || distance < best)) { best = distance; targetId = candidateId; }
    }
    if (!targetId) return false;
    const length = C.minSequenceLength + Math.floor(this.random() * (C.maxSequenceLength - C.minSequenceLength + 1));
    const challenge: Challenge = { id: `assignment-${++this.serial}`, casterId: id, targetId,
      sequence: Array.from({ length }, () => ASSIGNMENT_DIRECTIONS[Math.floor(this.random() * ASSIGNMENT_DIRECTIONS.length)]!),
      progressIndex: 0, expiresAt: now + C.durationMs, event: "started" };
    this.challenges.set(targetId, challenge);
    state.players.get(targetId)!.assignmentLockEndsAt = challenge.expiresAt;
    p.attackLockedUntil = Math.max(p.attackLockedUntil, now + C.attackLockMs);
    p.professorCooldownEndsAt = now + C.cooldownMs;
    send(targetId, this.view(challenge, "started")); return true;
  }
  input(state: GameState, targetId: string, payload: unknown, now: number, send: Send): void {
    this.update(state, now, send);
    const challenge = this.challenges.get(targetId);
    if (!challenge || !payload || typeof payload !== "object") return;
    const { id, direction } = payload as { id?: unknown; direction?: unknown };
    if (id !== challenge.id || !ASSIGNMENT_DIRECTIONS.includes(direction as AssignmentDirection)) return;
    if (direction !== challenge.sequence[challenge.progressIndex]) {
      challenge.progressIndex = 0; send(targetId, this.view(challenge, "failed")); return;
    }
    challenge.progressIndex++;
    if (challenge.progressIndex === challenge.sequence.length) this.release(state, targetId, "completed", send);
    else send(targetId, this.view(challenge, "progress"));
  }
  update(state: GameState, now: number, send: Send): void {
    for (const [id, challenge] of this.challenges) {
      const target = state.players.get(id), caster = state.players.get(challenge.casterId);
      if (state.phase !== GAME_PHASE.playing || !target?.connected || target.role !== PLAYER_ROLE.human || target.escaped || !caster?.connected || caster.role !== PLAYER_ROLE.zombie) {
        this.release(state, id, "cancelled", send);
      } else if (now >= challenge.expiresAt) this.release(state, id, "expired", send);
    }
  }
  private release(state: GameState, id: string, event: AssignmentChallengeView["event"], send: Send): void {
    const challenge = this.challenges.get(id); if (!challenge) return;
    this.challenges.delete(id);
    const target = state.players.get(id); if (target) target.assignmentLockEndsAt = 0;
    send(id, this.view(challenge, event));
  }
  clear(state: GameState, send: Send): void {
    for (const id of this.challenges.keys()) this.release(state, id, "cancelled", send);
    state.players.forEach(p => { p.assignmentLockEndsAt = 0; p.professorCooldownEndsAt = 0; });
  }
}
