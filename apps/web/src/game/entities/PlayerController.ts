import Phaser from "phaser";

import { PLAYER_BODY_SIZE, PLAYER_SPEED } from "../config/gameplay";
import type { MovementInput } from "../movement/calculateVelocity";
import { calculateVelocity } from "../movement/calculateVelocity";
import { TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

const WALK_ANIMATION = "survivor-walk";

export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.createAnimation(scene);

    this.sprite = scene.physics.add.sprite(x, y, TEXTURE_KEYS.playerIdle);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);

    this.sprite.setBodySize(PLAYER_BODY_SIZE, PLAYER_BODY_SIZE, false);
    this.sprite.setOffset(
      (this.sprite.width - PLAYER_BODY_SIZE) / 2,
      this.sprite.height - PLAYER_BODY_SIZE,
    );
  }

  update(input: MovementInput): void {
    const velocity = calculateVelocity(input, PLAYER_SPEED);
    this.sprite.setVelocity(velocity.x, velocity.y);

    const isMoving = velocity.x !== 0 || velocity.y !== 0;

    if (isMoving) {
      this.sprite.play(WALK_ANIMATION, true);
    } else {
      this.sprite.stop();
      this.sprite.setTexture(TEXTURE_KEYS.playerIdle);
    }

    if (velocity.x !== 0) {
      this.sprite.setFlipX(velocity.x < 0);
    }
  }

  private createAnimation(scene: Phaser.Scene): void {
    if (scene.anims.exists(WALK_ANIMATION)) {
      return;
    }

    scene.anims.create({
      key: WALK_ANIMATION,
      frames: [
        { key: TEXTURE_KEYS.playerStepLeft },
        { key: TEXTURE_KEYS.playerIdle },
        { key: TEXTURE_KEYS.playerStepRight },
        { key: TEXTURE_KEYS.playerIdle },
      ],
      frameRate: 9,
      repeat: -1,
    });
  }
}

