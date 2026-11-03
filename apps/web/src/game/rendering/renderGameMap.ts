import Phaser from "phaser";
import { getMapTiles, pointInPolygon, TILE_INDEX, type GameMapDefinition } from "@uos-survivors/shared";

export function renderGameMap(scene: Phaser.Scene, map: GameMapDefinition): void {
  const ground = scene.add.graphics().setDepth(0), t = map.tileSize;
  ground.fillStyle(0x0c171a).fillRect(0, 0, map.worldWidth, map.worldHeight);
  const tiles = getMapTiles(map);
  tiles.forEach((row, y) => row.forEach((cell, x) => {
    const p = { x: (x + 0.5) * t, y: (y + 0.5) * t };
    if (cell !== TILE_INDEX.floor) {
      if (map.collisionTiles) ground.fillStyle(0x334c48).fillRect(x * t, y * t, t, t);
      return;
    }
    const area = [...map.ground].reverse().find(area => pointInPolygon(p, area.points));
    const color = area?.kind === "path" ? 0x8c9996 : area?.kind === "plaza" ? 0xb2b4a2 : area?.kind === "field" ? 0x458c57 : (x + y) % 3 ? 0x355940 : 0x385e43;
    ground.fillStyle(color).fillRect(x * t, y * t, t, t);
    if (!area && (x * 7 + y * 11) % 17 === 0) ground.fillStyle(0x52734b).fillRect(x * t + 8, y * t + 9, 3, 3);
    if (area?.kind === "plaza") ground.lineStyle(1, 0x899589, 0.4).strokeRect(x * t, y * t, t, t);
  }));
  for (const o of map.objects) {
    if (o.kind === "pond") {
      ground.fillStyle(0x2b657a).fillRect(o.x, o.y, o.width, o.height);
      ground.lineStyle(4, 0x87aa9a).strokeRect(o.x, o.y, o.width, o.height);
      for (let y = o.y + 12; y < o.y + o.height; y += 24) ground.lineStyle(2, 0x568c98).lineBetween(o.x + 8, y, o.x + o.width - 8, y);
    } else if (o.kind === "tree") {
      ground.fillStyle(0x182f22).fillRect(o.x + 4, o.y + 4, o.width, o.height);
      ground.fillStyle(0x294e35).fillRect(o.x, o.y, o.width, o.height);
      ground.fillStyle(0x47714a).fillRect(o.x + 5, o.y + 5, o.width - 10, o.height - 10);
    } else {
      ground.fillStyle(0x142226, 0.5).fillRect(o.x + 5, o.y + 5, o.width, o.height);
      ground.fillStyle(0x566674).fillRect(o.x, o.y, o.width, o.height);
      ground.fillStyle(0x788390).fillRect(o.x + 4, o.y + 4, o.width - 8, o.height - 8);
      ground.lineStyle(2, 0x344957).strokeRect(o.x, o.y, o.width, o.height);
      for (let x = o.x + 8; x < o.x + o.width - 8; x += 20) ground.fillStyle(0xabc3c5).fillRect(x, o.y + o.height - 8, 9, 4);
    }
    scene.add.text(o.x + o.width / 2, o.y + o.height / 2, o.name, { fontFamily: "sans-serif", fontSize: "11px", color: "#e6f1eb", stroke: "#263841", strokeThickness: 3 }).setOrigin(0.5).setDepth(2);
  }
  for (const d of map.decorations) {
    if (d.kind === "bench") {
      ground.fillStyle(0x765b40).fillRect(d.x - 8, d.y - 3, 16, 6);
      ground.fillStyle(0x25352f).fillRect(d.x - 6, d.y + 3, 3, 3).fillRect(d.x + 4, d.y + 3, 3, 3);
    } else {
      ground.fillStyle(0x283e40).fillRect(d.x, d.y - 9, 3, 16);
      ground.fillStyle(0xe7cd86).fillRect(d.x - 3, d.y - 12, 9, 5);
    }
  }
  scene.cameras.main.setBounds(0, 0, map.worldWidth, map.worldHeight).setZoom(1).setRoundPixels(true);
}
