import { octagonOutline, pondOutline, getMapTiles, pointInPolygon, scaleGameMap, TILE_INDEX, type GameMapDefinition, type MapPoint, type StaticMapObject } from "@uos-survivors/shared";
import { CAMPUS_BUILDING_APPEARANCE, DEFAULT_BUILDING_APPEARANCE, type BuildingAppearance } from "./campusAppearance";
import { paintCampusNightLighting } from "./paintCampusNightLighting";

/*
 * Static campus artwork (soft top-down illustration, not pixel art).
 * Everything here is decoration: walkability always comes from the shared map
 * (boundary + objects). Drawn once into a canvas and cached as textures.
 * Light comes from the south-west, so shadows fall to the north-east… but the
 * camera looks slightly from the south, so each building shows its south facade.
 */
type Ctx = CanvasRenderingContext2D;
type Ground = GameMapDefinition["ground"][number];
const TAU = Math.PI * 2;

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
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fill();
}
function bounds(points: readonly MapPoint[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  return `#${[n >> 16 & 255, n >> 8 & 255, n & 255].map(v => ch(v).toString(16).padStart(2, "0")).join("")}`;
}

// ───────────────────────────────── trees
const TREE_PALETTE: Record<string, { base: string; tones: string[]; light: string }> = {
  oak: { base: "#35603f", tones: ["#4f8350", "#5e9356", "#457448"], light: "#8fb871" },
  zelkova: { base: "#43663a", tones: ["#6c9149", "#82a050", "#9a9a4a"], light: "#b9c071" },
  ginkgo: { base: "#8d7f2a", tones: ["#c9b542", "#d8c44f", "#b9a338"], light: "#f0df78" },
  cherry: { base: "#6e4537", tones: ["#a25d47", "#b9765a", "#8f5243"], light: "#d9a078" },
  pine: { base: "#1f4236", tones: ["#2b5a45", "#356a4c", "#25503f"], light: "#5f8f66" },
};
function treeShadow(c: Ctx, x: number, y: number, r: number) {
  ellipse(c, x + r * .5, y - r * .18, r * 1.05, r * .8, "#1b2e2440");
}
function canopy(c: Ctx, x: number, y: number, radius: number, variant: string, seed: number) {
  const rng = random(seed), pal = TREE_PALETTE[variant] ?? TREE_PALETTE.oak!;
  ellipse(c, x, y, radius, radius * .9, pal.base);
  const lumps = variant === "pine" ? 9 : 13;
  for (let n = 0; n < lumps; n++) {
    const a = rng() * TAU, r = rng() * radius * .6;
    const px = x + Math.cos(a) * r - radius * .08, py = y + Math.sin(a) * r * .85 - radius * .1, size = radius * (.3 + rng() * .26);
    const g = c.createRadialGradient(px - size * .3, py - size * .35, 0, px, py, size);
    g.addColorStop(0, n % 4 === 0 ? pal.light : pal.tones[n % pal.tones.length]!); g.addColorStop(1, pal.base);
    c.fillStyle = g; c.beginPath(); c.arc(px, py, size, 0, TAU); c.fill();
  }
  if (variant === "pine") {
    c.strokeStyle = "#5f8f6690"; c.lineWidth = 1;
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * radius * .8, y + Math.sin(a) * radius * .75); c.stroke(); }
  }
  // Rim light on the upper-left.
  c.strokeStyle = shade(pal.light, .1) + "55"; c.lineWidth = 1.2; c.beginPath(); c.arc(x - radius * .1, y - radius * .1, radius * .82, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
}

