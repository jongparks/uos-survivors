import Phaser from "phaser";
import type { PlayerControls } from "@uos-survivors/shared";

export class KeyboardInput {
  private readonly keys: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private readonly interactKey: Phaser.Input.Keyboard.Key;
  private readonly skillKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) {
      throw new Error("Keyboard input is unavailable");
    }

    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
    this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.skillKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    scene.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    ]);
  }

  readControls(): PlayerControls {
    return {
      moveX: Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      moveY: Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
      interact: this.interactKey.isDown,
      useSkill: this.skillKey.isDown,
    };
  }
}

