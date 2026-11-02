import Phaser from "phaser";

import {
  PLAYER_SPAWN,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  TILE_INDEX,
  TILE_SIZE,
} from "../config/gameplay";
import { PlayerController } from "../entities/PlayerController";
import { KeyboardInput } from "../input/KeyboardInput";
import { TEST_MAP_DATA } from "../maps/testMap";
import { createGeneratedTextures, TEXTURE_KEYS } from "../rendering/createGeneratedTextures";

export class MovementScene extends Phaser.Scene {
  private keyboardInput?: KeyboardInput;
  private player?: PlayerController;

  constructor() {
    super("movement");
  }

  create(): void {
    createGeneratedTextures(this);

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

    if (!tileset) {
      throw new Error("Failed to create the test map tileset");
    }

    const collisionLayer = map.createLayer(0, tileset, 0, 0);

    if (!collisionLayer) {
      throw new Error("Failed to create the test map layer");
    }

    collisionLayer.setCollision(TILE_INDEX.wall);

    const worldWidth = TEST_MAP_WIDTH * TILE_SIZE;
    const worldHeight = TEST_MAP_HEIGHT * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const spawnX = (PLAYER_SPAWN.tileX + 0.5) * TILE_SIZE;
    const spawnY = (PLAYER_SPAWN.tileY + 0.5) * TILE_SIZE;
    this.player = new PlayerController(this, spawnX, spawnY);
    this.keyboardInput = new KeyboardInput(this);
    this.physics.add.collider(this.player.sprite, collisionLayer);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);

    this.add
      .text(20, 18, "WASD  MOVE  ·  FIND A WAY THROUGH CAMPUS", {
        color: "#bfffe1",
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        backgroundColor: "#07110ecc",
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(20, 58, "PHASE 1 · LOCAL MOVEMENT TEST", {
        color: "#6f9d89",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(): void {
    if (!this.player || !this.keyboardInput) {
      return;
    }

    this.player.update(this.keyboardInput.readMovement());
  }
}

