import { describe, test, expect } from "bun:test";
import { corrosionImpactDamage, corrosionTickDamage, corrosionImpactDistance, CORROSION_DURATION_MS, CORROSION_TICK_MS } from "../src/lib/corrosion-damage";
import { weaponById } from "../src/lib/game-data";

describe("Plagueheart poison-first damage", () => {
  test("poison radius applies at detonation, not along a 60m projectile path", () => {
    const radius = weaponById("wonder_corrosion").wonder!.radius;
    expect(radius).toBeCloseTo(2.75);
    expect(corrosionImpactDistance([0,1,60],[0,1,59])).toBeLessThan(radius);
    expect(corrosionImpactDistance([0,1,60],[0,1,30])).toBeGreaterThan(radius);
    expect(corrosionImpactDistance([0,1,60],[0,1,0])).toBeGreaterThan(radius);
  });
  test("full-health targets survive a direct splash and even three immediate hits", () => {
    const damage = weaponById("wonder_corrosion").stats.damage;
    const direct = corrosionImpactDamage(damage, 1.2);
    expect(direct).toBeLessThan(20);
    expect(direct * 3).toBeLessThan(100);
    expect(corrosionImpactDamage(damage, .1)).toBeLessThan(direct);
  });
  test("corrosion takes multiple timed ticks to defeat an unprotected target", () => {
    const damage = weaponById("wonder_corrosion").stats.damage;
    const tick = corrosionTickDamage(damage);
    expect(CORROSION_TICK_MS).toBe(500);
    expect(CORROSION_DURATION_MS / CORROSION_TICK_MS).toBeGreaterThanOrEqual(12);
    expect(tick).toBeGreaterThan(5);
    expect(tick).toBeLessThan(15);
    expect(corrosionImpactDamage(damage, 1.2) + tick).toBeLessThan(35);
    expect(corrosionImpactDamage(damage, 1.2) + 13 * tick).toBeGreaterThan(100);
    expect(weaponById("wonder_singularity").stats.damage).toBeGreaterThan(damage);
  });
});
