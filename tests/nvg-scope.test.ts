import { describe, expect, test } from "bun:test";
import { NVG_LENS_DIAMETER_FRACTION, nvgScopeBlend } from "../src/lib/nvg-scope-pass";

describe("NVG scope post-processing activation", () => {
  test("lens diameter matches the HUD scope", () => {
    expect(NVG_LENS_DIAMETER_FRACTION).toBe(0.70);
  });
  test("only activates for NVG while alive and ADS", () => {
    expect(nvgScopeBlend("nvg", 0.49, true)).toBe(0);
    expect(nvgScopeBlend("nvg", 1, false)).toBe(0);
    expect(nvgScopeBlend("thermal", 1, true)).toBe(0);
    expect(nvgScopeBlend("acog", 1, true)).toBe(0);
    expect(nvgScopeBlend(undefined, 1, true)).toBe(0);
    expect(nvgScopeBlend("nvg", Number.NaN, true)).toBe(0);
  });
  test("fades in with ADS progress and clamps at full strength", () => {
    expect(nvgScopeBlend("nvg", 0.5, true)).toBe(0);
    expect(nvgScopeBlend("nvg", 0.725, true)).toBeCloseTo(0.5);
    expect(nvgScopeBlend("nvg", 0.95, true)).toBeCloseTo(1);
    expect(nvgScopeBlend("nvg", 1, true)).toBe(1);
  });
});
