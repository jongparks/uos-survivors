import type { Client, StepContext } from "colyseus";
import { Room } from "colyseus";

import {
  COMBAT_RULES,
  GAME_LIMITS,
  GAME_PHASE,
  GameState,
  MATCH_WINNER,
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_SPAWNS,
  PlayerState,
  PLAYER_ROLE,
  RECONNECTION,
  ROOM_VISIBILITY,
  applyMovementWithTestMapCollision,
  tileToWorld,
  type RoomVisibility,
} from "@uos-survivors/shared";

import { generateRoomCodeCandidate, normalizeNickname } from "../config/playerIdentity.js";
import { resolveZombieAttack } from "../systems/combatSystem.js";
import { finishIfAllHumansInfected, infectHuman } from "../systems/infectionSystem.js";

const INVITE_CODE_CHANNEL = "$uos-survivors-room-codes";

interface RoomOptions {
  nickname?: unknown;
  visibility?: RoomVisibility;
}

export class GameRoom extends Room<{ state: GameState; input: MovementInput }> {
  state = new GameState();
  maxClients = GAME_LIMITS.maxPlayersPerRoom;
  patchRate = 1000 / NETWORK_RATE.stateSyncHz;
  maxMessagesPerSecond = 60;

  inputs = this.defineInput(MovementInput, {
    bufferMaxSize: NETWORK_RATE.inputBufferMaxSize,
    sanitize: {
      moveX: [-1, 1],
      moveY: [-1, 1],
    },
    idle: () => true,
  });

  async onCreate(options: RoomOptions): Promise<void> {
    this.roomId = await this.generateRoomCode();
    this.state.roomCode = this.roomId;
    this.state.isPrivate = options.visibility === ROOM_VISIBILITY.private;
    await this.setPrivate(this.state.isPrivate);
    this.setFixedTimestep((context) => this.simulate(context), NETWORK_RATE.simulationHz);
  }

  onJoin(client: Client, options: RoomOptions): void {
    const player = new PlayerState();
    const spawn = PLAYER_SPAWNS[this.state.players.size % PLAYER_SPAWNS.length] ?? PLAYER_SPAWNS[0];

    player.nickname = normalizeNickname(options.nickname) ?? `생존자${this.state.players.size + 1}`;
    player.connected = true;
    player.role = PLAYER_ROLE.human;
    player.x = tileToWorld(spawn.tileX);
    player.y = tileToWorld(spawn.tileY);
    this.state.players.set(client.sessionId, player);
    this.tryStartMatch();
  }

  onDrop(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = false;
    }

    this.allowReconnection(client, RECONNECTION.windowSeconds);
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = true;
    }
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);

    if (this.state.players.size < COMBAT_RULES.minimumPlayersToStart) {
      this.resetToWaiting();
      return;
    }

    if (
      this.state.phase === GAME_PHASE.playing &&
      !Array.from(this.state.players.values()).some(
        (player) => player.role === PLAYER_ROLE.zombie,
      )
    ) {
      const replacement = this.state.players.entries().next().value;
      if (replacement) {
        const [sessionId, player] = replacement;
        player.role = PLAYER_ROLE.zombie;
        player.attackLockedUntil = 0;
        player.nextAttackAt = 0;
        this.state.initialZombieSessionId = sessionId;
      }
    }

    finishIfAllHumansInfected(this.state);
  }

  async onDispose(): Promise<void> {
    await this.presence.srem(INVITE_CODE_CHANNEL, this.roomId);
  }

  private simulate(context: StepContext): void {
    const now = Date.now();

    this.state.players.forEach((player, sessionId) => {
      const inputChannel = this.inputs.get(sessionId);
      const input = inputChannel.next();

      if (this.state.phase === GAME_PHASE.finished) {
        return;
      }

      if (input.moveX !== 0 || input.moveY !== 0) {
        const magnitude = Math.hypot(input.moveX, input.moveY);
        player.facingX = input.moveX / magnitude;
        player.facingY = input.moveY / magnitude;
      }

      applyMovementWithTestMapCollision(
        player,
        input,
        PLAYER_SPEED,
        context.dt,
      );

      if (input.attack && !inputChannel.wasIdle) {
        const targetSessionId = resolveZombieAttack(this.state, sessionId, now);
        if (targetSessionId && infectHuman(this.state, targetSessionId, now)) {
          finishIfAllHumansInfected(this.state);
        }
      }
    });
  }

  private tryStartMatch(): void {
    if (
      this.state.phase !== GAME_PHASE.waiting ||
      this.state.players.size < COMBAT_RULES.minimumPlayersToStart
    ) {
      return;
    }

    const initialZombie = this.state.players.entries().next().value;
    if (!initialZombie) {
      return;
    }

    const [sessionId, player] = initialZombie;
    player.role = PLAYER_ROLE.zombie;
    player.attackLockedUntil = 0;
    player.nextAttackAt = 0;
    this.state.initialZombieSessionId = sessionId;
    this.state.winner = MATCH_WINNER.none;
    this.state.phase = GAME_PHASE.playing;
  }

  private resetToWaiting(): void {
    this.state.phase = GAME_PHASE.waiting;
    this.state.winner = MATCH_WINNER.none;
    this.state.initialZombieSessionId = "";
    this.state.players.forEach((player) => {
      player.role = PLAYER_ROLE.human;
      player.attackLockedUntil = 0;
      player.nextAttackAt = 0;
    });
  }

  private async generateRoomCode(): Promise<string> {
    const existingCodes = await this.presence.smembers(INVITE_CODE_CHANNEL);
    let code = generateRoomCodeCandidate();

    while (existingCodes.includes(code)) {
      code = generateRoomCodeCandidate();
    }

    await this.presence.sadd(INVITE_CODE_CHANNEL, code);
    return code;
  }
}

