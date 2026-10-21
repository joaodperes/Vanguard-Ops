import { describe, expect, test } from "bun:test";
import {
  MOVEMENT, shouldTouchAutoSprint, responsiveHorizontalVelocity, canUseBufferedJump,
} from "../src/lib/movement-rules";

describe("Movement V2 — horizontal response", () => {
  test("accelerates quickly without overshooting the target", () => {
    const [vx] = responsiveHorizontalVelocity(0, 0, MOVEMENT.walk, 0, true, 0.1);
    expect(vx).toBeGreaterThan(MOVEMENT.walk * 0.85);
    expect(vx).toBeLessThan(MOVEMENT.walk);
  });

  test("brakes more aggressively on ground than in air", () => {
    const ground = responsiveHorizontalVelocity(10, 0, 0, 0, true, 0.1);
    const air = responsiveHorizontalVelocity(10, 0, 0, 0, false, 0.1);
    expect(Math.abs(ground[0])).toBeLessThan(Math.abs(air[0]));
    expect(air[0]).toBeGreaterThan(8);
  });

  test("reverses direction rapidly", () => {
    const [vx] = responsiveHorizontalVelocity(8, 0, -8, 0, true, 0.08);
    expect(vx).toBeLessThan(0);
  });

  test("is frame-rate independent over the same elapsed time", () => {
    const once = responsiveHorizontalVelocity(0, 0, 10, 0, true, 0.1)[0];
    let x = 0;
    for (let i = 0; i < 6; i++) {
      x = responsiveHorizontalVelocity(x, 0, 10, 0, true, 1 / 60)[0];
    }
    expect(Math.abs(once - x)).toBeLessThan(0.00001);
  });

  test("does not create velocity at zero input", () => {
    expect(responsiveHorizontalVelocity(0, 0, 0, 0, true, 1 / 60)).toEqual([0, 0]);
  });
});

describe("Movement V2 — mobile sprint", () => {
  test("engages early, remains latched, and disengages cleanly", () => {
    expect(shouldTouchAutoSprint(0.71, 0.9, false)).toBe(false);
    expect(shouldTouchAutoSprint(0.74, 0.9, false)).toBe(true);
    expect(shouldTouchAutoSprint(0.67, 0.9, true)).toBe(true);
    expect(shouldTouchAutoSprint(0.61, 0.9, true)).toBe(false);
    expect(shouldTouchAutoSprint(0.9, 0.1, true)).toBe(false);
  });
});

describe("Movement V2 — buffered jump", () => {
  test("allows a recent jump on the ground", () => {
    expect(canUseBufferedJump(1000, 900, 1000, true)).toBe(true);
  });

  test("allows jump during brief coyote grace", () => {
    expect(canUseBufferedJump(1000, 990, 930, false)).toBe(true);
  });

  test("rejects expired jump and expired coyote grace", () => {
    expect(canUseBufferedJump(1000, 870, 1000, true)).toBe(false);
    expect(canUseBufferedJump(1000, 990, 860, false)).toBe(false);
    expect(canUseBufferedJump(1000, -Infinity, -Infinity, false)).toBe(false);
  });
});
