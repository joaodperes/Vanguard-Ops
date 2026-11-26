import { describe, expect, test } from "bun:test";
import { weaponFireIntervalMs, weaponShotReady } from "../src/lib/weapon-fire-rules";

describe("shared weapon firing cadence", () => {
  test("converts fire rates into intervals with a configurable minimum rate", () => {
    expect(weaponFireIntervalMs(5)).toBe(200);
    expect(weaponFireIntervalMs(0.25)).toBe(1000);
    expect(weaponFireIntervalMs(0.25, 0.1)).toBe(4000);
  });

  test("preserves grace tolerances used by client input and server validation", () => {
    expect(weaponShotReady(180, 0, 200, 0.9)).toBe(true);
    expect(weaponShotReady(179, 0, 200, 0.9)).toBe(false);
    expect(weaponShotReady(160, 0, 200, 0.8)).toBe(true);
  });

  test("allows the first shot and rejects invalid timing inputs", () => {
    expect(weaponShotReady(0, Number.NEGATIVE_INFINITY, 200)).toBe(true);
    expect(weaponShotReady(Number.NaN, 0, 200)).toBe(false);
    expect(weaponShotReady(200, Number.NaN, 200)).toBe(false);
    expect(weaponShotReady(200, 0, Number.NaN)).toBe(false);
  });

  test("does not allow negative tolerance to bypass cooldown", () => {
    expect(weaponShotReady(0, 0, 200, -1)).toBe(true);
    expect(weaponShotReady(199, 0, 200, 1)).toBe(false);
  });
});
