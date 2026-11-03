export interface MapPoint { x: number; y: number }
export interface MapPolygon { points: readonly MapPoint[] }
export interface StaticMapObject {
  id: string; name: string; kind: "building" | "pond" | "tree";
  x: number; y: number; width: number; height: number;
}
export interface MapGate extends MapPoint { id: string; name: string; side: string; interactionRadius: number }
export interface MapHideSpot extends MapPoint { id: string; zoneId: string; exitX: number; exitY: number; interactionRadius: number }
export interface GameMapDefinition {
  id: string; name: string; tileSize: number; worldWidth: number; worldHeight: number;
  boundary: readonly MapPoint[]; objects: readonly StaticMapObject[];
  ground: readonly { kind: "path" | "field" | "plaza"; points: readonly MapPoint[] }[];
  decorations: readonly (MapPoint & { kind: "bench" | "lamp" | "sign" })[];
  spawns: readonly MapPoint[]; gates: readonly MapGate[]; hideSpots: readonly MapHideSpot[];
  protectedPoints: readonly MapPoint[];
  collisionTiles?: readonly (readonly number[])[];
  source?: string;
}
export function pointInPolygon(p: MapPoint, points: readonly MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
