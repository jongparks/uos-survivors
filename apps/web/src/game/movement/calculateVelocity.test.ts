import { describe, expect, it } from "vitest";

import { calculateVelocity, type MovementInput } from "./calculateVelocity";

const idle: MovementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
};

describe("calculateVelocity", () => {
  it("returns no movement when every direction is released", () => {
    expect(calculateVelocity(idle, 220)).toEqual({ x: 0, y: 0 });
  });

  it("uses the configured speed for cardinal movement", () => {
    expect(calculateVelocity({ ...idle, right: true }, 220)).toEqual({ x: 220, y: 0 });
  });

  it("normalizes diagonal movement to the configured speed", () => {
    const velocity = calculateVelocity({ ...idle, up: true, right: true }, 220);

    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(220, 8);
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeLessThan(0);
  });

  it("cancels opposing inputs on the same axis", () => {
    expect(calculateVelocity({ ...idle, left: true, right: true }, 220)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