// ───────────────────────────────── ground
function lawnTexture(c: Ctx, area: { x: number; y: number; w: number; h: number }, rng: () => number, dense = 1) {
  for (let i = 0; i < area.w * area.h / 90 * dense; i++) {
    const x = area.x + rng() * area.w, y = area.y + rng() * area.h;
    c.fillStyle = i % 3 ? "#f3f0c414" : "#2f4b3218"; c.fillRect(x, y, 1 + rng() * 1.5, .8 + rng());
  }
}
function paintGround(c: Ctx, map: GameMapDefinition, rng: () => number) {
  const by = (k: Ground["kind"]) => map.ground.filter(g => g.kind === k);
  const fill = (list: readonly Ground[], color: string | CanvasGradient | CanvasPattern) => { for (const g of list) { polygon(c, g.points); c.fillStyle = color; c.fill(); } };
  const edge = (list: readonly Ground[], color: string, width: number) => { for (const g of list) { polygon(c, g.points); c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round"; c.stroke(); } };

  for (const g of by("forest")) {
    c.save(); c.filter = "blur(6px)"; polygon(c, g.points); c.fillStyle = "#728d55"; c.fill(); c.restore();
    c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
    for (let i = 0; i < b.w * b.h / 40; i++) { c.fillStyle = ["#7a6a3a40", "#3e5a3530", "#9a8a4a30"][i % 3]!; c.beginPath(); c.ellipse(b.x + rng() * b.w, b.y + rng() * b.h, 1.6, 1, rng() * 3, 0, TAU); c.fill(); }
    c.restore();
  }
  for (const g of by("garden")) {
    polygon(c, g.points); c.fillStyle = "#93b46c"; c.fill();
    c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
    for (let i = 0; i < b.w * b.h / 140; i++) {
      const x = b.x + rng() * b.w, y = b.y + rng() * b.h;
      ellipse(c, x, y, 3 + rng() * 3, 2.4 + rng() * 2, rng() > .5 ? "#6f9a55" : "#7ea85c");
      if (rng() > .7) ellipse(c, x + 1, y - 1, 1.2, 1.2, ["#e8d26a", "#e9a0a8", "#f4f1e8"][Math.floor(rng() * 3)]!);
    }
    c.restore(); edge([g], "#c9bfa2", 2);
  }
  for (const g of by("lawn")) {
    polygon(c, g.points); c.fillStyle = "#9cbb6c"; c.fill();
    c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
    for (let x = b.x; x < b.x + b.w; x += 14) { c.fillStyle = (x / 14 | 0) % 2 ? "#ffffff0d" : "#2f4b2a0d"; c.fillRect(x, b.y, 14, b.h); }
    lawnTexture(c, b, rng, 1.5); c.restore(); edge([g], "#c8c0a0", 2.5);
  }
  for (const g of by("stage")) {
    const b = bounds(g.points);
    polygon(c, g.points); c.fillStyle = "#97b46b"; c.fill();
    c.save(); polygon(c, g.points); c.clip();
    const cx = b.x - b.w * .15, cy = b.y + b.h / 2;
    for (let r = b.w * .3; r < b.w * 1.4; r += 9) { c.strokeStyle = "#d9d2bb"; c.lineWidth = 2.2; c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2.2, Math.PI / 2.2); c.stroke(); }
    c.restore();
    box(c, b.x - 4, cy - 12, 12, 24, "#b8956a", 2);
    for (let k = 0; k < 5; k++) line(c, b.x - 4, cy - 10 + k * 5, b.x + 8, cy - 10 + k * 5, "#8f6f4c", .8);
  }
  for (const g of by("track")) {
    const b = bounds(g.points);
    box(c, b.x, b.y, b.w, b.h, "#c8c8bd", 6);
    box(c, b.x + 4, b.y + 4, b.w - 8, b.h - 8, "#3d73b2", Math.min(b.w, b.h) * .33);
    c.strokeStyle = "#e8eef4b0"; c.lineWidth = 1;
    for (let k = 1; k < 5; k++) { c.beginPath(); c.roundRect(b.x + 4 + k * 4.5, b.y + 4 + k * 4.5, b.w - 8 - k * 9, b.h - 8 - k * 9, Math.max(4, Math.min(b.w, b.h) * .33 - k * 4.5)); c.stroke(); }
    // Covered stand along the north edge (blue roof in the sky view).
    box(c, b.x + 10, b.y - 2, b.w - 20, 14, "#5a8fc8", 2);
    for (let sx = b.x + 14; sx < b.x + b.w - 12; sx += 10) line(c, sx, b.y, sx, b.y + 11, "#3c6fa6", 1);
  }
  for (const g of by("field")) {
    const b = bounds(g.points);
    for (let k = 0; k < 10; k++) box(c, b.x, b.y + k * b.h / 10, b.w, b.h / 10 + .5, k % 2 ? "#4f9a4c" : "#58a454");
    c.strokeStyle = "#f1f4ec"; c.lineWidth = 1.6; c.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    line(c, b.x + 6, b.y + b.h / 2, b.x + b.w - 6, b.y + b.h / 2, "#f1f4ec", 1.6);
    c.beginPath(); c.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * .13, 0, TAU); c.stroke();
    for (const top of [true, false]) {
      const yy = top ? b.y + 6 : b.y + b.h - 6;
      c.strokeRect(b.x + b.w * .25, top ? yy : yy - b.h * .14, b.w * .5, b.h * .14);
      c.strokeRect(b.x + b.w * .38, top ? yy : yy - b.h * .05, b.w * .24, b.h * .05);
      box(c, b.x + b.w * .43, top ? yy - 3 : yy, b.w * .14, 3, "#f8f8f2"); // goal
    }
  }
  by("court").forEach((g, i) => {
    const b = bounds(g.points);
    box(c, b.x, b.y, b.w, b.h, i % 2 ? "#3f8a77" : "#b86a4b", 2);
    c.strokeStyle = "#f5efe2"; c.lineWidth = 1.2;
    const cols = Math.max(1, Math.round(b.w / (b.h > b.w ? b.w : 34)));
    for (let k = 0; k < cols; k++) {
      const cw = b.w / cols, cx = b.x + k * cw;
      c.strokeRect(cx + 4, b.y + 5, cw - 8, b.h - 10); line(c, cx + 4, b.y + b.h / 2, cx + cw - 4, b.y + b.h / 2, "#f5efe2", 1.6);
      line(c, cx + cw / 2, b.y + 5, cx + cw / 2, b.y + b.h - 5, "#f5efe280", 1);
    }
    c.strokeStyle = "#2f3b36"; c.lineWidth = 1.5; c.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  });
  for (const g of by("parking")) {
    polygon(c, g.points); c.fillStyle = "#6b7073"; c.fill(); edge([g], "#d4d0c2", 3);
    const b = bounds(g.points), vertical = b.h > b.w;
    c.save(); polygon(c, g.points); c.clip();
    if (vertical) for (let y = b.y + 4; y < b.y + b.h; y += 13) { line(c, b.x + 2, y, b.x + b.w * .4, y, "#e9e6da", 1); line(c, b.x + b.w * .6, y, b.x + b.w - 2, y, "#e9e6da", 1); }
    else for (let x = b.x + 4; x < b.x + b.w; x += 13) { line(c, x, b.y + 2, x, b.y + b.h * .45, "#e9e6da", 1); line(c, x, b.y + b.h * .55, x, b.y + b.h - 2, "#e9e6da", 1); }
    c.restore();
  }
  for (const g of by("plaza")) {
    polygon(c, g.points); c.fillStyle = "#d4cec0"; c.fill();
    c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
    for (let sx = b.x; sx < b.x + b.w; sx += 12) line(c, sx, b.y, sx, b.y + b.h, "#9d9a8c30", .8);
    for (let sy = b.y; sy < b.y + b.h; sy += 12) line(c, b.x, sy, b.x + b.w, sy, "#9d9a8c30", .8);
    for (let sy = b.y + 30; sy < b.y + b.h; sy += 60) box(c, b.x, sy, b.w, 6, "#bdb4a2");
    for (let i = 0; i < b.w * b.h / 300; i++) { c.fillStyle = "#6f6a5a18"; c.fillRect(b.x + rng() * b.w, b.y + rng() * b.h, 2, 2); }
    c.restore(); edge([g], "#bdb39b", 2.5);
  }
  // Roads: curbs for all pieces first, then asphalt, so joints are seamless.
  const roads = by("road");
  edge(roads, "#d8d3c4", 8); fill(roads, "#5e6366");
  for (const g of roads) {
    c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
    for (let i = 0; i < b.w * b.h / 160; i++) { c.fillStyle = i % 2 ? "#ffffff0c" : "#00000012"; c.fillRect(b.x + rng() * b.w, b.y + rng() * b.h, 2 + rng() * 3, 1 + rng() * 2); }
    c.restore();
  }
  const paths = by("path");
  edge(paths, "#b8a98a", 5); fill(paths, "#dccfb5");
  for (const g of paths) {
    c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
    for (let sx = b.x; sx < b.x + b.w; sx += 8) line(c, sx, b.y, sx, b.y + b.h, "#b39f7c26", .7);
    for (let sy = b.y; sy < b.y + b.h; sy += 5) line(c, b.x, sy, b.x + b.w, sy, "#b39f7c1c", .6);
    c.restore();
  }
}

