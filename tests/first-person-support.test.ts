import { describe, expect, test } from "bun:test";
import { supportActionWeight, supportHandRestMode } from "../src/lib/first-person-animation";

describe("first-person support hand", () => {
  test("supports ranged guns during idle, fire, ADS and sprint", () => {
    for (const category of ["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "sidearm"]) {
      expect(supportHandRestMode(category, false, false)).toBe("weapon");
    }
  });
  test("keeps melee one-handed and places Bulwark hand on its intact shield", () => {
    expect(supportHandRestMode("melee", false, false)).toBe("none");
    expect(supportHandRestMode("sidearm", true, true)).toBe("shield");
    expect(supportHandRestMode("sidearm", true, false)).toBe("weapon");
  });
  test("transitions smoothly between steady grip and equipment/reload animation", () => {
    expect(supportActionWeight(-1)).toBe(0);
    expect(supportActionWeight(0)).toBe(0);
    expect(supportActionWeight(.5)).toBe(1);
    expect(supportActionWeight(1)).toBe(0);
    expect(supportActionWeight(2)).toBe(0);
    expect(supportActionWeight(.08)).toBeGreaterThan(0);
    expect(supportActionWeight(.08)).toBeLessThan(1);
    expect(supportActionWeight(.92)).toBeGreaterThan(0);
    expect(supportActionWeight(.92)).toBeLessThan(1);
    for (let p = 0; p <= 1; p += .01) {
      expect(supportActionWeight(p)).toBeGreaterThanOrEqual(0);
      expect(supportActionWeight(p)).toBeLessThanOrEqual(1);
    }
  });
});
