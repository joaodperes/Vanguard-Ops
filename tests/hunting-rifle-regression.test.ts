import { describe, expect, test } from "bun:test";
import { computeEffectiveStats, damageAtRange, weaponById } from "../src/lib/game-data";
import { reloadMotionFor } from "../src/lib/first-person-animation";

describe("Hunting Rifle reload and damage", () => {
  const rifle = weaponById("sniper_scout");
  const stats = computeEffectiveStats(rifle);

  test("keeps bolt cycling separate from the magazine reload animation", () => {
    expect(reloadMotionFor(rifle.id, rifle.category, rifle.special?.kind)).toBe("magazine");
  });

  test("cannot kill a full-health 100 HP target with a single body hit", () => {
    const bodyDamage = damageAtRange(stats.damage, 0, stats.range, stats);
    const headDamage = damageAtRange(stats.damage * stats.headshotMult, 0, stats.range, stats);
    expect(stats.damage).toBe(95);
    expect(bodyDamage).toBeLessThan(100);
    expect(headDamage).toBeGreaterThanOrEqual(100);
  });
});
