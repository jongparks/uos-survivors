import {
  CHARACTER_IDS,
  GAME_PHASE,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  PLAYER_SPEED,
  SCULPTURE_STUDENT_CONFIG,
  SculptureDecoyState,
  applyMovementWithTestMapCollision,
  type GameState,
  type MovementAxes,
  type PlayerState,
} from "@uos-survivors/shared";

interface RecordedMovement extends MovementAxes {
  recordedAt: number;
}

interface ReplayMovement extends MovementAxes {
  elapsedMs: number;
}

interface DecoyRuntime {
  ownerSessionId: string;
  movements: ReplayMovement[];
}

export class SculptureDecoySystem {
  private readonly movementHistory = new Map<string, RecordedMovement[]>();
  private readonly runtimes = new Map<string, DecoyRuntime>();
  private nextDecoyId = 1;

  recordMovement(
    sessionId: string,
    player: PlayerState,
    input: MovementAxes,
    now: number,
  ): void {
    if (
      player.characterId !== CHARACTER_IDS.sculptureStudent ||
      player.role !== PLAYER_ROLE.human ||
      player.activity !== PLAYER_ACTIVITY.normal
    ) {
      this.movementHistory.delete(sessionId);
      return;
    }

    const cutoff = now - SCULPTURE_STUDENT_CONFIG.movementRecordDurationMs;
    const history = this.movementHistory.get(sessionId) ?? [];
    history.push({ recordedAt: now, moveX: input.moveX, moveY: input.moveY });
    this.movementHistory.set(
      sessionId,
      history.filter((movement) => movement.recordedAt >= cutoff),
    );
  }

  tryActivate(state: GameState, sessionId: string, now: number): string | null {
    const player = state.players.get(sessionId);
    if (
      state.phase !== GAME_PHASE.playing ||
      !player?.connected ||
      player.characterId !== CHARACTER_IDS.sculptureStudent ||
      player.role !== PLAYER_ROLE.human ||
      player.activity !== PLAYER_ACTIVITY.normal ||
      player.activeDecoyId !== "" ||
      now < player.decoyCooldownEndsAt
    ) {
      return null;
    }

    const id = `decoy-${this.nextDecoyId}`;
    this.nextDecoyId += 1;
    const decoy = new SculptureDecoyState();
    decoy.ownerSessionId = sessionId;
    decoy.nickname = player.nickname;
    decoy.x = player.x;
    decoy.y = player.y;
    decoy.createdAt = now;
    decoy.expiresAt = now + SCULPTURE_STUDENT_CONFIG.decoyDurationMs;

    const cutoff = now - SCULPTURE_STUDENT_CONFIG.movementRecordDurationMs;
    const movements: ReplayMovement[] = [{ elapsedMs: 0, moveX: 0, moveY: 0 }];
    for (const movement of (this.movementHistory.get(sessionId) ?? []).filter(
      (recorded) => recorded.recordedAt >= cutoff,
    )) {
      movements.push({
        elapsedMs: Math.max(0, movement.recordedAt - cutoff),
        moveX: movement.moveX,
        moveY: movement.moveY,
      });
    }

    state.decoys.set(id, decoy);
    this.runtimes.set(id, { ownerSessionId: sessionId, movements });
    player.activeDecoyId = id;
    player.decoyCooldownEndsAt = now + SCULPTURE_STUDENT_CONFIG.cooldownMs;
    return id;
  }

  update(state: GameState, now: number, deltaSeconds: number): void {
    for (const [id, runtime] of this.runtimes) {
      const decoy = state.decoys.get(id);
      if (!decoy || now >= decoy.expiresAt) {
        this.removeDecoy(state, id);
        continue;
      }

      const replayTime = Math.max(0, now - decoy.createdAt);
      decoy.currentReplayTimeMs = replayTime;
      let current = runtime.movements[0] ?? { elapsedMs: 0, moveX: 0, moveY: 0 };
      for (const movement of runtime.movements) {
        if (movement.elapsedMs > replayTime) {
          break;
        }
        current = movement;
      }

      applyMovementWithTestMapCollision(
        decoy,
        current,
        PLAYER_SPEED * SCULPTURE_STUDENT_CONFIG.decoySpeedMultiplier,
        deltaSeconds,
      );
    }
  }

  removeDecoy(state: GameState, decoyId: string): boolean {
    const runtime = this.runtimes.get(decoyId);
    const decoy = state.decoys.get(decoyId);
    if (!runtime && !decoy) {
      return false;
    }

    const ownerSessionId = runtime?.ownerSessionId ?? decoy?.ownerSessionId;
    if (ownerSessionId) {
      const owner = state.players.get(ownerSessionId);
      if (owner?.activeDecoyId === decoyId) {
        owner.activeDecoyId = "";
      }
    }
    this.runtimes.delete(decoyId);
    state.decoys.delete(decoyId);
    return true;
  }

  hitDecoy(
    state: GameState,
    decoyId: string,
    attacker: PlayerState,
    now: number,
  ): boolean {
    if (!this.removeDecoy(state, decoyId)) {
      return false;
    }
    attacker.stunnedUntil = now + SCULPTURE_STUDENT_CONFIG.zombieStunDurationMs;
    return true;
  }

  removeOwner(state: GameState, sessionId: string): void {
    const player = state.players.get(sessionId);
    if (player?.activeDecoyId) {
      this.removeDecoy(state, player.activeDecoyId);
    }
    this.movementHistory.delete(sessionId);
  }

  resetPlayer(player: PlayerState): void {
    player.activeDecoyId = "";
    player.decoyCooldownEndsAt = 0;
  }

  clear(state: GameState): void {
    state.decoys.clear();
    this.runtimes.clear();
    this.movementHistory.clear();
    this.nextDecoyId = 1;
  }
}
