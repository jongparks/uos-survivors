import type { GameMapDefinition } from "@uos-survivors/shared";

export function paintCampusNightLighting(c: CanvasRenderingContext2D, map: GameMapDefinition): void {
  const { worldWidth: width, worldHeight: height } = map;
  c.save();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#53688f";
  c.fillRect(0, 0, width, height);

  c.globalCompositeOperation = "source-over";
  const edge = c.createRadialGradient(width * .5, height * .48, height * .18, width * .5, height * .48, width * .57);
  edge.addColorStop(0, "#09152a00");
  edge.addColorStop(1, "#09152a88");
  c.fillStyle = edge;
  c.fillRect(0, 0, width, height);

  c.globalCompositeOperation = "screen";
  function glow(x: number, y: number, radius: number, center: string, middle: string) {
    const light = c.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, center);
    light.addColorStop(.38, middle);
    light.addColorStop(1, "#0000");
    c.fillStyle = light;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Use existing lamp positions; gate lighting is ambient and never signals an open exit.
  for (const lamp of map.decorations) {
    if (lamp.kind !== "lamp") continue;
    glow(lamp.x, lamp.y - 7, 49, "#ffc47ac0", "#c786413f");
    c.fillStyle = "#ffe7b6";
    c.beginPath(); c.ellipse(lamp.x, lamp.y - 11, 2.8, 2.1, 0, 0, Math.PI * 2); c.fill();
  }
  for (const gate of map.gates) glow(gate.x, gate.y, 44, "#97b7d260", "#52789938");
  c.restore();
}
