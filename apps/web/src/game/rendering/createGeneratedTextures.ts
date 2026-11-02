import Phaser from "phaser";

import { TILE_SIZE } from "../config/gameplay";

export const TEXTURE_KEYS = {
  map: "test-map-tiles",
  playerIdle: "survivor-idle",
  playerStepLeft: "survivor-step-left",
  playerStepRight: "survivor-step-right",
} as const;

function createMapTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.map)) {
    return;
  }

  const graphics = scene.add.graphics().setVisible(false);

  graphics.fillStyle(0x10251d, 1);
  graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  graphics.lineStyle(1, 0x183b2d, 0.65);
  graphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

  graphics.fillStyle(0x243e34, 1);
  graphics.fillRect(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
  graphics.fillStyle(0x315848, 1);
  graphics.fillRect(TILE_SIZE + 4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
  graphics.lineStyle(2, 0x4b7b65, 0.7);
  graphics.strokeRect(TILE_SIZE + 4, 4, TILE_SIZE - 8, TILE_SIZE - 8);

  graphics.generateTexture(TEXTURE_KEYS.map, TILE_SIZE * 2, TILE_SIZE);
  graphics.destroy();
}

function createPlayerTexture(scene: Phaser.Scene, key: string, step: -1 | 0 | 1): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.add.graphics().setVisible(false);
  graphics.fillStyle(0x08110d, 0.55);
  graphics.fillEllipse(18, 36, 26, 9);

  graphics.fillStyle(0xcfffe2, 1);
  graphics.fillCircle(18, 10, 7);
  graphics.fillStyle(0x51e39b, 1);
  graphics.fillRoundedRect(9, 16, 18, 15, 5);
  graphics.fillStyle(0x1a533c, 1);
  graphics.fillRect(11 + step * 2, 29, 5, 9);
  graphics.fillRect(21 - step * 2, 29, 5, 9);
  graphics.fillStyle(0xf4fff8, 1);
  graphics.fillCircle(20, 9, 1.5);

  graphics.generateTexture(key, 36, 42);
  graphics.destroy();
}

export function createGeneratedTextures(scene: Phaser.Scene): void {
  createMapTexture(scene);
  createPlayerTexture(scene, TEXTURE_KEYS.playerIdle, 0);
  createPlayerTexture(scene, TEXTURE_KEYS.playerStepLeft, -1);
  createPlayerTexture(scene, TEXTURE_KEYS.playerStepRight, 1);
}

