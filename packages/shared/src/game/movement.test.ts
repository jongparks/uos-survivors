import { describe, expect, it } from "vitest";

import { PLAYER_BODY_SIZE, PLAYER_SPEED, TILE_SIZE, tileToWorld } from "./config.js";
import { calculateVelocity, moveWithTestMapCollision } from "./movement.js";
import { IDLE_MOVEMENT_INPUT } from "../messages/index.js";

describe("authoritative movement", () => {
  it("normalizes diagonal movement", () => {
    const velocity = calculateVelocity(
      { ...IDLE_MOVEMENT_INPUT, up: true, right: true },
      PLAYER_SPEED,
    );

    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(PLAYER_SPEED, 8);
  });

  it("moves through open floor", () => {
    const start = { x: tileToWorld(3), y: tileToWorld(3) };
    const result = moveWithTestMapCollision(
      start,
      { ...IDLE_MOVEMENT_INPUT, right: true },
      PLAYER_SPEED,
      1 / 30,
    );

    expect(result.x).toBeGreaterThan(start.x);
    expect(result.y).toBe(start.y);
  });

  it("does not cross the outer wall", () => {
    const start = { x: tileToWorld(1), y: tileToWorld(1) };
    let position = start;

    for (let tick = 0; tick < 60; tick += 1) {
      position = moveWithTestMapCollision(
        position,
        { ...IDLE_MOVEMENT_INPUT, left: true },
        PLAYER_SPEED,
        1 / 30,
      );
    }

    expect(position.x).toBeGreaterThanOrEqual(TILE_SIZE + PLAYER_BODY_SIZE / 2);
  });
});

