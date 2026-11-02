import Phaser from "phaser";
import type { MovementInput } from "@uos-survivors/shared";

export class KeyboardInput {
  private readonly keys: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) {
      throw new Error("Keyboard input is unavailable");
    }

    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  }

  readMovement(): MovementInput {
    return {
      up: this.keys.up.isDown,
      down: this.keys.down.isDown,
      left: this.keys.left.isDown,
      right: this.keys.right.isDown,
    };
  }
}

