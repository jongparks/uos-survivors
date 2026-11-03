import type { GameMapDefinition, MapPoint } from "./types.js";

export function scaleGameMap(map: GameMapDefinition, scale: number, id = map.id): GameMapDefinition {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Map scale must be positive");
  const point = (p: MapPoint) => ({ x: p.x * scale, y: p.y * scale });
  return { ...map, id, artScale: (map.artScale ?? 1) * scale, tileSize: map.tileSize * scale, worldWidth: map.worldWidth * scale, worldHeight: map.worldHeight * scale,
    boundary: map.boundary.map(point), objects: map.objects.map(o => ({ ...o, ...point(o), width: o.width * scale, height: o.height * scale })),
    ground: map.ground.map(area => ({ ...area, points: area.points.map(point) })), decorations: map.decorations.map(d => ({ ...d, ...point(d) })),
    spawns: map.spawns.map(point), gates: map.gates.map(g => ({ ...g, ...point(g), interactionRadius: g.interactionRadius * scale })),
    hideSpots: map.hideSpots.map(h => ({ ...h, ...point(h), exitX: h.exitX * scale, exitY: h.exitY * scale, interactionRadius: h.interactionRadius * scale })),
    protectedPoints: map.protectedPoints.map(point),
  };
}
