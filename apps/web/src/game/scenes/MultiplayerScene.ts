import { Callbacks, Predict, type InputHandle } from "@colyseus/sdk";
import Phaser from "phaser";

import {
  CHARACTER_IDS,
  GRADUATE_TRACKING_MESSAGE,
  GRADUATE_ZOMBIE_CONFIG,
  type GraduateTrackingView,
  FOSSIL_CONFIG,
  FOSSIL_MESSAGES,
  GAME_PHASE,
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  SCULPTURE_STUDENT_CONFIG,
  SPORTS_STUDENT_CONFIG,
  SPRINT_STATE,
  TEST_MAP_DATA,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  TILE_INDEX,
  TILE_SIZE,
  applyMovementWithBarriers,
  LIBRARY_PLACEMENT_FAILED_MESSAGE,
  LATE_ZOMBIE_CONFIG,
  getCharacterSpeedMultiplier,
  getPuddleSpeedMultiplier,
  type FossilHideSpotView,
  type PlayerState,
} from "@uos-survivors/shared";

import type { ConnectedGameRoom } from "../../network/useGameRoom";
import { NetworkDecoyView } from "../entities/NetworkDecoyView";
import { NetworkPlayerView } from "../entities/NetworkPlayerView";
import { KeyboardInput } from "../input/KeyboardInput";
import { createGeneratedTextures, TEXTURE_KEYS } from "../rendering/createGeneratedTextures";
import { ZOMBIE_DESIGNS } from "../rendering/zombieDesigns";

interface FossilHideSpotMarker {
  data: FossilHideSpotView;
  ring: Phaser.GameObjects.Arc;
  dot: Phaser.GameObjects.Arc;
  tween: Phaser.Tweens.Tween;
}

export class MultiplayerScene extends Phaser.Scene {
  private readonly room: ConnectedGameRoom;
  private readonly playerViews = new Map<string, NetworkPlayerView>();
  private readonly decoyViews = new Map<string, NetworkDecoyView>();
  private readonly callbackDisposers: Array<() => void> = [];
  private keyboardInput?: KeyboardInput;
  private movementInput?: InputHandle<MovementInput>;
  private predict?: Predict;
  private matchStatusText?: Phaser.GameObjects.Text;
  private roleStatusText?: Phaser.GameObjects.Text;
  private hidePromptText?: Phaser.GameObjects.Text;
  private readonly fossilHideSpotMarkers = new Map<string, FossilHideSpotMarker>();
  private disposed = false;
  private vomitGraphics?: Phaser.GameObjects.Graphics;
  private trackingGraphics?: Phaser.GameObjects.Graphics;
  private barrierGraphics?: Phaser.GameObjects.Graphics;
  private placementFailedUntil = 0;
  private tracking: GraduateTrackingView = { target: null, trackingEndsAt: 0, cooldownEndsAt: 0 };

  constructor(room: ConnectedGameRoom) {
    super("multiplayer");
    this.room = room;
  }

  preload(): void {
    for (const design of Object.values(ZOMBIE_DESIGNS)) {
      if (design && !this.textures.exists(design.textureKey)) {
        this.load.svg(design.textureKey, design.sourceUrl, { width: design.textureWidth, height: design.textureHeight });
      }
    }
  }

