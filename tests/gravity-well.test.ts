import { describe, expect, test } from "bun:test";
import {
  GRAVITY_WELL_DURATION_MS, GRAVITY_WELL_RADIUS,
  gravityTravelMs, gravityPullOffset, gravityBlastDamage, gravityClientTime, gravityImpact, gravityTargetDistance,
} from "../src/lib/gravity-well";

describe("Event Horizon timing", () => {
  test("has visible projectile travel before its separate pull and explosion phases", () => {
    expect(gravityTravelMs(0)).toBe(65);
    expect(gravityTravelMs(50)).toBe(150);
    expect(gravityTravelMs(200)).toBe(280);
    expect(GRAVITY_WELL_DURATION_MS).toBe(1050);
  });
});

describe("Event Horizon network clock synchronization",()=>{
  test("preserves the full pull window when the client clock is ahead or behind",()=>{
    const sent=1_500_000,clientNow=sent+65_000;
    const starts=sent+150,expires=starts+GRAVITY_WELL_DURATION_MS;
    const localStart=gravityClientTime(starts,sent,clientNow);
    const localEnd=gravityClientTime(expires,sent,clientNow);
    expect(localStart-clientNow).toBe(150);
    expect(localEnd-localStart).toBe(1050);
    const behind=sent-28_000;
    expect(gravityClientTime(starts,sent,behind)-behind).toBe(150);
  });
});

describe("Event Horizon gravitational pull", () => {
  test("draws targets toward the orb without overshooting its center", () => {
    const [x, z] = gravityPullOffset([0, 1, 0], [8, 0, 0], GRAVITY_WELL_RADIUS, 0.05);
    expect(x).toBeLessThan(0);
    expect(z).toBe(0);
    expect(x).toBeGreaterThan(-8);
  });
  test("pulls strongly enough to close distance during the shortened vortex", () => {
    const pull = gravityPullOffset([0, 1, 0], [8, 0, 0], GRAVITY_WELL_RADIUS, 0.05);
    expect(Math.hypot(...pull)).toBeGreaterThan(1.5);
  });
  test("does not pull targets outside the field or from a distant floor", () => {
    expect(gravityPullOffset([0, 1, 0], [12, 0, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
    expect(gravityPullOffset([0, 1, 0], [4, 9, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
    expect(gravityPullOffset([0, 1, 0], [0.2, 0, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
  });
});

describe("Event Horizon floor-safe projectile endpoints", () => {
  test("downward shot stops at or above the surface instead of falling through it", () => {
    const impact = gravityImpact([0, 1.7, 0], [0, -1, 0], 95);
    expect(impact).toEqual([0, 1, 0]);
  });
  test("steep downward trajectory intersects the floor before weapon range", () => {
    const impact = gravityImpact([0, 1.7, 0], [0, -0.5, 0.8660254], 95);
    expect(impact[1]).toBe(1);
    expect(impact[2]).toBeCloseTo(1.21243556, 4);
  });
  test("cover and direct-hit stops are preserved", () => {
    expect(gravityImpact([0, 2, 0], [0, 0, 1], 4)).toEqual([0, 2, 4]);
    expect(gravityImpact([0, 2, 0], [0, -0.5, 0.8660254], 1)).toEqual([0, 1.5, 0.8660254]);
  });
});

describe("Event Horizon detonation", () => {
  test("delivers lethal damage near the core and still hurts across the wide radius", () => {
    const center = gravityBlastDamage(0, GRAVITY_WELL_RADIUS, 240);
    const edge = gravityBlastDamage(GRAVITY_WELL_RADIUS, GRAVITY_WELL_RADIUS, 240);
    expect(center).toBeGreaterThan(300);
    expect(edge).toBeLessThan(30);
    expect(gravityBlastDamage(2, GRAVITY_WELL_RADIUS, 240)).toBeGreaterThan(gravityBlastDamage(7, GRAVITY_WELL_RADIUS, 240));
    expect(center).toBeGreaterThan(edge);
    expect(gravityBlastDamage(GRAVITY_WELL_RADIUS + 0.1, GRAVITY_WELL_RADIUS, 240)).toBe(0);
  });
});

describe("Event Horizon aim proximity", () => {
  const origin = [0, 1.6, 0];
  const direction = [0, 0, 1];
  test("catches a slightly missed enemy before the far wall", () => {
    expect(gravityTargetDistance(origin, direction, [[1.2, 0.9, 12]], 36)).toBeCloseTo(11.4);
  });
  test("never locks onto an enemy behind solid cover or out of range", () => {
    expect(gravityTargetDistance(origin, direction, [[1, 0.9, 20]], 10)).toBeNull();
    expect(gravityTargetDistance(origin, direction, [[0, 0.9, 50]], 36)).toBeNull();
  });
  test("rejects players outside the gravity orb's acquisition tolerance", () => {
    expect(gravityTargetDistance(origin, direction, [[4, 0.9, 12]], 36)).toBeNull();
  });
  test("selects the nearest valid enemy along the ray", () => {
    expect(gravityTargetDistance(origin, direction, [[0.5, 0.9, 24], [1, 0.9, 10]], 36)).toBeCloseTo(9.4);
  });
});
