import Phaser from "phaser";

import { CHARACTER_IDS, PLAYER_ACTIVITY, PLAYER_ROLE, type PlayerState } from "@uos-survivors/shared";

import { TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

export class NetworkPlayerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private readonly isLocalPlayer: boolean;
  private stopTimer?: Phaser.Time.TimerEvent;
  private useLeftStep = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, player: PlayerState, isLocalPlayer: boolean) {
    this.scene = scene;
    this.isLocalPlayer = isLocalPlayer;

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

    const previousX = this.sprite.x;
    const moved = previousX !== x || this.sprite.y !== y;
    const movedLeft = x < previousX;

    this.sprite.setPosition(x, y);
    this.sprite.setTint(
      player.role === PLAYER_ROLE.zombie
        ? 0xff6f68
        : this.isLocalPlayer
          ? 0xffffff
          : 0x9bb7ff,
    );
    const isHidden = player.activity === PLAYER_ACTIVITY.hidden;
    this.sprite.setAlpha(isHidden ? 0.24 : player.connected ? 1 : 0.42);
    this.label.setPosition(x, y - 34);
    this.label.setAlpha(isHidden ? 0.72 : player.connected ? 1 : 0.62);
    const roleLabel = player.role === PLAYER_ROLE.zombie
      ? player.characterId === CHARACTER_IDS.normalZombie ? "일반 좀비" : "만취생"
      : "인간";
    this.label.setText(
      isHidden
        ? `[은신] ${player.nickname}`
        : player.connected
        ? `[${roleLabel}] ${player.nickname}`
        : `[${roleLabel}] ${player.nickname} · 재접속 중`,
    );

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

