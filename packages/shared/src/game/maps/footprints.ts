import { pointInPolygon, type GameMapDefinition, type MapPoint, type StaticMapObject } from "./types.js";

export function octagonOutline(x: number, y: number, radius: number): MapPoint[] {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4 + Math.PI / 8;
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  });
}

export function pondOutline(parts: readonly StaticMapObject[], scale: number): MapPoint[] {
  const left = Math.min(...parts.map(p => p.x));
  const right = Math.max(...parts.map(p => p.x + p.width));
  const top = Math.min(...parts.map(p => p.y));
  const bottom = Math.max(...parts.map(p => p.y + p.height));
  return Array.from({ length: 26 }, (_, index) => {
    const angle = index * Math.PI * 2 / 26;
    const bend = .94 + .045 * Math.sin(index * 2.39);
    return {
      x: (left + right) / 2 + Math.cos(angle) * ((right - left) / 2 + 4 * scale) * bend,
      y: (top + bottom) / 2 + Math.sin(angle) * ((bottom - top) / 2 + 4 * scale) * bend,
    };
  });
}

function nearPolygonEdge(x: number, y: number, radius: number, points: readonly MapPoint[]): boolean {
  return points.some((a, i) => {
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2 < radius ** 2;
  });
}

function clipPond(points: readonly MapPoint[], edge: number, upper: boolean): MapPoint[] {
  const inside = (point: MapPoint) => upper ? point.y <= edge : point.y >= edge;
  return points.flatMap((a, index) => {
    const b = points[(index + 1) % points.length]!;
    const result = inside(a) ? [a] : [];
    if (inside(a) !== inside(b)) result.push({ x: a.x + (b.x - a.x) * (edge - a.y) / (b.y - a.y), y: edge });
    return result;
  });
}

const polygonCache = new WeakMap<GameMapDefinition, MapPoint[][]>();
function polygonFootprints(map: GameMapDefinition): MapPoint[][] {
  const cached = polygonCache.get(map);
  if (cached) return cached;
  const groups = new Map<string, StaticMapObject[]>();
  for (const object of map.objects) {
    if (object.kind === "pond") groups.set(object.name, [...(groups.get(object.name) ?? []), object]);
  }
  const scale = map.artScale ?? 1;
  const polygons = [...groups.values()].flatMap(group => {
    const parts = group.sort((a, b) => a.y - b.y);
    const outline = pondOutline(parts, scale);
    return parts.map((part, index) => {
      let points = outline;
      if (index > 0) points = clipPond(points, part.y - scale, false);
      if (index < parts.length - 1) points = clipPond(points, part.y + part.height + scale, true);
      return points;
    });
  });
  for (const object of map.objects) {
    if (object.kind !== "building" || object.variant !== "octagon") continue;
    const x = object.x + object.width / 2;
    const y = object.y + object.height / 2;
    const radius = Math.min(object.width, object.height) / 2;
    polygons.push(octagonOutline(x, y - 3 * scale, radius), octagonOutline(x, y + 3 * scale, radius));
  }
  polygonCache.set(map, polygons);
  return polygons;
}

export function overlapsMapFootprint(map: GameMapDefinition, x: number, y: number, radius: number): boolean {
  const point = { x, y };
  if (!pointInPolygon(point, map.boundary) || nearPolygonEdge(x, y, radius, map.boundary)) return true;
  for (const object of map.objects) {
    if (object.kind === "pond" || object.variant === "octagon") continue;
    const { x: left, y: top, width, height } = object;
    if (object.kind === "tree") {
      const trunkRadius = Math.min(width, height) * .26;
      if ((x - left - width / 2) ** 2 + (y - top - height / 2) ** 2 < (radius + trunkRadius) ** 2) return true;
    } else {
      const dx = x - Math.max(left, Math.min(x, left + width));
      const dy = y - Math.max(top, Math.min(y, top + height));
      if (dx * dx + dy * dy <= radius * radius) return true;
    }
  }
  return polygonFootprints(map).some(points => pointInPolygon(point, points) || nearPolygonEdge(x, y, radius, points));
}
