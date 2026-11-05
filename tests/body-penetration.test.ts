import { describe, expect, test } from "bun:test";
import { selectBodyPenetrationHits, type BodyRayContact } from "../src/lib/body-penetration";
import { rayCombatantHit } from "../src/lib/combat-hitboxes";
import { weaponById } from "../src/lib/game-data";
import type { Vec3 } from "../src/lib/game-protocol";

const origin: Vec3 = [0, 1.16, 0];
const direction: Vec3 = [0, 0, 1];

function target(z: number, id: string, x = 0): BodyRayContact<string> | null {
  const hit = rayCombatantHit(origin, direction, [x, 0, z]);
  return hit ? { target: id, t: hit.t, head: hit.head } : null;
}

const aligned = [target(4, "front"), target(8, "middle"), target(12, "rear")]
  .filter((value): value is BodyRayContact<string> => value !== null);

describe("heavy-caliber body penetration", () => {
  test("Annihilator reaches three aligned targets with compounded damage loss", () => {
    const weapon = weaponById("sniper_heavy");
    const hits = selectBodyPenetrationHits(aligned, 200, Infinity, weapon.stats.bodyPenetration);
    expect(hits.map(h => h.target)).toEqual(["front", "middle", "rear"]);
    expect(hits.map(h => Number((weapon.stats.damage * h.damageScale).toFixed(2))))
      .toEqual([170, 110.5, 71.83]);
  });

  test("ordinary guns keep the existing first-body-only behavior", () => {
    expect(selectBodyPenetrationHits(aligned, 200, Infinity).map(h => h.target)).toEqual(["front"]);
    expect(weaponById("rifle_ar").stats.bodyPenetration).toBeUndefined();
  });

  test("map cover stops the bullet even for the Annihilator", () => {
    const hits = selectBodyPenetrationHits(aligned, 200, 6, weaponById("sniper_heavy").stats.bodyPenetration);
    expect(hits.map(h => h.target)).toEqual(["front"]);
    expect(selectBodyPenetrationHits(aligned, 200, 2, weaponById("sniper_heavy").stats.bodyPenetration)).toEqual([]);
  });

  test("intact riot shields stop penetration instead of being bypassed", () => {
    const hits = selectBodyPenetrationHits(
      [aligned[2], { ...aligned[1], shield: true }, aligned[0]], 200, Infinity,
      weaponById("sniper_heavy").stats.bodyPenetration,
    );
    expect(hits.map(h => h.target)).toEqual(["front", "middle"]);
    expect(hits[1].shield).toBe(true);
  });

  test("spawn-protected combatants intercept shots", () => {
    const hits = selectBodyPenetrationHits(
      [{ ...aligned[0], protected: true }, ...aligned.slice(1)], 200, Infinity,
      weaponById("sniper_heavy").stats.bodyPenetration,
    );
    expect(hits.map(h => h.target)).toEqual(["front"]);
  });

  test("does not hit targets outside the actual ray or range", () => {
    expect(target(8, "off-axis", 2)).toBeNull();
    expect(selectBodyPenetrationHits(aligned, 5, Infinity, weaponById("sniper_heavy").stats.bodyPenetration)
      .map(h => h.target)).toEqual(["front"]);
  });

  test("penetration capacity is bounded and per-weapon", () => {
    expect(selectBodyPenetrationHits([...aligned, { target: "fourth", t: 16, head: false }],
      200, Infinity, weaponById("sniper_heavy").stats.bodyPenetration).length).toBe(3);
    for (const id of ["sniper_lr", "sniper_scout", "dmr_heavy", "rifle_heavy", "lmg_heavy", "pistol_magnum"]) {
      const spec = weaponById(id).stats.bodyPenetration;
      expect(spec?.maxTargets).toBe(2);
      const hits = selectBodyPenetrationHits(aligned, 200, Infinity, spec);
      expect(hits.length).toBe(2);
      expect(hits[1].damageScale).toBeGreaterThan(0);
      expect(hits[1].damageScale).toBeLessThan(1);
    }
  });
});
