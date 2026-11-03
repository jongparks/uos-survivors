export interface MapPoint { x: number; y: number }
export interface MapPolygon { points: readonly MapPoint[] }
/**
 * Collision object. Every object blocks the tiles whose centres it covers.
 * `prop` is a small blocking street object (parked cars, bike racks, kiosks).
 * `variant` and `hideLabel` are art-only hints and never affect collision.
 */
export interface StaticMapObject {
  id: string; name: string; kind: "building" | "pond" | "tree" | "prop";
  x: number; y: number; width: number; height: number;
  /** Art hint, e.g. tree species ("ginkgo", "pine", "cherry") or prop type ("cars-h"). */
  variant?: string;
  /** Additional wing of a building that is already labelled by another part. */
  hideLabel?: boolean;
}
export interface MapGate extends MapPoint { id: string; name: string; side: string; interactionRadius: number }
export interface MapHideSpot extends MapPoint { id: string; zoneId: string; exitX: number; exitY: number; interactionRadius: number }
/** Art-only ground layers. Walkability always comes from boundary + objects. */
export type MapGroundKind =
  | "path" | "field" | "plaza"
  | "road" | "lawn" | "court" | "parking" | "forest" | "stage" | "garden" | "track"
  /** Outside the campus fence: scenery only. */
  | "residential" | "schoolyard" | "street";
export type MapDecorationKind =
  | "bench" | "lamp" | "sign"
  | "clock" | "sculpture" | "tower" | "bollard" | "flowerbed" | "bike" | "crosswalk" | "fountain" | "manhole" | "island";
export interface GameMapDefinition {
  id: string; name: string; tileSize: number; worldWidth: number; worldHeight: number;
  boundary: readonly MapPoint[]; objects: readonly StaticMapObject[];
  ground: readonly { kind: MapGroundKind; points: readonly MapPoint[] }[];
  decorations: readonly (MapPoint & { kind: MapDecorationKind; angle?: number })[];
  spawns: readonly MapPoint[]; gates: readonly MapGate[]; hideSpots: readonly MapHideSpot[];
  protectedPoints: readonly MapPoint[];
  collisionTiles?: readonly (readonly number[])[];
  source?: string;
  /** Uniform scale of visual details relative to the authored artwork. */
  artScale?: number;
  /** Visual treatment only; never changes walkability or interactions. */
  lighting?: "night";
}
export function pointInPolygon(p: MapPoint, points: readonly MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