// ───────────────────────────────── outside scenery
const HOUSE_ROOFS = ["#7f9a8f", "#8aa597", "#6f86a3", "#8796ad", "#a5a7a0", "#c2c3bc", "#a8705e", "#d2d0c7", "#8d9b7c", "#9b8b76", "#b9a48c", "#71918a"];
function houses(c: Ctx, b: { x: number; y: number; w: number; h: number }, rng: () => number) {
  // Street grid, then each block packed with houses, villas and the odd apartment block.
  box(c, b.x, b.y, b.w, b.h, "#6d716e");
  for (let by = b.y + 2; by < b.y + b.h; ) {
    const bh = 54 + rng() * 34;
    for (let bx = b.x + 2; bx < b.x + b.w; ) {
      const bw = 70 + rng() * 60;
      box(c, bx, by, bw - 7, bh - 7, "#7c807b");
      if (rng() < .12) {
        const roof = rng() > .5 ? "#d4d5ce" : "#b9bdb8";
        box(c, bx + 6, by + 8, bw - 14, bh - 18, "#28302c33", 1); box(c, bx + 3, by + 4, bw - 14, bh - 18, roof, 1);
        for (let sx = bx + 6; sx < bx + bw - 14; sx += 9) line(c, sx, by + 6, sx, by + bh - 16, shade(roof, -.12), .7);
      } else for (let y = by + 2; y < by + bh - 10; y += 16 + rng() * 6) for (let x = bx + 2; x < bx + bw - 12; ) {
        const w = 10 + rng() * 13, h = 11 + rng() * 6;
        if (x + w > bx + bw - 8) break;
        if (rng() > .1) {
          const roof = HOUSE_ROOFS[Math.floor(rng() * HOUSE_ROOFS.length)]!;
          box(c, x + 2, y + 2.5, w, h, "#20282530", 1); box(c, x, y, w, h, roof, 1);
          c.strokeStyle = shade(roof, -.22); c.lineWidth = .7; c.strokeRect(x + .4, y + .4, w - .8, h - .8);
          if (rng() > .55) box(c, x + w * .15, y + h * .2, w * .32, h * .35, shade(roof, .16), .8);
        } else canopy(c, x + w / 2, y + h / 2, 5 + rng() * 3, "oak", Math.floor(rng() * 1e6));
        x += w + 1.5 + rng() * 3;
      }
      bx += bw;
    }
    by += bh;
  }
}
function paintSurroundings(c: Ctx, map: GameMapDefinition, rng: () => number) {
  c.fillStyle = "#4e5c52"; c.fillRect(0, 0, map.worldWidth, map.worldHeight);
  for (const g of map.ground) {
    if (g.kind === "street") { polygon(c, g.points); c.fillStyle = "#5a5f61"; c.fill(); }
    if (g.kind === "residential") { c.save(); polygon(c, g.points); c.clip(); houses(c, bounds(g.points), rng); c.restore(); }
    if (g.kind === "schoolyard") {
      c.save(); polygon(c, g.points); c.clip(); const b = bounds(g.points);
      box(c, b.x, b.y, b.w, b.h, "#8a8c84");
      for (let k = 0; k < 3; k++) { box(c, b.x + 30 + k * 95, b.y + 8, 80, 18, "#5f8e74", 1); box(c, b.x + 30 + k * 95, b.y + 26, 80, 5, "#c9b9a0"); }
      box(c, b.x + 10, b.y + 40, b.w * .5, b.h - 40, "#c7b18c");
      box(c, b.x + b.w * .55, b.y + 40, b.w * .4, b.h - 40, "#b6643e", 16); box(c, b.x + b.w * .55 + 8, b.y + 48, b.w * .4 - 16, b.h - 56, "#5f9a55", 10);
      c.restore();
    }
  }
  for (const g of map.ground.filter(g => g.kind === "forest")) {
    const b = bounds(g.points);
    c.save(); polygon(c, g.points); c.clip();
    box(c, b.x, b.y, b.w, b.h, "#3f5d42");
    for (let y = b.y; y < b.y + b.h; y += 15) for (let x = b.x; x < b.x + b.w; x += 16) {
      const p = { x: x + rng() * 12, y: y + rng() * 12 };
      if (pointInPolygon(p, map.boundary)) continue;
      const v = rng(); canopy(c, p.x, p.y, 11 + rng() * 9, v > .7 ? "pine" : v > .62 ? "cherry" : v > .5 ? "zelkova" : "oak", Math.floor(rng() * 1e6));
    }
    c.restore();
  }
}

