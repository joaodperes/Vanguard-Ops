import { describe, expect, test } from "bun:test";
import {
  GRAVITY_WELL_DURATION_MS, GRAVITY_WELL_RADIUS,
  gravityTravelMs, gravityPullOffset, gravityBlastDamage, gravityClientTime,
} from "../src/lib/gravity-well";

describe("Event Horizon timing", () => {
  test("has visible projectile travel before its separate pull and explosion phases", () => {
    expect(gravityTravelMs(0)).toBe(100);
    expect(gravityTravelMs(50)).toBe(300);
    expect(gravityTravelMs(200)).toBe(600);
    expect(GRAVITY_WELL_DURATION_MS).toBe(1800);
  });
});

describe("Event Horizon network clock synchronization",()=>{
  test("preserves the full pull window when the client clock is ahead or behind",()=>{
    const sent=1_500_000,clientNow=sent+65_000;
    const starts=sent+300,expires=starts+GRAVITY_WELL_DURATION_MS;
    const localStart=gravityClientTime(starts,sent,clientNow);
    const localEnd=gravityClientTime(expires,sent,clientNow);
    expect(localStart-clientNow).toBe(300);
    expect(localEnd-localStart).toBe(1800);
    const behind=sent-28_000;
    expect(gravityClientTime(starts,sent,behind)-behind).toBe(300);
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
    expect(gravityPullOffset([0, 1, 0], [12, 0, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
    expect(gravityPullOffset([0, 1, 0], [4, 9, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
    expect(gravityPullOffset([0, 1, 0], [0.2, 0, 0], GRAVITY_WELL_RADIUS, 0.05)).toEqual([0, 0]);
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
