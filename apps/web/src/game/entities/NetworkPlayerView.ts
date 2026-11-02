import Phaser from "phaser";

import type { PlayerState } from "@uos-survivors/shared";

import { TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

export class NetworkPlayerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private stopTimer?: Phaser.Time.TimerEvent;
  private useLeftStep = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, player: PlayerState, isLocalPlayer: boolean) {
    this.scene = scene;

    this.sprite = scene.add.sprite(player.x, player.y, TEXTURE_KEYS.playerIdle).setDepth(10);
    this.sprite.setTint(isLocalPlayer ? 0xffffff : 0x9bb7ff);
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

  applyServerState(player: PlayerState): void {
    if (this.destroyed) {
      return;
    }

    const previousX = this.sprite.x;
    const moved = previousX !== player.x || this.sprite.y !== player.y;
    const movedLeft = player.x < previousX;

    this.sprite.setPosition(player.x, player.y);
    this.label.setPosition(player.x, player.y - 34);
    this.label.setText(player.nickname);

    if (!moved) {
      return;
    }

    if (player.x !== previousX) {
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