// ───────────────────────────────── buildings
function facade(c: Ctx, x: number, y: number, w: number, h: number, a: BuildingAppearance) {
  box(c, x, y, w, h, a.wall);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (a.facade === "brick") {
    for (let row = 0; row * 3 < h; row++) {
      line(c, x, y + row * 3, x + w, y + row * 3, "#f1dcc21e", .5);
      for (let col = -1; col < w / 7; col++) line(c, x + col * 7 + row % 2 * 3.5, y + row * 3, x + col * 7 + row % 2 * 3.5, y + row * 3 + 3, "#3f2a2322", .5);
    }
  } else if (a.facade === "louver") {
    for (let sx = x + 1.5; sx < x + w; sx += 3) line(c, sx, y, sx, y + h, "#22363455", .9);
  } else if (a.facade === "metal") {
    for (let sx = x; sx < x + w; sx += 9) { box(c, sx, y, 8, h, shade(a.wall, (sx / 9 | 0) % 2 ? .05 : -.05)); }
  } else if (a.facade !== "glass") {
    for (let sx = x; sx < x + w; sx += 16) line(c, sx, y, sx, y + h, "#53605c22", .7);
    for (let sy = y; sy < y + h; sy += 6) line(c, x, sy, x + w, sy, "#53605c1a", .6);
  }
  const rows = Math.max(1, Math.min(a.floors ?? 3, Math.floor((h - 3) / 5)));
  const rowH = (h - 3) / rows, winW = a.feature === "curtain" || a.facade === "glass" ? 0 : Math.min(7, w / 9);
  if (winW === 0) {
    const glass = c.createLinearGradient(x, y, x, y + h); glass.addColorStop(0, shade(a.glazing, .35)); glass.addColorStop(1, shade(a.glazing, -.35));
    c.fillStyle = glass; c.fillRect(x + 2, y + 2, w - 4, h - 4);
    for (let sx = x + 2; sx < x + w - 2; sx += 6) line(c, sx, y + 2, sx, y + h - 2, a.trim + "aa", .7);
    for (let r = 1; r < rows; r++) line(c, x + 2, y + 2 + r * rowH, x + w - 2, y + 2 + r * rowH, a.trim, .8);
  } else {
    for (let r = 0; r < rows; r++) for (let sx = x + 4; sx + winW < x + w - 3; sx += winW + 4) {
      const wy = y + 2 + r * rowH + rowH * .2, wh = rowH * .58;
      const glass = c.createLinearGradient(sx, wy, sx + winW, wy + wh);
      glass.addColorStop(0, shade(a.glazing, .45)); glass.addColorStop(.5, a.glazing); glass.addColorStop(1, shade(a.glazing, -.4));
      c.fillStyle = glass; c.fillRect(sx, wy, winW, wh);
      line(c, sx - .5, wy + wh + .4, sx + winW + .5, wy + wh + .4, a.trim, .8);
    }
  }
  c.restore();
  line(c, x, y + h - .5, x + w, y + h - .5, "#2e3a34", 1.4);
}
function roofDetail(c: Ctx, x: number, y: number, w: number, h: number, a: BuildingAppearance, rng: () => number) {
  if (w < 14 || h < 10) return;
  if (a.roofDetail === "solar") {
    const pw = 7, ph = 4.5, cols = Math.floor((w * .7) / (pw + 1.5)), rows = Math.floor((h * .55) / (ph + 1.5));
    const ox = x + (w - cols * (pw + 1.5)) / 2, oy = y + h * .2;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const g = c.createLinearGradient(ox, oy, ox + pw, oy + ph); g.addColorStop(0, "#5f7fa6"); g.addColorStop(1, "#283e5e");
      c.fillStyle = g; c.fillRect(ox + k * (pw + 1.5), oy + r * (ph + 1.5), pw, ph);
    }
  } else if (a.roofDetail === "skylight") {
    for (let sx = x + 8; sx < x + w - 10; sx += 14) { box(c, sx, y + h * .35, 8, h * .3, "#b8d0d6", 1); line(c, sx, y + h * .5, sx + 8, y + h * .5, "#ffffff90", .8); }
  } else if (a.roofDetail === "cross-skylight") {
    const cx = x + w * .42, cy = y + h * .45, s = Math.min(w, h) * .2;
    box(c, cx - s * 1.6, cy - s * .35, s * 3.2, s * .7, "#a9c7cf", 1); box(c, cx - s * .35, cy - s * 1.3, s * .7, s * 2.6, "#a9c7cf", 1);
    line(c, cx - s * 1.5, cy, cx + s * 1.5, cy, "#ffffffaa", 1);
    c.fillStyle = "#34506f";
    for (let k = 0; k < 4; k++) for (let j = 0; j < 6; j++) c.fillRect(x + w * .66 + j * 6, y + h * .2 + k * 5, 5, 3.6);
  } else if (a.roofDetail === "hvac") {
    for (let k = 0; k < 3; k++) {
      const ux = x + w * (.2 + rng() * .55), uy = y + h * (.2 + rng() * .45);
      box(c, ux, uy, 10, 7, "#d4d6d0", 1); ellipse(c, ux + 3, uy + 3.5, 2.2, 2.2, "#7d8782"); ellipse(c, ux + 7, uy + 3.5, 2.2, 2.2, "#7d8782");
    }
  }
}
function paintRoof(c: Ctx, x: number, y: number, w: number, h: number, a: BuildingAppearance, rng: () => number) {
  const form = a.roofForm ?? "flat";
  if (form === "gable") {
    const horizontal = w >= h, ridge = horizontal ? y + h / 2 : x + w / 2;
    box(c, x, y, w, h, a.roof);
    c.fillStyle = shade(a.roof, -.22);
    if (horizontal) c.fillRect(x, ridge, w, h / 2);
    else c.fillRect(ridge, y, w / 2, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (horizontal) for (let sy = y + 2; sy < y + h; sy += 2.6) line(c, x, sy, x + w, sy, "#1f2a2a22", .5);
    else for (let sx = x + 2; sx < x + w; sx += 2.6) line(c, sx, y, sx, y + h, "#1f2a2a22", .5);
    c.restore();
    if (horizontal) line(c, x + 1, ridge, x + w - 1, ridge, shade(a.roof, .35), 1.6);
    else line(c, ridge, y + 1, ridge, y + h - 1, shade(a.roof, .35), 1.6);
    c.strokeStyle = shade(a.roof, -.4); c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
    return;
  }
  if (form === "octagon") {
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
    const pts = Array.from({ length: 8 }, (_, k) => ({ x: cx + Math.cos(k * TAU / 8 + TAU / 16) * r, y: cy + Math.sin(k * TAU / 8 + TAU / 16) * r }));
    polygon(c, pts); c.fillStyle = a.roof; c.fill(); c.strokeStyle = shade(a.roof, -.35); c.lineWidth = 1.5; c.stroke();
    pts.forEach((p, k) => {
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(p.x, p.y); c.lineTo(pts[(k + 1) % 8]!.x, pts[(k + 1) % 8]!.y); c.closePath();
      c.fillStyle = k % 2 ? "#ffffff14" : "#00000012"; c.fill(); line(c, cx, cy, p.x, p.y, shade(a.roof, .3), 1);
    });
    ellipse(c, cx, cy, r * .12, r * .12, shade(a.roof, .35));
    return;
  }
  box(c, x, y, w, h, shade(a.roof, -.1), 1.5);
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, shade(a.roof, .12)); g.addColorStop(1, shade(a.roof, -.06));
  c.fillStyle = g; c.fillRect(x + 2, y + 2, w - 4, h - 4);
  if (form === "green" || form === "terrace") {
    c.save(); c.beginPath(); c.rect(x + 3, y + 3, w - 6, h - 6); c.clip();
    if (form === "terrace") for (let k = 0; k < 4; k++) box(c, x + 3, y + 3 + k * (h - 6) / 4, w - 6, (h - 6) / 8, k % 2 ? "#a9aca4" : shade(a.roof, .1));
    // Roof garden: planter beds separated by pale decking walkways.
    const cell = 16;
    for (let py = y + 5; py < y + h - 6; py += cell) for (let px = x + 5; px < x + w - 6; px += cell) {
      const bw = Math.min(cell - 4, x + w - 5 - px), bh = Math.min(cell - 4, y + h - 5 - py);
      if (bw < 4 || bh < 4) continue;
      box(c, px, py, bw, bh, rng() > .3 ? shade(a.roof, (rng() - .5) * .25) : "#cfc8b4", 2);
      if (rng() > .5) ellipse(c, px + bw / 2, py + bh / 2, bw * .3, bh * .3, shade(a.roof, .25));
    }
    c.restore();
  } else if (form === "greenhouse") {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    for (let sx = x + 2; sx < x + w; sx += 6) { box(c, sx, y + 2, 5, h - 4, sx / 6 % 2 ? "#eef4f2" : "#d4e3df"); line(c, sx + 2.5, y + 2, sx + 2.5, y + h - 2, "#ffffffcc", .6); }
    c.restore();
  }
  c.strokeStyle = shade(a.roof, .3); c.lineWidth = 1.2; c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  roofDetail(c, x + 3, y + 3, w - 6, h - 6, a, rng);
}
function buildingShadow(c: Ctx, o: StaticMapObject, a: BuildingAppearance) {
  const len = 3 + (a.floors ?? 3) * 2.4;
  c.fillStyle = "#1d2e2647";
  c.beginPath(); c.moveTo(o.x + o.width, o.y + 2); c.lineTo(o.x + o.width + len, o.y + 2 - len * .55); c.lineTo(o.x + o.width + len, o.y + o.height - len * .55); c.lineTo(o.x + o.width, o.y + o.height); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(o.x + 2, o.y); c.lineTo(o.x + 2 + len, o.y - len * .55); c.lineTo(o.x + o.width + len, o.y - len * .55); c.lineTo(o.x + o.width, o.y); c.closePath(); c.fill();
}
function building(c: Ctx, o: StaticMapObject, rng: () => number) {
  const a = CAMPUS_BUILDING_APPEARANCE[o.name] ?? DEFAULT_BUILDING_APPEARANCE;
  const { x, y, width: w, height: h } = o;
  if (o.variant === "octagon") {
    // Octagonal hall: drum wall seen at the south, roof above.
    const r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2 - 3;
    const ring = octagonOutline(cx, cy + 6, r);
    polygon(c, ring); c.fillStyle = a.wall; c.fill();
    c.save(); polygon(c, ring); c.clip(); for (let sy = cy; sy < cy + r + 8; sy += 3) line(c, x, sy, x + w, sy, "#f1dcc21e", .5); c.restore();
    paintRoof(c, cx - r, cy - r, r * 2, r * 2, a, rng);
    return;
  }
  const f = Math.max(9, Math.min(h * .46, 5 + (a.floors ?? 3) * 3.1));
  const rh = h - f;
  facade(c, x, y + rh, w, f, a);
  paintRoof(c, x, y, w, rh, a, rng);
  if (a.feature === "glass-spine" && w > 26) {
    const sx = x + w * .38, sw = Math.min(12, w * .16);
    const glass = c.createLinearGradient(sx, y, sx + sw, y); glass.addColorStop(0, shade(a.glazing, .35)); glass.addColorStop(.5, a.glazing); glass.addColorStop(1, shade(a.glazing, .2));
    c.fillStyle = glass; c.fillRect(sx, y + 2, sw, h - 3);
    for (let sy = y + 4; sy < y + h; sy += 5) line(c, sx, sy, sx + sw, sy, a.trim + "aa", .6);
  }
  if (a.feature === "split" && w > 40) {
    const sx = x + w * .58;
    facade(c, sx, y + rh, x + w - sx, f, { ...a, facade: "glass", wall: "#cfd3cb" });
    box(c, sx, y + 2, x + w - sx - 2, rh - 3, "#d2d5ce", 1);
    for (let sy = y + 5; sy < y + rh - 2; sy += 5) line(c, sx + 2, sy, x + w - 4, sy, "#9fa8a466", .6);
  }
  if (a.feature === "rotunda" && w > 30) {
    const r = Math.min(w * .28, rh * .42);
    ellipse(c, x + w - r - 2, y + rh - r * .2, r, r * .55, a.wall);
    ellipse(c, x + w - r - 2, y + rh - r * .55, r, r * .75, shade(a.roof, .1));
    c.strokeStyle = shade(a.roof, -.3); c.lineWidth = 1; c.beginPath(); c.ellipse(x + w - r - 2, y + rh - r * .55, r, r * .75, 0, 0, TAU); c.stroke();
  }
  if (a.feature === "columns" && w > 34) {
    const entry = Math.min(26, w * .3), ex = x + w / 2 - entry / 2;
    box(c, ex, y + h - f * .75, entry, f * .75, "#33463f");
    box(c, ex - 2, y + h - f * .8, entry + 4, 2.5, a.trim);
    for (let k = 0; k <= 4; k++) box(c, ex + k * entry / 4 - 1, y + h - f * .72, 2, f * .7, a.trim);
  }
  c.strokeStyle = "#2b3833"; c.lineWidth = 1.2; c.strokeRect(x + .6, y + .6, w - 1.2, h - 1.2);
}
function label(c: Ctx, name: string, x: number, y: number, night: boolean) {
  c.font = '700 10.5px "Pretendard", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const tw = c.measureText(name).width;
  c.save(); c.shadowColor = "#0f1a1440"; c.shadowBlur = 3; c.shadowOffsetY = 1;
  box(c, x - tw / 2 - 6, y - 8, tw + 12, 16, night ? "#162438ed" : "#f6f3e8ee", 8); c.restore();
  c.fillStyle = night ? "#e3e7e0" : "#2f4036"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(name, x, y + .5);
}

