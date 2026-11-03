import { PLAYER_BODY_SIZE } from "./config.js";
import { PLAYER_ROLE } from "./rules.js";
import { calculateVelocity, moveWithTestMapCollision, type Position } from "./movement.js";
import type { MovementAxes } from "../messages/index.js";
import { TEST_GAME_MAP } from "./maps/registry.js";
import type { GameMapDefinition } from "./maps/types.js";

export interface BarrierRectangle extends Position { width: number; height: number; expiresAt: number }
export function overlapsRectangle(a: Position & { width: number; height: number }, b: Position & { width: number; height: number }): boolean {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.y - b.y) * 2 < a.height + b.height;
}
export function bodyOverlapsBarrier(position: Position, barrier: BarrierRectangle): boolean {
  return overlapsRectangle({ ...position, width: PLAYER_BODY_SIZE, height: PLAYER_BODY_SIZE }, barrier);
}

export function applyMovementWithBarriers(position: Position, input: MovementAxes, speed: number, dt: number,
  role: string, barriers: Iterable<BarrierRectangle>, now: number, map: GameMapDefinition = TEST_GAME_MAP): void {
  const active = role === PLAYER_ROLE.zombie ? [] : [...barriers].filter(b => now < b.expiresAt);
  const velocity = calculateVelocity(input, speed);
  // Small steps avoid tunneling at sprint speed or during input replay.
  const steps = Math.max(1, Math.ceil(Math.hypot(velocity.x, velocity.y) * dt / (PLAYER_BODY_SIZE / 2)));
  for (let i = 0; i < steps; i++) {
    const nextX = moveWithTestMapCollision(position, { moveX: velocity.x, moveY: 0 }, Math.abs(velocity.x), dt / steps, map);
    if (!active.some(b => bodyOverlapsBarrier(nextX, b))) position.x = nextX.x;
    const nextY = moveWithTestMapCollision(position, { moveX: 0, moveY: velocity.y }, Math.abs(velocity.y), dt / steps, map);
    if (!active.some(b => bodyOverlapsBarrier(nextY, b))) position.y = nextY.y;
  }
}
