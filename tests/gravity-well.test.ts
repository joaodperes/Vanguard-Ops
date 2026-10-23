import { describe, expect, test } from "bun:test";
import {
  GRAVITY_WELL_DURATION_MS, GRAVITY_WELL_RADIUS,
  gravityTravelMs, gravityPullOffset, gravityBlastDamage,
} from "../src/lib/gravity-well";

describe("Event Horizon timing", () => {
  test("has visible projectile travel before its separate pull and explosion phases", () => {
    expect(gravityTravelMs(0)).toBe(160);
    expect(gravityTravelMs(50)).toBe(450);
    expect(gravityTravelMs(200)).toBe(900);
    expect(GRAVITY_WELL_DURATION_MS).toBe(2800);
  });
});

describe("Event Horizon gravitational pull", () => {
  test("draws targets toward the orb without overshooting its center", () => {
    const [x, z] = gravityPullOffset([0, 1, 0], [8, 0, 0], GRAVITY_WELL_RADIUS, 0.05);
    expect(x).toBeLessThan(0);
    expect(z).toBe(0);
    expect(x).toBeGreaterThan(-8);
  });
  test("does not pull targets outside the field or from a distant floor", () => {
    expect(gravityPullOffset([0, 1, 0], [15, 0, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
    expect(gravityPullOffset([0, 1, 0], [4, 9, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
    expect(gravityPullOffset([0, 1, 0], [0.2, 0, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
  });
});

describe("Event Horizon detonation", () => {
  test("delivers lethal damage near the core and still hurts across the wide radius", () => {
    const center = gravityBlastDamage(0, GRAVITY_WELL_RADIUS, 240);
    const edge = gravityBlastDamage(GRAVITY_WELL_RADIUS, GRAVITY_WELL_RADIUS, 240);
    expect(center).toBeGreaterThan(300);
    expect(edge).toBeGreaterThan(60);
    expect(center).toBeGreaterThan(edge);
    expect(gravityBlastDamage(GRAVITY_WELL_RADIUS + 0.1, GRAVITY_WELL_RADIUS, 240)).toBe(0);
  });
});
