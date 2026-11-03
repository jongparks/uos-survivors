import Phaser from "phaser";

import { CHARACTER_IDS, PLAYER_ACTIVITY, PLAYER_ROLE, PLAYER_SPEED, isHumanDisguise, type PlayerState } from "@uos-survivors/shared";

import { TEXTURE_KEYS } from "../rendering/createGeneratedTextures";
import { ZOMBIE_DESIGNS, type ZombieDesign } from "../rendering/zombieDesigns";

export class NetworkPlayerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private readonly isLocalPlayer: boolean;
  private stopTimer?: Phaser.Time.TimerEvent;
  private useLeftStep = false;
  private destroyed = false;
  private appliedDesign?: ZombieDesign;
  private worldX: number;
  private worldY: number;
  private gaitPhase = 0;
  private motionWeight = 0;
  private observedAttackAt = 0;
  private attackDirection = { x: 1, y: 0 };

  constructor(scene: Phaser.Scene, player: PlayerState, isLocalPlayer: boolean) {
    this.scene = scene;
    this.isLocalPlayer = isLocalPlayer;
    this.worldX = player.x;
    this.worldY = player.y;

    this.sprite = scene.add.sprite(player.x, player.y, TEXTURE_KEYS.playerIdle).setDepth(10);
    this.label = scene.add
      .text(player.x, player.y - 34, player.nickname, {
        color: isLocalPlayer ? "#dffff0" : "#b9c9ff",
        fontFamily: "monospace",
        fontSize: "11px",
        backgroundColor: "#07110ebf",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(11);
  }

  applyRenderState(player: PlayerState, x: number, y: number): void {
    if (this.destroyed) {
      return;
    }

    // Track world positions separately so visual bob/lunge never creates fake movement.
    const previousX = this.worldX;
    const distance = Math.hypot(x - this.worldX, y - this.worldY);
    const moved = distance > 0.01;
    this.worldX = x;
    this.worldY = y;
    const movedLeft = x < previousX;
    const disguised = isHumanDisguise(player.characterId, player.role, player.isDisguised);
    const design = player.role === PLAYER_ROLE.zombie && !disguised ? ZOMBIE_DESIGNS[player.characterId] : undefined;

    if (design?.textureKey !== this.appliedDesign?.textureKey) {
      this.stopTimer?.remove(false);
      this.appliedDesign = design;
      if (design) {
        this.sprite.setTexture(design.textureKey)
          .setOrigin(design.originX, design.originY)
          .setDisplaySize(design.displayWidth, design.displayHeight);
      } else {
        this.sprite.setTexture(TEXTURE_KEYS.playerIdle).setOrigin(0.5).setScale(1);
      }
    }

    this.sprite.setPosition(x, y);
    this.sprite.setTint(
      design ? 0xffffff : player.role === PLAYER_ROLE.zombie && !disguised
        ? 0xff6f68
        : this.isLocalPlayer
          ? 0xffffff
          : 0x9bb7ff,
    );
    const isHidden = player.activity === PLAYER_ACTIVITY.hidden;
    this.sprite.setAlpha(isHidden ? 0.24 : player.connected ? 1 : 0.42);
    this.label.setPosition(x, y - (design ? 48 : 34));
    this.label.setAlpha(isHidden ? 0.72 : player.connected ? 1 : 0.62);
    const roleLabel = player.role === PLAYER_ROLE.zombie && !disguised
      ? player.characterId === CHARACTER_IDS.normalZombie ? "일반 좀비"
        : player.characterId === CHARACTER_IDS.lateZombie ? "지각생"
          : player.characterId === CHARACTER_IDS.libraryNpc ? "중도 NPC"
          : player.characterId === CHARACTER_IDS.xmanZombie ? "엑스맨"
            : player.characterId === CHARACTER_IDS.graduateZombie ? "대학원생" : "만취생"
      : "인간";
    this.label.setText(
      isHidden
        ? `[은신] ${player.nickname}`
        : player.connected
        ? `[${roleLabel}] ${player.nickname}`
        : `[${roleLabel}] ${player.nickname} · 재접속 중`,
    );

    if (design) {
      if (player.facingX !== 0) this.sprite.setFlipX(player.facingX < 0);
      this.animateMotion(player, x, y, distance, true);
      return;
    }

    this.animateMotion(player, x, y, distance, false);

    if (!moved) {
      return;
    }

    if (x !== previousX) {
      this.sprite.setFlipX(movedLeft);
    }

    this.useLeftStep = !this.useLeftStep;
    this.sprite.setTexture(
      this.useLeftStep ? TEXTURE_KEYS.playerStepLeft : TEXTURE_KEYS.playerStepRight,
    );
    this.stopTimer?.remove(false);
    this.stopTimer = this.scene.time.delayedCall(120, () => {
      this.sprite.stop();
      this.sprite.setTexture(TEXTURE_KEYS.playerIdle);
    });
  }

  private animateMotion(player: PlayerState, x: number, y: number, distance: number, detailed: boolean): void {
    const dt = Math.min(0.05, Math.max(0.001, this.scene.game.loop.delta / 1000));
    const active = player.connected && player.activity !== PLAYER_ACTIVITY.hidden && Date.now() >= player.stunnedUntil;
    const speed = active && distance < 64 ? Math.min(1.6, distance / dt / PLAYER_SPEED) : 0;
    this.motionWeight = Phaser.Math.Linear(this.motionWeight, speed, 1 - Math.exp(-dt * 16));
    this.gaitPhase += Math.min(distance, 12) * 0.16;
    const sway = Math.sin(this.gaitPhase);
    const bob = -Math.abs(Math.sin(this.gaitPhase)) * 1.6 * this.motionWeight;
    if (player.lastBasicAttackAt !== this.observedAttackAt) {
      this.observedAttackAt = player.lastBasicAttackAt;
      const length = Math.hypot(player.facingX, player.facingY) || 1;
      this.attackDirection = { x: player.facingX / length, y: player.facingY / length };
    }
    const age = Date.now() - player.lastBasicAttackAt;
    const attack = active && player.lastBasicAttackAt > 0 && age >= 0 && age < 240
      ? Math.sin(Math.PI * age / 240) : 0;
    const direction = this.attackDirection;
    this.sprite.setPosition(x + direction.x * attack * 5, y + (detailed ? bob : 0) + direction.y * attack * 5);
    this.sprite.setAngle((detailed ? sway * 2.2 * this.motionWeight : 0) + direction.x * attack * 7);
    const width = this.appliedDesign?.displayWidth ?? 36;
    const height = this.appliedDesign?.displayHeight ?? 42;
    this.sprite.setDisplaySize(width * (1 + attack * 0.025), height * (1 - attack * 0.025));
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.stopTimer?.remove(false);
    this.sprite.destroy();
    this.label.destroy();
  }
}

