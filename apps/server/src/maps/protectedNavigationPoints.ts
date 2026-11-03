import { PLAYER_SPAWNS, tileToWorld } from "@uos-survivors/shared";

// Register future escape facilities, entrances and required interaction approach
// positions here. Current test-map main areas are represented by its spawn points.
export const PROTECTED_NAVIGATION_POINTS = PLAYER_SPAWNS.map(p => ({ x: tileToWorld(p.tileX), y: tileToWorld(p.tileY) }));
