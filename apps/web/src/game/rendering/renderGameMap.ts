import Phaser from "phaser";
import type { GameMapDefinition } from "@uos-survivors/shared";
import { paintGameMap } from "./paintGameMap";

export function renderGameMap(scene: Phaser.Scene, map: GameMapDefinition): void {
  // Keep individual GPU textures at most 2048px when the world is enlarged.
  const chunkSize = 2046;
  const prefix = `campus-illustration-${map.id}-${map.worldWidth}-${map.worldHeight}`;
  let source: HTMLCanvasElement | undefined;
  for (let y = 0; y < map.worldHeight; y += chunkSize) for (let x = 0; x < map.worldWidth; x += chunkSize) {
    const key = `${prefix}-${x}-${y}`;
    if (!scene.textures.exists(key)) {
      if (!source) {
        source = document.createElement("canvas");
        source.width = Math.ceil(map.worldWidth); source.height = Math.ceil(map.worldHeight);
        paintGameMap(source.getContext("2d")!, map);
      }
      const w = Math.min(chunkSize, Math.ceil(map.worldWidth - x)), h = Math.min(chunkSize, Math.ceil(map.worldHeight - y));
      // One-pixel bleed keeps linear filtering from exposing seams between chunks.
      const chunk = document.createElement("canvas"); chunk.width = w + 2; chunk.height = h + 2;
      const c = chunk.getContext("2d")!;
      c.drawImage(source, x, y, w, h, 1, 1, w, h);
      c.drawImage(source, Math.max(0, x - 1), y, 1, h, 0, 1, 1, h);
      c.drawImage(source, Math.min(source.width - 1, x + w), y, 1, h, w + 1, 1, 1, h);
      c.drawImage(source, x, Math.max(0, y - 1), w, 1, 1, 0, w, 1);
      c.drawImage(source, x, Math.min(source.height - 1, y + h), w, 1, 1, h + 1, w, 1);
      for (const dx of [0, w + 1]) for (const dy of [0, h + 1]) {
        const sx = Math.max(0, Math.min(source.width - 1, dx === 0 ? x - 1 : x + w));
        const sy = Math.max(0, Math.min(source.height - 1, dy === 0 ? y - 1 : y + h));
        c.drawImage(source, sx, sy, 1, 1, dx, dy, 1, 1);
      }
      const texture = scene.textures.addCanvas(key, chunk);
      if (!texture) throw new Error(`Cannot create map artwork: ${map.id}`);
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      // Crop away bleed pixels while retaining them for edge filtering.
      texture.add("map", 0, 1, 1, w, h);
    }
    scene.add.image(x, y, key, "map").setOrigin(0).setDepth(0);
  }
  if (source) { source.width = 1; source.height = 1; }
  scene.cameras.main.setBounds(0, 0, map.worldWidth, map.worldHeight).setZoom(1).setRoundPixels(false);
}
