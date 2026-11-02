import type { Client, StepContext } from "colyseus";
import { Room } from "colyseus";

import {
  GAME_LIMITS,
  GameState,
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_SPAWNS,
  PlayerState,
  RECONNECTION,
  ROOM_VISIBILITY,
  applyMovementWithTestMapCollision,
  tileToWorld,
  type RoomVisibility,
} from "@uos-survivors/shared";

import { generateRoomCodeCandidate, normalizeNickname } from "../config/playerIdentity.js";

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
    player.x = tileToWorld(spawn.tileX);
    player.y = tileToWorld(spawn.tileY);
    this.state.players.set(client.sessionId, player);
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
  }

  async onDispose(): Promise<void> {
    await this.presence.srem(INVITE_CODE_CHANNEL, this.roomId);
  }

  private simulate(context: StepContext): void {
    this.state.players.forEach((player, sessionId) => {
      const input = this.inputs.get(sessionId).next();

      applyMovementWithTestMapCollision(
        player,
        input,
        PLAYER_SPEED,
        context.dt,
      );
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