  create(): void {
    for (const design of Object.values(ZOMBIE_DESIGNS)) {
      if (design) this.textures.get(design.textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    createGeneratedTextures(this);
    this.createMap();
    this.vomitGraphics = this.add.graphics().setDepth(7);
    this.trackingGraphics = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.barrierGraphics = this.add.graphics().setDepth(8);
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
    this.predict.attachAll("decoys", {
      mode: "lerp",
      fields: ["x", "y"],
      delay: NETWORK_RATE.interpolationDelayMs,
      snap: TILE_SIZE * 2,
    });

    const callbacks = Callbacks.get(this.room);
    this.callbackDisposers.push(
      this.room.onMessage(LIBRARY_PLACEMENT_FAILED_MESSAGE, () => { this.placementFailedUntil = Date.now() + 1800; }),
      this.room.onMessage<GraduateTrackingView>(GRADUATE_TRACKING_MESSAGE, view => {
        if (!this.disposed) this.tracking = view;
      }),
      callbacks.onAdd("players", (player, sessionId) => {
        this.addPlayer(player, sessionId);
      }),
      callbacks.onRemove("players", (_player, sessionId) => {
        this.removePlayer(sessionId);
      }),
      callbacks.onAdd("decoys", (decoy, decoyId) => {
        if (!this.disposed && !this.decoyViews.has(decoyId)) {
          this.decoyViews.set(decoyId, new NetworkDecoyView(this, decoy));
        }
      }),
      callbacks.onRemove("decoys", (_decoy, decoyId) => {
        this.decoyViews.get(decoyId)?.destroy();
        this.decoyViews.delete(decoyId);
      }),
      this.room.onMessage<FossilHideSpotView[]>(FOSSIL_MESSAGES.hideSpots, (spots) => {
        this.replaceFossilHideSpotMarkers(spots);
      }),
    );
    this.room.send(FOSSIL_MESSAGES.requestHideSpots);

    this.add
      .text(20, 18, `ROOM ${this.room.roomId}  ·  ARROWS MOVE  ·  SHIFT ABILITY  ·  SPACE INTERACT / ATTACK`, {
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
      .text(20, 58, "PHASE 5 · RANDOM HUMAN CHARACTERS", {
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
        const isStunned = (localPlayer?.stunnedUntil ?? 0) > Date.now();
        const actionsLocked = isHidden || isStunned;
        this.movementInput.data.moveX = (actionsLocked ? 0 : controls.moveX) as -1 | 0 | 1;
        this.movementInput.data.moveY = (actionsLocked ? 0 : controls.moveY) as -1 | 0 | 1;
        this.movementInput.data.interact = actionsLocked ? false : controls.interact;
        this.movementInput.data.useSkill = actionsLocked ? false : controls.useSkill;
        this.movementInput.send();
      }
    }

    this.renderPlayers();
    this.renderDecoys();
    this.renderVomit();
    this.renderTracking();
    this.renderBookBarriers();
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
          if (state.dashEndsAt > Date.now()) {
            const remaining = Math.max(0, TILE_SIZE * LATE_ZOMBIE_CONFIG.dashDistanceTiles - Math.hypot(state.x - state.dashStartX, state.y - state.dashStartY));
            const speed = Math.min(TILE_SIZE * LATE_ZOMBIE_CONFIG.dashDistanceTiles / (LATE_ZOMBIE_CONFIG.dashDurationMs / 1000), remaining / context.dt);
            applyMovementWithBarriers(state, { moveX: state.dashDirectionX, moveY: state.dashDirectionY },
              Date.now() < state.stunnedUntil ? 0 : speed, context.dt, state.role, this.room.state.bookBarriers.values(), Date.now());
            return;
          }
          const speedMultiplier = getCharacterSpeedMultiplier(state.characterId, state.role, state.sprintState, state.isDisguised);
          applyMovementWithBarriers(
            state,
            command,
            Date.now() < state.stunnedUntil ? 0 : PLAYER_SPEED * speedMultiplier * getPuddleSpeedMultiplier(this.room.state, state, Date.now()),
            context.dt,
            state.role, this.room.state.bookBarriers.values(), Date.now(),
          );
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
        this.updateCharacterSkillPrompt(player);
      }
    });
  }

  private renderDecoys(): void {
    if (!this.predict) {
      return;
    }
    this.decoyViews.forEach((view, decoyId) => {
      const decoy = this.room.state.decoys.get(decoyId);
      if (decoy) {
        view.applyRenderState(
          this.predict?.value(decoy, "x") ?? decoy.x,
          this.predict?.value(decoy, "y") ?? decoy.y,
        );
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
    const characterLabel =
      player.characterId === CHARACTER_IDS.sportsStudent
        ? "스과생 / SPORTS SCIENCE"
        : player.characterId === CHARACTER_IDS.sculptureStudent
          ? "조각학도 / SCULPTURE"
        : player.characterId === CHARACTER_IDS.fossil
          ? "화석 / FOSSIL"
          : "CHARACTER ASSIGNMENT PENDING";
    const attackLockSeconds = Math.max(0, player.attackLockedUntil - Date.now()) / 1_000;
    const stunSeconds = Math.max(0, player.stunnedUntil - Date.now()) / 1_000;
    const attackCooldownSeconds = Math.max(0, player.nextAttackAt - Date.now()) / 1_000;
    const basicAttackLabel = attackCooldownSeconds > 0
      ? `기본공격 · ${attackCooldownSeconds.toFixed(1)}초`
      : "[SPACE] 기본공격";

    this.matchStatusText?.setText(phaseLabel);
    this.matchStatusText?.setColor(
      this.room.state.phase === GAME_PHASE.finished ? "#ff746c" : "#f0c66b",
    );
    this.roleStatusText?.setText(
      isHidden
        ? `화석 · 은신 중 · ${Math.max(0, player.hideEndsAt - Date.now()) / 1_000 < 0.05 ? "종료 중" : `${(Math.max(0, player.hideEndsAt - Date.now()) / 1_000).toFixed(1)}s`}`
        : !isZombie
        ? `ROLE · HUMAN · ${characterLabel}`
        : this.room.state.phase === GAME_PHASE.finished
          ? "ROLE · ZOMBIE · MATCH OVER"
          : stunSeconds > 0
            ? `ROLE · ZOMBIE · STUNNED ${stunSeconds.toFixed(1)}s`
            : attackLockSeconds > 0
            ? `ROLE · ZOMBIE · ATTACK LOCK ${attackLockSeconds.toFixed(1)}s`
            : player.characterId === CHARACTER_IDS.normalZombie
              ? `ROLE · ZOMBIE · 일반 좀비 · ${basicAttackLabel}`
              : `ROLE · ZOMBIE · ${player.characterId === CHARACTER_IDS.xmanZombie ? "엑스맨" : player.characterId === CHARACTER_IDS.lateZombie ? "지각생" : player.characterId === CHARACTER_IDS.libraryNpc ? "중도 NPC" : player.characterId === CHARACTER_IDS.graduateZombie ? "대학원생" : "만취생"} · ${basicAttackLabel}`,
    );
    this.roleStatusText?.setColor(isZombie ? "#ff8c84" : "#b9c9ff");
  }

  private updateCharacterSkillPrompt(player: PlayerState): void {
    if (player.characterId === CHARACTER_IDS.xmanZombie && this.room.state.phase === GAME_PHASE.playing) {
      const now = Date.now();
      this.hidePromptText?.setText(player.isDisguised ? `위장 중 · 남은 시간 ${(Math.max(0, player.disguiseEndsAt - now) / 1000).toFixed(1)}초  [SHIFT] 해제`
        : player.disguiseCooldownEndsAt > now ? `새터 잠입 · 재사용까지 ${Math.ceil((player.disguiseCooldownEndsAt - now) / 1000)}초`
          : "[SHIFT] 새터 잠입").setVisible(true);
      return;
    }
    if (player.characterId === CHARACTER_IDS.lateZombie && this.room.state.phase === GAME_PHASE.playing) {
      const now = Date.now();
      this.hidePromptText?.setText(player.dashEndsAt > now ? "출석 마감 · 돌진 중"
        : player.dashCooldownEndsAt > now ? `출석 마감 · 재사용까지 ${Math.ceil((player.dashCooldownEndsAt - now) / 1000)}초`
          : "[SHIFT] 출석 마감").setVisible(true);
      return;
    }
    if (player.characterId === CHARACTER_IDS.libraryNpc && this.room.state.phase === GAME_PHASE.playing) {
      const now = Date.now();
      this.hidePromptText?.setText(now < this.placementFailedUntil ? "이 위치에는 설치할 수 없습니다."
        : now < player.barrierCooldownEndsAt ? `자리 맡아놨습니다 · 재사용까지 ${Math.ceil((player.barrierCooldownEndsAt - now) / 1000)}초`
          : "[SHIFT] 자리 맡아놨습니다").setVisible(true);
      return;
    }
    if (player.characterId === CHARACTER_IDS.graduateZombie && this.room.state.phase === GAME_PHASE.playing) {
      const now = Date.now();
      this.hidePromptText?.setText(this.tracking.target && now < this.tracking.trackingEndsAt
        ? `교수님이 찾으신다 · 추적 중 ${((this.tracking.trackingEndsAt - now) / 1000).toFixed(1)}초`
        : now < this.tracking.cooldownEndsAt
          ? `교수님이 찾으신다 · 재사용까지 ${Math.ceil((this.tracking.cooldownEndsAt - now) / 1000)}초`
          : "[SHIFT] 교수님이 찾으신다").setVisible(true);
      return;
    }
    if (player.characterId === CHARACTER_IDS.drunkenZombie && this.room.state.phase === GAME_PHASE.playing) {
      const now = Date.now();
      this.hidePromptText?.setText(player.vomitCastEndsAt > now
        ? "숙취 폭발 준비 중..."
        : player.vomitCooldownEndsAt > now
          ? `숙취 폭발 · 재사용까지 ${Math.ceil((player.vomitCooldownEndsAt - now) / 1000)}초`
          : "[SHIFT] 숙취 폭발").setVisible(true);
      return;
    }
    if (
      player.role !== PLAYER_ROLE.human ||
      this.room.state.phase !== GAME_PHASE.playing
    ) {
      this.hidePromptText?.setVisible(false);
      return;
    }

    if (player.characterId === CHARACTER_IDS.sportsStudent) {
      const now = Date.now();
      const statusText =
        player.sprintState === SPRINT_STATE.sprinting
          ? `전력 질주 중 · ${Math.max(0, player.sprintEndsAt - now) / 1_000 < 0.05 ? "종료 중" : `${(Math.max(0, player.sprintEndsAt - now) / 1_000).toFixed(1)}초`}`
          : player.sprintState === SPRINT_STATE.exhausted
            ? `탈진 상태 · ${(Math.max(0, player.exhaustionEndsAt - now) / 1_000).toFixed(1)}초`
            : player.sprintState === SPRINT_STATE.cooldown
              ? `${SPORTS_STUDENT_CONFIG.skillName} · 재사용까지 ${Math.ceil(Math.max(0, player.cooldownEndsAt - now) / 1_000)}초`
              : `[SHIFT] ${SPORTS_STUDENT_CONFIG.skillName}`;
      this.hidePromptText?.setText(statusText).setVisible(true);
      return;
    }

    if (player.characterId === CHARACTER_IDS.sculptureStudent) {
      const now = Date.now();
      const activeDecoy = player.activeDecoyId
        ? this.room.state.decoys.get(player.activeDecoyId)
        : undefined;
      const statusText = activeDecoy
        ? `${SCULPTURE_STUDENT_CONFIG.skillName} 활동 중 · ${(Math.max(0, activeDecoy.expiresAt - now) / 1_000).toFixed(1)}초`
        : now < player.decoyCooldownEndsAt
          ? `${SCULPTURE_STUDENT_CONFIG.skillName} · 재사용까지 ${Math.ceil((player.decoyCooldownEndsAt - now) / 1_000)}초`
          : `[SHIFT] ${SCULPTURE_STUDENT_CONFIG.skillName}`;
      this.hidePromptText?.setText(statusText).setVisible(true);
      return;
    }

    if (player.characterId !== CHARACTER_IDS.fossil) {
      this.hidePromptText?.setVisible(false);
      return;
    }

    if (player.activity === PLAYER_ACTIVITY.hidden) {
      const remaining = Math.max(0, player.hideEndsAt - Date.now()) / 1_000;
      this.hidePromptText
        ?.setText(`은신 중 · 남은 시간 ${remaining.toFixed(1)}초  [SPACE] 나오기`)
        .setVisible(true);
      return;
    }

    const canHide = Array.from(this.fossilHideSpotMarkers.values()).some(({ data }) =>
      Math.hypot(player.x - data.x, player.y - data.y) <= data.interactionRadius,
    );
    this.hidePromptText?.setText(`[SPACE] ${FOSSIL_CONFIG.skillName}`).setVisible(canHide);
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

  private renderVomit(): void {
    const g = this.vomitGraphics;
    if (!g) return;
    g.clear();
    this.room.state.vomitPuddles.forEach(p => {
      g.fillStyle(0x79a62a, 0.32).fillCircle(p.x, p.y, p.radius);
      g.lineStyle(2, 0xb4d950, 0.65).strokeCircle(p.x, p.y, p.radius);
    });
    this.room.state.vomitProjectiles.forEach(p => {
      g.fillStyle(0xc3ed51, 1).fillCircle(p.x, p.y, 4);
      g.lineStyle(3, 0x82ac29, 0.7).lineBetween(p.x, p.y, p.x - p.directionX * 12, p.y - p.directionY * 12);
    });
    this.room.state.players.forEach(p => {
      if (p.dashEndsAt > Date.now()) {
        for (let i = 3; i >= 1; i--) {
          g.fillStyle(0xffbf80, 0.09 * (4 - i)).fillEllipse(p.x - p.dashDirectionX * i * 10, p.y - p.dashDirectionY * i * 10, 22, 30);
        }
      }
      if (p.vomitCastEndsAt > Date.now()) {
        const radius = 18 + Math.sin(this.time.now / 45) * 3;
        g.lineStyle(3, 0xb4e74d, 0.9).strokeCircle(p.x, p.y, radius);
        g.lineBetween(p.x, p.y, p.x + p.facingX * 32, p.y + p.facingY * 32);
      }
    });
  }

  private renderTracking(): void {
    const g = this.trackingGraphics;
    if (!g) return;
    g.clear();
    const local = this.room.state.players.get(this.room.sessionId);
    const target = this.tracking.target;
    if (!target || local?.characterId !== CHARACTER_IDS.graduateZombie ||
      this.room.state.phase !== GAME_PHASE.playing || Date.now() >= this.tracking.trackingEndsAt) return;
    // Immediately suppress stale private packets when a target leaves visibility.
    const player = this.room.state.players.get(target.id);
    if (!player || player.role !== PLAYER_ROLE.human || player.activity === PLAYER_ACTIVITY.hidden) return;
    const camera = this.cameras.main;
    const x = (target.x - camera.worldView.x) * camera.zoom;
    const y = (target.y - camera.worldView.y) * camera.zoom;
    g.lineStyle(2, 0xf0d45e, 1);
    if (x >= 0 && x <= camera.width && y >= 0 && y <= camera.height) {
      g.strokeRoundedRect(x - 19, y - 25, 38, 50, 8);
      return;
    }
    const radius = GRADUATE_ZOMBIE_CONFIG.offscreenIndicatorDiameterPx / 2;
    const inset = GRADUATE_ZOMBIE_CONFIG.offscreenIndicatorMarginPx + radius;
    const cx = camera.width / 2, cy = camera.height / 2;
    const dx = x - cx, dy = y - cy;
    const scale = Math.min(dx ? (cx - inset) / Math.abs(dx) : Infinity, dy ? (cy - inset) / Math.abs(dy) : Infinity);
    const px = cx + dx * scale, py = cy + dy * scale;
    const angle = Math.atan2(dy, dx), ux = Math.cos(angle), uy = Math.sin(angle);
    g.fillStyle(0x181b12, 0.85).fillCircle(px, py, radius);
    g.strokeCircle(px, py, radius);
    g.lineBetween(px - ux * 6, py - uy * 6, px + ux * 6, py + uy * 6);
    g.lineBetween(px + ux * 6, py + uy * 6, px - uy * 4, py + ux * 4);
    g.lineBetween(px + ux * 6, py + uy * 6, px + uy * 4, py - ux * 4);
  }

  private renderBookBarriers(): void {
    const g = this.barrierGraphics;
    if (!g) return;
    g.clear();
    this.room.state.bookBarriers.forEach(b => {
      const age = Math.min(1, Math.max(0, (Date.now() - b.createdAt) / 180));
      const scale = 0.85 + age * 0.15;
      const left = b.x - b.width * scale / 2, top = b.y - b.height * scale / 2;
      g.fillStyle(0x141713, 0.5).fillRoundedRect(left, top + 5, b.width * scale, b.height * scale, 5);
      const colors = [0x965b45, 0x547d77, 0xc5a25d, 0x5c658d];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const x = left + 3 + col * b.width * scale / 2 + (row % 2 ? 2 : 0);
          const y = top + 3 + row * 13 * scale;
          g.fillStyle(colors[(row + col) % colors.length]!, age).fillRoundedRect(x, y, b.width * scale / 2 - 8, 11 * scale, 2);
          g.lineStyle(2, 0xe4d8ba, age * 0.8).lineBetween(x + 5, y + 7 * scale, x + b.width * scale / 2 - 13, y + 7 * scale);
        }
      }
      g.lineStyle(1, 0xe9c575, age * 0.6).strokeRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
    });
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
      this.movementInput.data.interact = false;
      this.movementInput.data.useSkill = false;
      this.movementInput.send();
    }
    this.predict?.dispose();
    this.vomitGraphics?.destroy();
    this.trackingGraphics?.destroy();
    this.barrierGraphics?.destroy();
    this.callbackDisposers.splice(0).forEach((dispose) => dispose());
    this.playerViews.forEach((view) => view.destroy());
    this.playerViews.clear();
    this.decoyViews.forEach((view) => view.destroy());
    this.decoyViews.clear();
    this.clearFossilHideSpotMarkers();
  }
}

