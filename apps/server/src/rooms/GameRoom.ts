import type { Client, StepContext } from "colyseus";
import { Room } from "colyseus";

import {
  CLIENT_MESSAGES,
  GAME_LIMITS,
  GameState,
  IDLE_MOVEMENT_INPUT,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_SPAWNS,
  PlayerState,
  moveWithTestMapCollision,
  parseMovementInput,
  tileToWorld,
  type MovementInput,
} from "@uos-survivors/shared";

import { generateRoomCodeCandidate, normalizeNickname } from "../config/playerIdentity.js";

const INVITE_CODE_CHANNEL = "$uos-survivors-room-codes";

interface BufferedInput {
  input: MovementInput;
  receivedAt: number;
}

interface JoinOptions {
  nickname?: unknown;
}

export class GameRoom extends Room<{ state: GameState }> {
  state = new GameState();
  maxClients = GAME_LIMITS.maxPlayersPerRoom;
  patchRate = 1000 / NETWORK_RATE.stateSyncHz;
  maxMessagesPerSecond = 60;

  private readonly playerInputs = new Map<string, BufferedInput>();

  messages = {
    [CLIENT_MESSAGES.movement]: (client: Client, payload: unknown) => {
      const input = parseMovementInput(payload);

      if (!input || !this.state.players.has(client.sessionId)) {
        return;
      }

      this.playerInputs.set(client.sessionId, {
        input,
        receivedAt: Date.now(),
      });
    },
  };

  async onCreate(): Promise<void> {
    this.roomId = await this.generateRoomCode();
    this.state.roomCode = this.roomId;
    this.setFixedTimestep((context) => this.simulate(context), NETWORK_RATE.simulationHz);
  }

  onJoin(client: Client, options: JoinOptions): void {
    const player = new PlayerState();
    const spawn = PLAYER_SPAWNS[this.state.players.size % PLAYER_SPAWNS.length] ?? PLAYER_SPAWNS[0];

    player.nickname = normalizeNickname(options.nickname) ?? `생존자${this.state.players.size + 1}`;
    player.x = tileToWorld(spawn.tileX);
    player.y = tileToWorld(spawn.tileY);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.playerInputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  async onDispose(): Promise<void> {
    await this.presence.srem(INVITE_CODE_CHANNEL, this.roomId);
  }

  private simulate(context: StepContext): void {
    const now = Date.now();

    this.state.players.forEach((player, sessionId) => {
      const buffered = this.playerInputs.get(sessionId);
      const input =
        buffered && now - buffered.receivedAt <= NETWORK_RATE.inputTimeoutMs
          ? buffered.input
          : IDLE_MOVEMENT_INPUT;
      const position = moveWithTestMapCollision(
        { x: player.x, y: player.y },
        input,
        PLAYER_SPEED,
        context.dt,
      );

      player.x = position.x;
      player.y = position.y;
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