// ───────────────────────────────── water & props
/** One natural-looking pond over all basins of the same name; the gaps between basins are bridges. */
function pondGroup(c: Ctx, parts: StaticMapObject[], rng: () => number) {
  const x0 = Math.min(...parts.map(p => p.x)), x1 = Math.max(...parts.map(p => p.x + p.width));
  const y0 = Math.min(...parts.map(p => p.y)), y1 = Math.max(...parts.map(p => p.y + p.height));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 4, ry = (y1 - y0) / 2 + 4;
  const rim = pondOutline(parts, 1);
  polygon(c, rim); c.fillStyle = "#8f8a78"; c.fill(); c.strokeStyle = "#6a6657"; c.lineWidth = 3; c.stroke();
  const inner = rim.map(p => ({ x: cx + (p.x - cx) * .9, y: cy + (p.y - cy) * .9 }));
  const water = c.createRadialGradient(cx - rx * .3, cy - ry * .3, 2, cx, cy, Math.max(rx, ry));
  water.addColorStop(0, "#56aa98"); water.addColorStop(1, "#2a6a60");
  polygon(c, inner); c.fillStyle = water; c.fill();
  c.save(); polygon(c, inner); c.clip();
  for (let k = 0; k < 18; k++) { const lx = x0 + rng() * (x1 - x0), ly = y0 + rng() * (y1 - y0); line(c, lx, ly, lx + 6 + rng() * 8, ly, "#d8efe633", 1); }
  for (let k = 0; k < 10; k++) { const lx = x0 + 8 + rng() * (x1 - x0 - 16), ly = y0 + 8 + rng() * (y1 - y0 - 16); ellipse(c, lx, ly, 3, 2.4, "#5f9a4f"); line(c, lx, ly, lx + 2.5, ly - 1, "#2a6a60", .8); }
  c.restore();
  for (let k = 0; k < 16; k++) { const p = rim[Math.floor(rng() * rim.length)]!; for (let j = 0; j < 4; j++) line(c, p.x + j - 2, p.y, p.x + j * 1.5 - 3, p.y - 5 - rng() * 3, "#6f8f4a", .9); }
  for (let k = 0; k < 9; k++) { const p = rim[Math.floor(rng() * rim.length)]!; ellipse(c, p.x, p.y, 2.8, 2.1, "#bdb8a6"); }
  // Bridges across the gaps between consecutive basins.
  const sorted = [...parts].sort((a, b) => a.y - b.y);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!, by0 = a.y + a.height, by1 = b.y;
    if (by1 <= by0) continue;
    c.save(); c.shadowColor = "#1c2b2550"; c.shadowOffsetX = 2; c.shadowOffsetY = 4; c.shadowBlur = 3;
    box(c, x0 - 8, by0 + 1, x1 - x0 + 16, by1 - by0 - 2, "#b48a5c", 2); c.restore();
    for (let sx = x0 - 6; sx < x1 + 8; sx += 3) line(c, sx, by0 + 2, sx, by1 - 2, "#8a6640", .7);
    line(c, x0 - 8, by0 + 1.5, x1 + 8, by0 + 1.5, "#6e4f32", 1.6); line(c, x0 - 8, by1 - 1.5, x1 + 8, by1 - 1.5, "#6e4f32", 1.6);
  }
}
const CAR_COLORS = ["#eceeea", "#c9ccc8", "#2f3436", "#3d5a80", "#9aa1a3", "#b33a32", "#e3e0d4", "#565d61"];
function car(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  box(c, x + 1.5, y + 1.5, w, h, "#00000030", 2.5);
  box(c, x, y, w, h, color, 2.5);
  const horizontal = w > h;
  if (horizontal) { box(c, x + w * .22, y + 1.2, w * .22, h - 2.4, "#2c3a44", 1); box(c, x + w * .62, y + 1.2, w * .14, h - 2.4, "#3b4a54", 1); }
  else { box(c, x + 1.2, y + h * .22, w - 2.4, h * .22, "#2c3a44", 1); box(c, x + 1.2, y + h * .62, w - 2.4, h * .14, "#3b4a54", 1); }
}
function prop(c: Ctx, o: StaticMapObject, rng: () => number) {
  const v = o.variant ?? "";
  if (v === "car") {
    car(c, o.x, o.y, o.width, o.height, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]!);
  } else if (v === "bike") {
    box(c, o.x, o.y + o.height / 2 - 1, o.width, 2, "#59625f");
    for (let sx = o.x + 2; sx < o.x + o.width - 2; sx += 4) { ellipse(c, sx, o.y + 3, 1.8, 1.8, "#2e3533"); ellipse(c, sx, o.y + o.height - 3, 1.8, 1.8, "#2e3533"); line(c, sx, o.y + 3, sx, o.y + o.height - 3, ["#c8463b", "#3c6fa6", "#e5e1d2"][Math.floor(rng() * 3)]!, 1.2); }
  } else if (v === "kiosk") {
    box(c, o.x + 2, o.y + 2, o.width, o.height, "#00000030", 2);
    box(c, o.x, o.y, o.width / 2, o.height, "#c8463b", 1.5); box(c, o.x + o.width / 2, o.y, o.width / 2, o.height, "#3c6fa6", 1.5);
    box(c, o.x + 2, o.y + 2, o.width - 4, o.height * .35, "#e9eef0aa", 1);
  } else box(c, o.x, o.y, o.width, o.height, "#8a8f88", 2);
}

