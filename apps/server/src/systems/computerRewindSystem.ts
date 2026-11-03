import {
  CHARACTER_IDS, COMPUTER_STUDENT_CONFIG as C, GAME_PHASE, PLAYER_ACTIVITY, PLAYER_ROLE,
  PLAYER_BODY_SIZE, collidesWithTestMap, bodyOverlapsBarrier, overlapsRectangle,
  type GameState, type Position, type PlayerState,
} from "@uos-survivors/shared";

export interface PositionSnapshot extends Position { timestamp: number }
class SnapshotRing {
  private readonly slots: Array<PositionSnapshot | undefined> = Array.from({ length: 80 });
  private write = 0;
  private count = 0;
  push(value: PositionSnapshot): void {
    this.slots[this.write] = value; this.write = (this.write + 1) % this.slots.length;
    this.count = Math.min(this.slots.length, this.count + 1);
  }
  values(): PositionSnapshot[] {
    return Array.from({ length: this.count }, (_, i) => this.slots[(this.write - this.count + i + this.slots.length) % this.slots.length]!);
  }
  pruneBefore(timestamp: number): void {
    while (this.count && this.slots[(this.write - this.count + this.slots.length) % this.slots.length]!.timestamp < timestamp) this.count--;
  }
}
interface History { ring: SnapshotRing; last: PositionSnapshot; nextSample: number }

function lerp(a: PositionSnapshot, b: PositionSnapshot, timestamp: number): PositionSnapshot {
  const t = b.timestamp === a.timestamp ? 1 : (timestamp - a.timestamp) / (b.timestamp - a.timestamp);
  return { timestamp, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function findValidRewindPosition(history: readonly PositionSnapshot[], targetTime: number, valid: (p: Position) => boolean): Position | null {
  let before: PositionSnapshot | undefined, after: PositionSnapshot | undefined;
  for (const sample of history) {
    if (sample.timestamp <= targetTime) before = sample;
    else { after = sample; break; }
  }
  if (!before || (!after && before.timestamp !== targetTime)) return null;
  let previous = after ? lerp(before, after, targetTime) : before;
  if (valid(previous)) return { x: previous.x, y: previous.y };
  for (const sample of history) {
    if (sample.timestamp <= targetTime) continue;
    // A zero-time discontinuity is a prior teleport, not a traversed segment.
    const steps = sample.timestamp === previous.timestamp ? 1 : Math.max(1, Math.ceil(Math.hypot(sample.x - previous.x, sample.y - previous.y)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const candidate = { x: previous.x + (sample.x - previous.x) * t, y: previous.y + (sample.y - previous.y) * t };
      if (valid(candidate)) return candidate;
    }
    previous = sample;
  }
  return null;
}

export class ComputerRewindSystem {
  private readonly histories = new Map<string, History>();
  record(state: GameState, id: string, now: number): void {
    const p = state.players.get(id);
    if (!p || state.phase !== GAME_PHASE.playing || p.role !== PLAYER_ROLE.human || p.characterId !== CHARACTER_IDS.computerStudent) { this.histories.delete(id); return; }
    const current = { timestamp: now, x: p.x, y: p.y };
    let history = this.histories.get(id);
    if (!history) {
      const ring = new SnapshotRing(); ring.push(current);
      history = { ring, last: current, nextSample: now + C.sampleIntervalMs }; this.histories.set(id, history); return;
    }
    // Resample authoritative observations at 50ms, retaining only the recent window.
    history.nextSample = Math.max(history.nextSample, now - C.historyDurationMs);
    while (history.nextSample <= now) {
      history.ring.push(lerp(history.last, current, history.nextSample)); history.nextSample += C.sampleIntervalMs;
    }
    history.last = current;
    history.ring.pruneBefore(now - C.historyDurationMs);
  }

  tryActivate(state: GameState, id: string, now: number): boolean {
    const p = state.players.get(id), history = this.histories.get(id);
    if (!p || !history || state.phase !== GAME_PHASE.playing || p.role !== PLAYER_ROLE.human ||
      p.characterId !== CHARACTER_IDS.computerStudent || !p.connected || p.activity !== PLAYER_ACTIVITY.normal ||
      now < p.stunnedUntil || now < p.rewindCooldownEndsAt || p.trapCastEndsAt > now || p.dashEndsAt > now || p.vomitCastEndsAt > now) return false;
    const snapshots = [...history.ring.values(), { timestamp: now, x: p.x, y: p.y }];
    const target = findValidRewindPosition(snapshots, now - C.rewindMs, point => this.valid(state, id, point, now));
    if (!target) return false;
    const departure = { timestamp: now, x: p.x, y: p.y };
    p.rewindFromX = p.x; p.rewindFromY = p.y; p.lastRewindAt = now;
    p.x = target.x; p.y = target.y; p.rewindCooldownEndsAt = now + C.cooldownMs;
    // Preserve the discontinuity instead of inventing a path across the teleport.
    history.ring.push(departure); history.ring.push({ timestamp: now, ...target });
    history.last = { timestamp: now, ...target };
    return true;
  }

  private valid(state: GameState, id: string, p: Position, now: number): boolean {
    if (collidesWithTestMap(p.x, p.y)) return false;
    for (const barrier of state.bookBarriers.values()) if (now < barrier.expiresAt && bodyOverlapsBarrier(p, barrier)) return false;
    for (const [otherId, other] of state.players) {
      if (id !== otherId && overlapsRectangle({ ...p, width: PLAYER_BODY_SIZE, height: PLAYER_BODY_SIZE }, { x: other.x, y: other.y, width: PLAYER_BODY_SIZE, height: PLAYER_BODY_SIZE })) return false;
    }
    return true;
  }
  remove(id: string): void { this.histories.delete(id); }
  clear(state: GameState): void { this.histories.clear(); state.players.forEach(resetComputerRewind); }
}

export function resetComputerRewind(p: PlayerState): void {
  p.rewindCooldownEndsAt = 0; p.lastRewindAt = 0; p.rewindFromX = 0; p.rewindFromY = 0;
}
