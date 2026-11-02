import { Callbacks } from "@colyseus/sdk";
import Phaser from "phaser";

import {
  CLIENT_MESSAGES,
  NETWORK_RATE,
  TEST_MAP_DATA,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  TILE_INDEX,
  TILE_SIZE,
  type PlayerState,
} from "@uos-survivors/shared";

import type { ConnectedGameRoom } from "../../network/useGameRoom";
import { NetworkPlayerView } from "../entities/NetworkPlayerView";
import { KeyboardInput } from "../input/KeyboardInput";
import { createGeneratedTextures, TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

export class MultiplayerScene extends Phaser.Scene {
  private readonly room: ConnectedGameRoom;
  private readonly playerViews = new Map<string, NetworkPlayerView>();
  private readonly callbackDisposers: Array<() => void> = [];
  private keyboardInput?: KeyboardInput;
  private inputAccumulator = 0;
  private disposed = false;

  constructor(room: ConnectedGameRoom) {
    super("multiplayer");
    this.room = room;
  }

  create(): void {
    createGeneratedTextures(this);
    this.createMap();
    this.keyboardInput = new KeyboardInput(this);

    const callbacks = Callbacks.get(this.room);
    this.callbackDisposers.push(
      callbacks.onAdd("players", (player, sessionId) => {
        this.addPlayer(player, sessionId);
      }),
      callbacks.onRemove("players", (_player, sessionId) => {
        this.removePlayer(sessionId);
      }),
    );

    this.add
      .text(20, 18, `ROOM ${this.room.roomId}  ·  WASD MOVE`, {
        color: "#bfffe1",
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        backgroundColor: "#07110ecc",
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(20, 58, "PHASE 2 · SERVER AUTHORITATIVE MULTIPLAYER", {
        color: "#6f9d89",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  update(_time: number, delta: number): void {
    if (!this.keyboardInput) {
      return;
    }

    const inputInterval = 1000 / NETWORK_RATE.simulationHz;
    this.inputAccumulator = Math.min(this.inputAccumulator + delta, inputInterval * 2);

    while (this.inputAccumulator >= inputInterval) {
      this.inputAccumulator -= inputInterval;
      this.room.send(CLIENT_MESSAGES.movement, this.keyboardInput.readMovement());
    }
  }

  private createMap(): void {
    const map = this.make.tilemap({
      data: TEST_MAP_DATA,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(
      TEXTURE_KEYS.map,
      TEXTURE_KEYS.map,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
      TILE_INDEX.floor,
    );

    if (!tileset || !map.createLayer(0, tileset, 0, 0)) {
      throw new Error("Failed to create the multiplayer test map");
    }

    const worldWidth = TEST_MAP_WIDTH * TILE_SIZE;
    const worldHeight = TEST_MAP_HEIGHT * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setRoundPixels(true);
  }

  private addPlayer(player: PlayerState, sessionId: string): void {
    if (this.disposed) {
      return;
    }

    const view = new NetworkPlayerView(this, player, sessionId === this.room.sessionId);
    this.playerViews.set(sessionId, view);
    const callbacks = Callbacks.get(this.room);

    this.callbackDisposers.push(
      callbacks.onChange(player, () => {
        view.applyServerState(player);
      }),
    );

    if (sessionId === this.room.sessionId) {
      this.cameras.main.startFollow(view.sprite, true, 0.12, 0.12);
    }
  }

  private removePlayer(sessionId: string): void {
    this.playerViews.get(sessionId)?.destroy();
    this.playerViews.delete(sessionId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.room.send(CLIENT_MESSAGES.movement, {
      up: false,
      down: false,
      left: false,
      right: false,
    });
    this.callbackDisposers.splice(0).forEach((dispose) => dispose());
    this.playerViews.forEach((view) => view.destroy());
    this.playerViews.clear();
  }
}

