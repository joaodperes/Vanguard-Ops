import { describe, expect, test } from "bun:test";
import { formatSpreadMrad } from "../src/lib/weapon-numbers";
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
