import Phaser from "phaser";

import type { SculptureDecoyState } from "@uos-survivors/shared";

import { TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

export class NetworkDecoyView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private stopTimer?: Phaser.Time.TimerEvent;
  private useLeftStep = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, decoy: SculptureDecoyState) {
    this.scene = scene;
    this.sprite = scene.add
      .sprite(decoy.x, decoy.y, TEXTURE_KEYS.playerIdle)
      .setTint(0xc4bdae)
      .setDepth(10);
    this.label = scene.add
      .text(decoy.x, decoy.y - 26, decoy.nickname, {
        color: "#c9c2b5",
        fontFamily: "monospace",
        fontSize: "11px",
        backgroundColor: "#10161990",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setAlpha(.83)
      .setDepth(9);
  }

  applyRenderState(x: number, y: number): void {
    if (this.destroyed) {
      return;
    }
    const previousX = this.sprite.x;
    const moved = previousX !== x || this.sprite.y !== y;
    this.sprite.setPosition(x, y);
    this.label.setPosition(x, y - 26);
    if (!moved) {
      return;
    }
    if (x !== previousX) {
      this.sprite.setFlipX(x < previousX);
    }
    this.useLeftStep = !this.useLeftStep;
    this.sprite.setTexture(
      this.useLeftStep ? TEXTURE_KEYS.playerStepLeft : TEXTURE_KEYS.playerStepRight,
    );
    this.stopTimer?.remove(false);
    this.stopTimer = this.scene.time.delayedCall(120, () => {
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