// ───────────────────────────────── decorations
function fallenBody(c: Ctx, x: number, y: number, angle: number) {
  c.save();
  c.translate(x, y);
  c.rotate(angle * Math.PI / 180);
  c.shadowColor = "transparent";
  ellipse(c, 1, 2, 18, 8, "#17202465");
  ellipse(c, -8, 4, 9, 4, "#542a32a8");
  ellipse(c, -15, 7, 2.3, 1.1, "#542a3280");

  line(c, 3, -2, 13, -6, "#2d343c", 4);
  line(c, 3, 2, 15, 4, "#363f48", 4);
  line(c, 12, -6, 16, -6, "#22272a", 3);
  line(c, 14, 4, 18, 5, "#22272a", 3);
  line(c, -5, -3, -8, -9, "#555a61", 3);
  line(c, -5, 3, -1, 8, "#555a61", 3);
  ellipse(c, -8, -9, 1.8, 1.5, "#94857c");
  ellipse(c, -1, 8, 1.8, 1.5, "#94857c");
  box(c, -8, -4.8, 13, 9.6, "#555a61", 2);
  line(c, -6, -1, 3, -1, "#777e82", 1);
  ellipse(c, -11, -.2, 3.8, 3.5, "#94857c");
  ellipse(c, -13, -.9, 2.3, 3, "#292c31");
  c.restore();
}

