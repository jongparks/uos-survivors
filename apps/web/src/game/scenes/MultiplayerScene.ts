import { Callbacks, Predict, type InputHandle } from "@colyseus/sdk";
import Phaser from "phaser";

import {
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  TEST_MAP_DATA,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  TILE_INDEX,
  TILE_SIZE,
  applyMovementWithTestMapCollision,
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
  private movementInput?: InputHandle<MovementInput>;
  private predict?: Predict;
  private disposed = false;

  constructor(room: ConnectedGameRoom) {
    super("multiplayer");
    this.room = room;
  }

  create(): void {
    createGeneratedTextures(this);
    this.createMap();
    this.keyboardInput = new KeyboardInput(this);
    this.movementInput = this.room.input({ type: MovementInput, mode: "reliable" });
    this.predict = Predict.get(this.room, {
      mode: "lerp",
      delay: NETWORK_RATE.interpolationDelayMs,
      name: "uos-gameplay",
    });
    this.predict.attachAll("players", {
      mode: "lerp",
      fields: ["x", "y"],
      delay: NETWORK_RATE.interpolationDelayMs,
      snap: TILE_SIZE * 2,
    });

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
      .text(20, 58, "PHASE 3 · PREDICTION · RECONCILIATION · INTERPOLATION", {
        color: "#6f9d89",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  update(time: number): void {
    if (!this.keyboardInput || !this.movementInput || !this.predict) {
      return;
    }

    const inputSteps = this.predict.tick(time);

    for (let step = 0; step < inputSteps; step += 1) {
      const movement = this.keyboardInput.readMovement();
      this.movementInput.data.moveX = movement.moveX as -1 | 0 | 1;
      this.movementInput.data.moveY = movement.moveY as -1 | 0 | 1;
      this.movementInput.send();
    }

    this.renderPlayers();
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
    if (this.disposed || this.playerViews.has(sessionId)) {
      return;
    }

    const view = new NetworkPlayerView(this, player, sessionId === this.room.sessionId);
    this.playerViews.set(sessionId, view);
    if (sessionId === this.room.sessionId) {
      if (!this.predict || !this.movementInput) {
        throw new Error("Prediction was not initialized before the local player");
      }

      this.predict.reconciler(player, {
        input: this.movementInput,
        fields: ["x", "y"],
        smoothMs: NETWORK_RATE.correctionSmoothMs,
        snap: TILE_SIZE * 2,
        step: (context, state, command) => {
          applyMovementWithTestMapCollision(state, command, PLAYER_SPEED, context.dt);
        },
      });
      this.cameras.main.startFollow(view.sprite, true, 0.12, 0.12);
    }
  }

  private renderPlayers(): void {
    if (!this.predict) {
      return;
    }

    this.playerViews.forEach((view, sessionId) => {
      const player = this.room.state.players.get(sessionId);

      if (!player) {
        return;
      }

      view.applyRenderState(
        player,
        this.predict?.value(player, "x") ?? player.x,
        this.predict?.value(player, "y") ?? player.y,
      );
    });
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
    if (this.movementInput) {
      this.movementInput.data.moveX = 0;
      this.movementInput.data.moveY = 0;
      this.movementInput.send();
    }
    this.predict?.dispose();
    this.callbackDisposers.splice(0).forEach((dispose) => dispose());
    this.playerViews.forEach((view) => view.destroy());
    this.playerViews.clear();
  }
}

