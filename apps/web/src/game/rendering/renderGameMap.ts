import Phaser from "phaser";
import type { GameMapDefinition } from "@uos-survivors/shared";
import { paintGameMap } from "./paintGameMap";

export function renderGameMap(scene: Phaser.Scene, map: GameMapDefinition): void {
  const key = `campus-illustration-${map.id}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, map.worldWidth, map.worldHeight);
    if (!texture) throw new Error(`Cannot create map artwork: ${map.id}`);
    paintGameMap(texture.context, map);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  scene.add.image(0, 0, key).setOrigin(0).setDepth(0);
  scene.cameras.main.setBounds(0, 0, map.worldWidth, map.worldHeight).setZoom(1).setRoundPixels(false);
}