function decoration(c: Ctx, d: GameMapDefinition["decorations"][number], rng: () => number) {
  const { x, y } = d;
  c.save(); c.shadowColor = "#1f302840"; c.shadowOffsetX = 2.5; c.shadowOffsetY = 3; c.shadowBlur = 2;
  switch (d.kind) {
    case "fallenBody":
      fallenBody(c, x, y, d.angle ?? 0);
      break;
    case "bench":
      box(c, x - 9, y - 3, 18, 7, "#8a6c48", 1.5);
      c.shadowColor = "transparent"; for (let k = 0; k < 3; k++) line(c, x - 8, y - 1.5 + k * 2, x + 8, y - 1.5 + k * 2, "#c7a57a", .7);
      break;
    case "lamp":
      box(c, x - 1, y - 10, 2, 12, "#4f5c57", 1); c.shadowColor = "transparent";
      { const g = c.createRadialGradient(x, y - 11, 0, x, y - 11, 9); g.addColorStop(0, "#fff3c070"); g.addColorStop(1, "#fff3c000"); c.fillStyle = g; c.fillRect(x - 9, y - 20, 18, 18); }
      ellipse(c, x, y - 11, 3.2, 2.4, "#f3ead0");
      break;
    case "sign":
      box(c, x - 1, y - 2, 2, 8, "#4f4436"); box(c, x - 10, y - 10, 20, 9, "#6b4a32", 1.5);
      c.shadowColor = "transparent"; box(c, x - 8.5, y - 8.5, 17, 6, "#7b5a40", 1); line(c, x - 6, y - 5.5, x + 6, y - 5.5, "#efe6d2", 1);
      break;
    case "clock":
      box(c, x - 6, y - 26, 12, 30, "#ece9df", 1); c.shadowColor = "transparent";
      box(c, x - 6, y - 26, 12, 6, "#c9c6bb", 1);
      ellipse(c, x, y - 15, 4.2, 4.2, "#fdfbf3"); c.strokeStyle = "#3a4541"; c.lineWidth = .9; c.beginPath(); c.arc(x, y - 15, 4.2, 0, TAU); c.stroke();
      line(c, x, y - 15, x, y - 18, "#3a4541", .9); line(c, x, y - 15, x + 2.2, y - 15, "#3a4541", .9);
      break;
    case "tower":
      c.strokeStyle = "#8f9a9b"; c.lineWidth = 3; c.lineCap = "round";
      c.beginPath(); c.moveTo(x - 7, y + 4); c.lineTo(x, y - 18); c.lineTo(x + 8, y + 4); c.stroke();
      c.lineCap = "butt"; c.shadowColor = "transparent"; line(c, x, y - 18, x + 1, y - 22, "#c8463b", 2);
      break;
    case "sculpture":
      box(c, x - 6, y - 2, 12, 7, "#d1ccbf", 1);
      c.shadowColor = "transparent"; c.fillStyle = ["#7a6a55", "#9aa39b", "#b37a4c"][Math.floor(rng() * 3)]!;
      c.beginPath(); c.moveTo(x - 4, y - 1); c.quadraticCurveTo(x - 6, y - 12, x, y - 16); c.quadraticCurveTo(x + 6, y - 9, x + 3, y - 1); c.closePath(); c.fill();
      break;
    case "fountain":
      c.shadowColor = "transparent"; ellipse(c, x, y, 14, 9, "#c9c3b3"); ellipse(c, x, y, 11.5, 7, "#5aa0a8");
      ellipse(c, x, y - 1, 3, 2, "#d9f0f2"); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; line(c, x, y - 2, x + Math.cos(a) * 6, y - 1 + Math.sin(a) * 4, "#e6f6f8aa", .8); }
      break;
    case "bollard":
      box(c, x - 1.5, y - 4, 3, 6, "#4f5855", 1); c.shadowColor = "transparent"; box(c, x - 1.5, y - 3, 3, 1, "#e5e1d2");
      break;
    case "flowerbed":
      c.shadowColor = "transparent"; ellipse(c, x, y, 13, 7, "#b9ad92"); ellipse(c, x, y, 11, 5.6, "#6f9a55");
      for (let k = 0; k < 14; k++) ellipse(c, x + (rng() - .5) * 18, y + (rng() - .5) * 8, 1.3, 1.3, ["#f0c94a", "#e46a6a", "#f4efe6", "#c97ad0"][k % 4]!);
      break;
    case "crosswalk": {
      c.shadowColor = "transparent"; c.translate(x, y); c.rotate((d.angle ?? 0) * Math.PI / 180);
      for (let k = -3; k <= 3; k++) box(c, k * 5 - 1.6, -12, 3.2, 24, "#eeeadfcc");
      break;
    }
    case "island":
      c.shadowColor = "transparent"; ellipse(c, x, y, 24, 22, "#d9d3c4"); ellipse(c, x, y, 21, 19, "#8fb46a");
      for (let k = 0; k < 18; k++) { const a = rng() * TAU, r = rng() * 15; ellipse(c, x + Math.cos(a) * r, y + Math.sin(a) * r * .9, 1.4, 1.4, ["#f0c94a", "#f4efe6", "#e46a6a"][k % 3]!); }
      break;
    case "manhole":
      c.shadowColor = "transparent"; ellipse(c, x, y, 3.6, 3.6, "#4e5552"); c.strokeStyle = "#7b827e"; c.lineWidth = .6; c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.stroke();
      break;
    default: break;
  }
  c.restore();
}

