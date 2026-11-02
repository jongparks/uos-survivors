import { Callbacks, Predict, type InputHandle } from "@colyseus/sdk";
import Phaser from "phaser";

import {
  CHARACTER_IDS,
  FOSSIL_CONFIG,
  FOSSIL_MESSAGES,
  GAME_PHASE,
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  TEST_MAP_DATA,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  TILE_INDEX,
  TILE_SIZE,
  applyMovementWithTestMapCollision,
  type FossilHideSpotView,
  type PlayerState,
} from "@uos-survivors/shared";

import type { ConnectedGameRoom } from "../../network/useGameRoom";
import { NetworkPlayerView } from "../entities/NetworkPlayerView";
import { KeyboardInput } from "../input/KeyboardInput";
import { createGeneratedTextures, TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

interface FossilHideSpotMarker {
  data: FossilHideSpotView;
  ring: Phaser.GameObjects.Arc;
  dot: Phaser.GameObjects.Arc;
  tween: Phaser.Tweens.Tween;
}

export class MultiplayerScene extends Phaser.Scene {
  private readonly room: ConnectedGameRoom;
  private readonly playerViews = new Map<string, NetworkPlayerView>();
  private readonly callbackDisposers: Array<() => void> = [];
  private keyboardInput?: KeyboardInput;
  private movementInput?: InputHandle<MovementInput>;
  private predict?: Predict;
  private matchStatusText?: Phaser.GameObjects.Text;
  private roleStatusText?: Phaser.GameObjects.Text;
  private hidePromptText?: Phaser.GameObjects.Text;
  private readonly fossilHideSpotMarkers = new Map<string, FossilHideSpotMarker>();
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
      this.room.onMessage<FossilHideSpotView[]>(FOSSIL_MESSAGES.hideSpots, (spots) => {
        this.replaceFossilHideSpotMarkers(spots);
      }),
    );
    this.room.send(FOSSIL_MESSAGES.requestHideSpots);

    this.add
      .text(20, 18, `ROOM ${this.room.roomId}  ·  WASD MOVE  ·  SPACE ATTACK  ·  E INTERACT`, {
        color: "#bfffe1",
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        backgroundColor: "#07110ecc",
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.matchStatusText = this.add
      .text(20, 80, "WAITING FOR PLAYERS", {
        color: "#f0c66b",
        fontFamily: "monospace",
        fontSize: "11px",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.roleStatusText = this.add
      .text(20, 100, "ROLE · HUMAN", {
        color: "#b9c9ff",
        fontFamily: "monospace",
        fontSize: "11px",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.hidePromptText = this.add
      .text(20, 120, "", {
        color: "#8fffd5",
        fontFamily: "monospace",
        fontSize: "11px",
        fontStyle: "bold",
        backgroundColor: "#07110ecc",
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.add
      .text(20, 58, "PHASE 5 · CHARACTER FOUNDATION · FOSSIL", {
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

    if (this.room.state.phase !== GAME_PHASE.finished) {
      for (let step = 0; step < inputSteps; step += 1) {
        const controls = this.keyboardInput.readControls();
        const localPlayer = this.room.state.players.get(this.room.sessionId);
        const isHidden = localPlayer?.activity === PLAYER_ACTIVITY.hidden;
        this.movementInput.data.moveX = (isHidden ? 0 : controls.moveX) as -1 | 0 | 1;
        this.movementInput.data.moveY = (isHidden ? 0 : controls.moveY) as -1 | 0 | 1;
        this.movementInput.data.attack = isHidden ? false : controls.attack;
        this.movementInput.data.interact = controls.interact;
        this.movementInput.send();
      }
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

      if (sessionId === this.room.sessionId) {
        this.updateLocalHud(player);
        this.updateFossilPrompt(player);
      }
    });
  }

  private updateLocalHud(player: PlayerState): void {
    const phaseLabel =
      this.room.state.phase === GAME_PHASE.waiting
        ? "WAITING · NEED 2 PLAYERS"
        : this.room.state.phase === GAME_PHASE.finished
          ? "MATCH FINISHED · ZOMBIE WIN"
          : "MATCH ACTIVE · INFECTION SPREADING";
    const isZombie = player.role === PLAYER_ROLE.zombie;
    const isHidden = player.activity === PLAYER_ACTIVITY.hidden;
    const attackLockSeconds = Math.max(0, player.attackLockedUntil - Date.now()) / 1_000;

    this.matchStatusText?.setText(phaseLabel);
    this.matchStatusText?.setColor(
      this.room.state.phase === GAME_PHASE.finished ? "#ff746c" : "#f0c66b",
    );
    this.roleStatusText?.setText(
      isHidden
        ? `화석 · 은신 중 · ${Math.max(0, player.hideEndsAt - Date.now()) / 1_000 < 0.05 ? "종료 중" : `${(Math.max(0, player.hideEndsAt - Date.now()) / 1_000).toFixed(1)}s`}`
        : !isZombie
        ? `ROLE · HUMAN · ${player.characterId === CHARACTER_IDS.fossil ? "화석 / FOSSIL" : "SURVIVE"}`
        : this.room.state.phase === GAME_PHASE.finished
          ? "ROLE · ZOMBIE · MATCH OVER"
          : attackLockSeconds > 0
            ? `ROLE · ZOMBIE · ATTACK LOCK ${attackLockSeconds.toFixed(1)}s`
            : "ROLE · ZOMBIE · SPACE TO ATTACK",
    );
    this.roleStatusText?.setColor(isZombie ? "#ff8c84" : "#b9c9ff");
  }

  private updateFossilPrompt(player: PlayerState): void {
    if (
      player.characterId !== CHARACTER_IDS.fossil ||
      player.role !== PLAYER_ROLE.human ||
      this.room.state.phase !== GAME_PHASE.playing
    ) {
      this.hidePromptText?.setVisible(false);
      return;
    }

    if (player.activity === PLAYER_ACTIVITY.hidden) {
      const remaining = Math.max(0, player.hideEndsAt - Date.now()) / 1_000;
      this.hidePromptText
        ?.setText(`은신 중 · 남은 시간 ${remaining.toFixed(1)}초  [E] 나오기`)
        .setVisible(true);
      return;
    }

    const canHide = Array.from(this.fossilHideSpotMarkers.values()).some(({ data }) =>
      Math.hypot(player.x - data.x, player.y - data.y) <= data.interactionRadius,
    );
    this.hidePromptText?.setText(`[E] ${FOSSIL_CONFIG.skillName}`).setVisible(canHide);
  }

  private replaceFossilHideSpotMarkers(spots: FossilHideSpotView[]): void {
    this.clearFossilHideSpotMarkers();
    for (const data of spots) {
      const ring = this.add
        .circle(data.x, data.y, 8, 0x75f2c1, 0.08)
        .setStrokeStyle(1.5, 0x8fffd5, 0.72)
        .setDepth(6);
      const dot = this.add.circle(data.x, data.y, 2, 0xbfffe1, 0.78).setDepth(6);
      const tween = this.tweens.add({
        targets: ring,
        scale: { from: 0.82, to: 1.22 },
        alpha: { from: 0.42, to: 0.8 },
        duration: 1_200,
        yoyo: true,
        repeat: -1,
      });
      this.fossilHideSpotMarkers.set(data.id, { data, ring, dot, tween });
    }
  }

  private clearFossilHideSpotMarkers(): void {
    this.fossilHideSpotMarkers.forEach(({ ring, dot, tween }) => {
      tween.stop();
      ring.destroy();
      dot.destroy();
    });
    this.fossilHideSpotMarkers.clear();
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
      this.movementInput.data.attack = false;
      this.movementInput.data.interact = false;
      this.movementInput.send();
    }
    this.predict?.dispose();
    this.callbackDisposers.splice(0).forEach((dispose) => dispose());
    this.playerViews.forEach((view) => view.destroy());
    this.playerViews.clear();
    this.clearFossilHideSpotMarkers();
  }
}

