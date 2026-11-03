import { getMapTiles, pointInPolygon, TILE_INDEX, type GameMapDefinition, type MapPoint, type StaticMapObject } from "@uos-survivors/shared";
import { CAMPUS_BUILDING_APPEARANCE, DEFAULT_BUILDING_APPEARANCE, type BuildingAppearance } from "./campusAppearance";

type Ctx = CanvasRenderingContext2D;
function polygon(c: Ctx, points: readonly MapPoint[]) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
}
function random(seed = 816) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
function box(c: Ctx, x: number, y: number, w: number, h: number, color: string, radius = 0) {
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function line(c: Ctx, x: number, y: number, x2: number, y2: number, color: string, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function canopy(c: Ctx, x: number, y: number, radius: number, seed: number) {
  const rng = random(seed);
  c.save(); c.shadowColor = "#152f2950"; c.shadowBlur = 10; c.shadowOffsetX = 6; c.shadowOffsetY = 9;
  ellipse(c, x, y, radius, radius * .83, "#365f45"); c.restore();
  for (let n = 0; n < 14; n++) {
    const a = rng() * Math.PI * 2, r = rng() * radius * .65;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * .8, size = radius * (.28 + rng() * .25);
    const g = c.createRadialGradient(px - 3, py - 4, 0, px, py, size);
    g.addColorStop(0, n % 3 === 0 ? "#94a96a" : "#74965d"); g.addColorStop(1, "#416b49");
    c.fillStyle = g; c.beginPath(); c.arc(px, py, size, 0, Math.PI * 2); c.fill();
  }
}
function facade(c: Ctx, x: number, y: number, w: number, h: number, a: BuildingAppearance) {
  box(c, x, y, w, h, a.wall);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (a.facade === "brick") {
    for (let row = 0; row < h / 4; row++) {
      line(c, x, y + row * 4, x + w, y + row * 4, "#ecd9c024", .65);
      for (let col = -1; col < w / 10; col++) line(c, x + col * 10 + row % 2 * 5, y + row * 4, x + col * 10 + row % 2 * 5, y + row * 4 + 4, "#3f302c25", .65);
    }
  } else if (a.facade === "louver") {
    for (let sx = x + 2; sx < x + w; sx += 3.5) line(c, sx, y, sx, y + h, "#263e3b55", 1);
  } else if (a.facade !== "glass") {
    for (let sx = x; sx < x + w; sx += 19) line(c, sx, y, sx, y + h, "#53605c25", .8);
    for (let sy = y; sy < y + h; sy += 14) line(c, x, sy, x + w, sy, "#53605c25", .8);
  }
  const windowW = Math.min(12, w / 7), spacing = a.feature === "columns" ? 22 : 19;
  for (let sx = x + 7; sx + windowW < x + w - 5; sx += spacing) {
    box(c, sx - 1, y + 4, windowW + 2, h - 8, a.trim);
    const glass = c.createLinearGradient(sx, y, sx + windowW, y + h);
    glass.addColorStop(0, "#b3cfca"); glass.addColorStop(.4, a.glazing); glass.addColorStop(1, "#314b50");
    c.fillStyle = glass; c.fillRect(sx, y + 5, windowW, h - 10);
    line(c, sx, y + h * .53, sx + windowW, y + h * .53, a.trim, 1);
  }
  c.restore();
}
function building(c: Ctx, o: StaticMapObject) {
  const a = CAMPUS_BUILDING_APPEARANCE[o.name] ?? DEFAULT_BUILDING_APPEARANCE;
  const { x, y, width: w, height: h } = o;
  const front = Math.min(48, Math.max(18, h * .36)), rh = h - front;
  // Shadows are decoration; the plinth stays on the collision footprint.
  c.save(); c.shadowColor = "#20322c52"; c.shadowBlur = 13; c.shadowOffsetX = 9; c.shadowOffsetY = 12;
  box(c, x, y, w, h, "#5c675d", 2); c.restore();
  facade(c, x + 1, y + rh, w - 2, front - 1, a);
  if (o.name === "시대융합관") facade(c, x + 1, y + h - 9, w - 2, 8, { ...a, facade: "brick", wall: "#a2745c" });
  const roof = c.createLinearGradient(x, y, x + w * .4, y + rh);
  roof.addColorStop(0, a.roof); roof.addColorStop(1, "#6d7d7066");
  c.fillStyle = a.roof; c.fillRect(x, y, w, rh);
  c.fillStyle = roof; c.fillRect(x + 3, y + 3, w - 6, rh - 3);
  if (a.roofForm === "gable") {
    const ridgeY = y + rh * .46;
    c.fillStyle = "#243c3848"; c.fillRect(x + 3, ridgeY, w - 6, rh - (ridgeY - y));
    line(c, x + 2, ridgeY, x + w - 2, ridgeY, "#dae0ca", 2);
    for (let sx = x + 6; sx < x + w - 3; sx += 7) line(c, sx, y + 4, sx, y + rh - 2, "#273e3435", .8);
  } else {
    c.strokeStyle = a.trim; c.lineWidth = 3; c.strokeRect(x + 2, y + 2, w - 4, rh - 3);
    for (let sx = x + 30; sx < x + w - 8; sx += 34) line(c, sx, y + 6, sx, y + rh - 4, "#293d3320", .7);
    if (w > 70 && rh > 24) {
      box(c, x + w * .61, y + 10, Math.min(w * .23, 32), Math.min(rh * .3, 20), "#d1d2c1", 1);
      for (let k = 0; k < 3; k++) ellipse(c, x + w * .65 + k * 6, y + 16, 2, 2, "#7c8980");
    }
  }
  if (a.feature === "glass-spine" && w > 48) {
    const sx = x + w * .36, sw = Math.min(20, w * .19);
    const glass = c.createLinearGradient(sx, y, sx + sw, y);
    glass.addColorStop(0, "#a9c2bb"); glass.addColorStop(.5, a.glazing); glass.addColorStop(1, "#9bbab9");
    c.fillStyle = glass; c.fillRect(sx, y + 4, sw, h - 6);
    for (let sy = y + 6; sy < y + h; sy += 9) line(c, sx, sy, sx + sw, sy, a.trim, .8);
  }
  if (a.feature === "split" && w > 60) {
    const sx = x + w * .55;
    facade(c, sx, y + 4, w * .45 - 4, h - 7, { ...a, facade: "stone", wall: "#d4d3c6" });
    box(c, sx, y + 3, w * .45 - 3, rh * .45, "#c3c8bb");
  }
  if (a.feature === "rotunda" && w > 60) {
    const r = Math.min(w * .22, rh * .45);
    ellipse(c, x + w - r - 4, y + r + 4, r, r, a.wall);
    ellipse(c, x + w - r - 4, y + r + 1, r - 2, r * .68, a.roof);
  }
  if (a.feature === "columns" && w > 64) {
    const entry = Math.min(35, w * .3), ex = x + w / 2 - entry / 2;
    box(c, ex, y + h - 17, entry, 15, "#425850");
    box(c, ex - 3, y + h - 19, entry + 6, 4, a.trim);
    box(c, ex - 2, y + h - 16, 3, 14, a.trim); box(c, ex + entry - 1, y + h - 16, 3, 14, a.trim);
    for (let k = 0; k < 3; k++) line(c, ex - 4, y + h - 2 - k * 2, ex + entry + 4, y + h - 2 - k * 2, "#ddd9c4", 1);
  }
  line(c, x, y + h - 1, x + w, y + h - 1, "#394c40", 2);
  c.font = '500 11px "Malgun Gothic", sans-serif';
  const tw = c.measureText(o.name).width, labelY = y + Math.max(12, rh * .55);
  box(c, x + w / 2 - tw / 2 - 7, labelY - 10, tw + 14, 20, "#f1efdfed", 5);
  c.fillStyle = "#384b43"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(o.name, x + w / 2, labelY);
}

/** Static art only. Collision always comes from the shared map definition. */
export function paintGameMap(c: Ctx, map: GameMapDefinition): void {
  const rng = random();
  c.fillStyle = "#32493e"; c.fillRect(0, 0, map.worldWidth, map.worldHeight);
  if (map.collisionTiles) {
    getMapTiles(map).forEach((row, y) => row.forEach((cell, x) => box(c, x * map.tileSize, y * map.tileSize, map.tileSize, map.tileSize, cell === TILE_INDEX.floor ? "#899b82" : "#53675a")));
  } else {
    c.save(); polygon(c, map.boundary); c.clip();
    const lawn = c.createLinearGradient(0, 0, map.worldWidth, map.worldHeight);
    lawn.addColorStop(0, "#899e70"); lawn.addColorStop(.5, "#a2ad7a"); lawn.addColorStop(1, "#6e8b65");
    c.fillStyle = lawn; c.fillRect(0, 0, map.worldWidth, map.worldHeight);
    for (let i = 0; i < 140; i++) {
      const x = rng() * map.worldWidth, y = rng() * map.worldHeight, r = 30 + rng() * 150;
      const glow = c.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, i % 2 ? "#c0bb7c28" : "#385d4620"); glow.addColorStop(1, "#67805b00");
      c.fillStyle = glow; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const area of map.ground) {
      polygon(c, area.points); c.fillStyle = area.kind === "field" ? "#80986d" : area.kind === "plaza" ? "#c9c6b6" : "#abb0a4"; c.fill();
      c.strokeStyle = area.kind === "path" ? "#d7d3bd" : "#b4b59e"; c.lineWidth = area.kind === "path" ? 6 : 3; c.lineJoin = "round"; c.stroke();
      c.save(); polygon(c, area.points); c.clip();
      const xs = area.points.map(p => p.x), ys = area.points.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      if (area.kind === "plaza") {
        for (let sx = x; sx < x + w; sx += 28) line(c, sx, y, sx, y + h, "#7e897b2c", .8);
        for (let sy = y; sy < y + h; sy += 28) line(c, x, sy, x + w, sy, "#7e897b2c", .8);
        c.strokeStyle = "#f0ede052"; c.lineWidth = 3; c.strokeRect(x + 15, y + 15, w - 30, h - 30);
      } else if (area.kind === "field") {
        c.strokeStyle = "#aa775f"; c.lineWidth = 15; c.beginPath(); c.roundRect(x + 15, y + 15, w - 30, h - 30, Math.min(w, h) / 3); c.stroke();
        c.strokeStyle = "#eee8d6bd"; c.lineWidth = 1.5; c.strokeRect(x + 35, y + 45, w - 70, h - 90);
        line(c, x + 35, y + h / 2, x + w - 35, y + h / 2, "#eee8d6bd", 1.5);
        c.beginPath(); c.arc(x + w / 2, y + h / 2, 20, 0, Math.PI * 2); c.stroke();
      } else if (w > h * 3 && h > 55) {
        c.setLineDash([14, 13]); line(c, x + 20, y + h / 2, x + w - 20, y + h / 2, "#e5d7a877", 1.5); c.setLineDash([]);
        for (let stripe = 0; stripe < 6; stripe++) box(c, x + 85, y + 8 + stripe * (h - 16) / 6, 22, 4, "#ebe9dcaa", .5);
      }
      c.restore();
    }
    for (let i = 0; i < 18000; i++) {
      const x = rng() * map.worldWidth, y = rng() * map.worldHeight;
      c.fillStyle = i % 2 ? "#f7eed519" : "#344c3b10"; c.fillRect(x, y, .8 + rng(), .6 + rng());
    }
    c.restore(); polygon(c, map.boundary); c.strokeStyle = "#c2c4a6"; c.lineWidth = 3; c.stroke();
  }
  // Boundary trees occupy blocked cells only, keeping all gameplay corridors clear.
  const tiles = getMapTiles(map), t = map.tileSize;
  for (let y = 1; y < tiles.length - 1; y++) for (let x = 1; x < tiles[y]!.length - 1; x++) {
    if (map.collisionTiles || tiles[y]![x] === TILE_INDEX.floor || (x * 7 + y * 11) % 4) continue;
    const p = { x: (x + .5) * t, y: (y + .5) * t };
    if (pointInPolygon(p, map.boundary) || map.gates.some(g => Math.hypot(g.x - p.x, g.y - p.y) < 100)) continue;
    if ([tiles[y - 1]?.[x], tiles[y + 1]?.[x], tiles[y]?.[x - 1], tiles[y]?.[x + 1]].includes(TILE_INDEX.floor)) canopy(c, p.x, p.y, 14 + rng() * 7, x * 83 + y);
  }
  for (const o of map.objects) {
    if (o.kind === "building") building(c, o);
    else if (o.kind === "tree") canopy(c, o.x + o.width / 2, o.y + o.height / 2, Math.min(o.width, o.height) / 2, o.x + o.y);
    else {
      box(c, o.x, o.y, o.width, o.height, "#c3c0a6", 2);
      const water = c.createLinearGradient(o.x, o.y, o.x + o.width, o.y + o.height);
      water.addColorStop(0, "#769b8e"); water.addColorStop(1, "#456f6b");
      c.fillStyle = water; c.fillRect(o.x + 4, o.y + 4, o.width - 8, o.height - 8);
      for (let k = 0; k < 20; k++) {
        const x = o.x + 8 + rng() * (o.width - 22), y = o.y + 9 + rng() * (o.height - 18);
        line(c, x, y, Math.min(o.x + o.width - 6, x + 8 + rng() * 10), y, "#e4eee02b", 1);
      }
      c.font = '11px "Malgun Gothic", sans-serif'; c.fillStyle = "#eef0dd"; c.textAlign = "center"; c.fillText(o.name, o.x + o.width / 2, o.y + o.height / 2);
    }
  }
  for (const d of map.decorations) {
    c.save(); c.shadowColor = "#273e3444"; c.shadowOffsetX = 3; c.shadowOffsetY = 4; c.shadowBlur = 3;
    if (d.kind === "bench") {
      box(c, d.x - 10, d.y - 4, 20, 9, "#846c4b", 2);
      for (let k = 0; k < 3; k++) line(c, d.x - 8, d.y - 2 + k * 2, d.x + 8, d.y - 2 + k * 2, "#c5a67c", .7);
    } else {
      box(c, d.x - 1, d.y - 9, 2, 15, "#52615a", 1); ellipse(c, d.x, d.y - 10, 4, 3, "#ece4be");
    }
    c.restore();
  }
}
