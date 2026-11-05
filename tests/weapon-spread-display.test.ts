import { describe, expect, test } from "bun:test";
import { formatSpreadMrad, weaponStatDelta } from "../src/lib/weapon-numbers";
import { shotSpread } from "../src/lib/weapon-accuracy";

describe("weapon spread display", () => {
  test("makes small base values readable without changing their meaning", () => {
    expect(formatSpreadMrad(0.007)).toBe("7.0");
    expect(formatSpreadMrad(0.002)).toBe("2.0");
    expect(formatSpreadMrad(0.0015)).toBe("1.5");
    expect(formatSpreadMrad(0)).toBe("0.0");
    expect(formatSpreadMrad(Number.NaN)).toBe("—");
  });

  test("presentation conversion is independent from live shot dispersion", () => {
    const stats = { spread: 0.007, adsSpread: 0.002 };
    // Actual standing first-shot dispersion still includes category floors and multipliers.
    const hip = shotSpread(stats, "assault", false, 0, 0, false);
    const ads = shotSpread(stats, "assault", true, 0, 0, true);
    expect(hip).toBeCloseTo(0.0228, 6);
    expect(ads).toBeCloseTo(0.0022, 6);
    formatSpreadMrad(stats.spread);
    formatSpreadMrad(stats.adsSpread);
    expect(shotSpread(stats, "assault", false, 0, 0, false)).toBe(hip);
    expect(shotSpread(stats, "assault", true, 0, 0, true)).toBe(ads);
  });
});

describe("attachment stat comparisons", () => {
  test("lower ADS spread is a green decrease, not an increase", () => {
    expect(weaponStatDelta(0.002, 0.00148, true)).toEqual({
      changed: true, improved: true, arrow: "▼", percent: 26,
    });
  });

  test("slower ADS time is a red increase, not a decrease", () => {
    expect(weaponStatDelta(0.28, 0.3528, true)).toEqual({
      changed: true, improved: false, arrow: "▲", percent: 26,
    });
  });

  test("faster ADS time and increased damage are both improvements", () => {
    expect(weaponStatDelta(0.35, 0.28, true)).toMatchObject({ improved: true, arrow: "▼", percent: 20 });
    expect(weaponStatDelta(25, 30, false)).toMatchObject({ improved: true, arrow: "▲", percent: 20 });
  });

  test("unchanged stats do not display a change", () => {
    expect(weaponStatDelta(2, 2, true)).toMatchObject({ changed: false, arrow: "", percent: 0 });
  });
});