// ───────────────────────────────── main
/** Static art only. Collision always comes from the shared map definition. */
export function paintGameMap(c: Ctx, map: GameMapDefinition): void {
  const scale = map.artScale ?? 1;
  c.save();
  c.scale(scale, scale);
  try {
    paintAuthoredMap(c, scale === 1 ? map : { ...scaleGameMap(map, 1 / scale), tileSize: map.tileSize });
  } finally {
    c.restore();
  }
}
function paintAuthoredMap(c: Ctx, map: GameMapDefinition): void {
  const rng = random();
  if (map.collisionTiles) {
    c.fillStyle = "#32493e"; c.fillRect(0, 0, map.worldWidth, map.worldHeight);
    getMapTiles(map).forEach((row, y) => row.forEach((cell, x) => box(c, x * map.tileSize, y * map.tileSize, map.tileSize, map.tileSize, cell === TILE_INDEX.floor ? "#899b82" : "#53675a")));
    return;
  }
  paintSurroundings(c, map, rng);
  // Campus lawn
  c.save(); polygon(c, map.boundary); c.clip();
  const lawn = c.createLinearGradient(0, 0, map.worldWidth, map.worldHeight);
  lawn.addColorStop(0, "#8eab68"); lawn.addColorStop(.55, "#9bb06f"); lawn.addColorStop(1, "#7f9d62");
  c.fillStyle = lawn; c.fillRect(0, 0, map.worldWidth, map.worldHeight);
  for (let i = 0; i < 160; i++) {
    const x = rng() * map.worldWidth, y = rng() * map.worldHeight, r = 30 + rng() * 120;
    const glow = c.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, i % 2 ? "#c9c07e22" : "#3a5d4520"); glow.addColorStop(1, "#67805b00");
    c.fillStyle = glow; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  lawnTexture(c, { x: 0, y: 0, w: map.worldWidth, h: map.worldHeight }, rng, .5);
  paintGround(c, map, rng);
  // Ginkgo leaves on pavements near ginkgo trees.
  for (const t of map.objects) if (t.kind === "tree" && t.variant === "ginkgo") for (let k = 0; k < 26; k++) {
    const a = rng() * TAU, r = rng() * t.width * 1.3;
    ellipse(c, t.x + t.width / 2 + Math.cos(a) * r, t.y + t.height / 2 + Math.sin(a) * r * .8, 1.4, 1, rng() > .4 ? "#e3c94acc" : "#c9a83acc");
  }
  c.restore();
  // Fence: hedge + railing along the campus boundary.
  polygon(c, map.boundary); c.strokeStyle = "#4d7346"; c.lineWidth = 9; c.lineJoin = "round"; c.stroke();
  polygon(c, map.boundary); c.strokeStyle = "#2f3a35"; c.lineWidth = 1.8; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]);
  // Gate aprons and pillars.
  for (const g of map.gates) {
    ellipse(c, g.x, g.y, 26, 20, "#d8d1bf");
    for (const s of [-1, 1]) { box(c, g.x + s * 18 - 3, g.y - 4, 6, 8, "#8c8579", 1); box(c, g.x + s * 18 - 3, g.y - 6, 6, 3, "#b8b0a2", 1); }
  }

  // Shadows first (buildings, trees), then solid objects.
  for (const o of map.objects) {
    if (o.kind === "building") buildingShadow(c, o, CAMPUS_BUILDING_APPEARANCE[o.name] ?? DEFAULT_BUILDING_APPEARANCE);
    else if (o.kind === "tree") treeShadow(c, o.x + o.width / 2, o.y + o.height / 2, o.width * .55);
  }
  const byName = new Map<string, StaticMapObject[]>();
  map.objects.filter(o => o.kind === "pond").forEach(o => byName.set(o.name, [...(byName.get(o.name) ?? []), o]));
  for (const list of byName.values()) pondGroup(c, list, rng);

  for (const o of map.objects) if (o.kind === "prop") prop(c, o, rng);
  // Buildings back to front so southern facades overlap correctly.
  const buildings = map.objects.filter(o => o.kind === "building").sort((a, b) => (a.y + a.height) - (b.y + b.height));
  for (const o of buildings) building(c, o, rng);
  for (const d of map.decorations) decoration(c, d, rng);
  for (const o of map.objects) if (o.kind === "tree") canopy(c, o.x + o.width / 2, o.y + o.height / 2, o.width * .55, o.variant ?? "oak", Math.round(o.x * 7 + o.y * 13));

  const night = map.lighting === "night";
  if (night) paintCampusNightLighting(c, map);

  // Labels remain legible above the lighting layer.
  const groups = new Map<string, StaticMapObject[]>();
  for (const o of map.objects) if ((o.kind === "building" || o.kind === "pond") && o.name) groups.set(o.name, [...(groups.get(o.name) ?? []), o]);
  for (const [name, parts] of groups) {
    const main = parts.find(p => !p.hideLabel) ?? parts[0]!;
    const x0 = Math.min(...parts.map(p => p.x)), x1 = Math.max(...parts.map(p => p.x + p.width));
    const cx = parts.length > 1 ? (x0 + x1) / 2 : main.x + main.width / 2;
    const cy = main.y + Math.min(main.height * .4, 26);
    label(c, name, cx, cy, night);
  }
}
