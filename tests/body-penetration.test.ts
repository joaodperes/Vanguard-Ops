import { describe, expect, test } from "bun:test";
import { selectBodyPenetrationHits, type BodyRayContact } from "../src/lib/body-penetration";
import { rayCombatantHit } from "../src/lib/combat-hitboxes";
import { weaponById, computeEffectiveStats, compatibleAttachments, type AttachmentSlot } from "../src/lib/game-data";
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
    for (const id of ["sniper_lr", "sniper_scout", "dmr_heavy", "rifle_hydra", "lmg_hv", "pistol_magnum"]) {
      const spec = weaponById(id).stats.bodyPenetration;
      expect(spec?.maxTargets).toBe(2);
      const hits = selectBodyPenetrationHits(aligned, 200, Infinity, spec);
      expect(hits.length).toBe(2);
      expect(hits[1].damageScale).toBeGreaterThan(0);
      expect(hits[1].damageScale).toBeLessThan(1);
    }
  });
});

describe("built-in penetration and Penetrator Rounds", () => {
  const empty: Record<AttachmentSlot, string | null> = {
    sight: null, barrel: null, grip: null, magazine: null,
  };
  const penAmmo = { ...empty, magazine: "mag_penetrator" };

  test("Hydra and Hailstorm replace Behemoth and Leviathan as innate penetrators", () => {
    expect(weaponById("rifle_hydra").stats.bodyPenetration).toEqual({ maxTargets: 2, damageRetention: 0.3 });
    expect(weaponById("lmg_hv").stats.bodyPenetration).toEqual({ maxTargets: 2, damageRetention: 0.25 });
    expect(weaponById("rifle_heavy").stats.bodyPenetration).toBeUndefined();
    expect(weaponById("lmg_heavy").stats.bodyPenetration).toBeUndefined();
    expect(weaponById("rifle_hydra").stats.auto).toBe(false);
    expect(weaponById("rifle_hydra").stats.burst).toBe(2);
    expect(weaponById("lmg_hv").stats.auto).toBe(true);
  });

  test("Penetrator Rounds grant a second-body hit without breaking VK-12 three-shot body TTK", () => {
    const w = weaponById("rifle_ar");
    expect(compatibleAttachments(w.id, "magazine")).toContain("mag_penetrator");
    const before = computeEffectiveStats(w, empty);
    const after = computeEffectiveStats(w, penAmmo);
    expect(before.bodyPenetration).toBeUndefined();
    expect(after.bodyPenetration).toEqual({ maxTargets: 2, damageRetention: 0.35 });
    expect(after.damage).toBe(34);
    expect(before.damage).toBe(35);
    expect(after.damage * 3).toBeGreaterThanOrEqual(100);
    expect(after.damage).toBeLessThan(before.damage);
    // 24-round VK-12 base with -20% Penetrator capacity now yields 19 rounds.
    expect(before.magSize).toBe(24);
    expect(after.magSize).toBe(19);
    expect(after.recoil).toBeGreaterThan(before.recoil);
    expect(selectBodyPenetrationHits(aligned, 200, Infinity, after.bodyPenetration).length).toBe(2);
  });

  test("magazine boosts second-body damage retention on naturally penetrating guns", () => {
    for (const [id, expected] of [
      ["rifle_hydra", 0.45], ["lmg_hv", 0.40], ["sniper_lr", 0.70],
      ["dmr_heavy", 0.55],
    ] as const) {
      const w = weaponById(id);
      const upgraded = computeEffectiveStats(w, penAmmo);
      expect(compatibleAttachments(id, "magazine")).toContain("mag_penetrator");
      expect(upgraded.bodyPenetration?.maxTargets).toBe(2);
      expect(upgraded.bodyPenetration?.damageRetention).toBeCloseTo(expected);
      expect(upgraded.damage).toBeLessThan(w.stats.damage);
      expect(upgraded.magSize).toBeLessThan(w.stats.magSize);
    }
  });

  test("Leviathan and Behemoth can opt into penetration through ammunition", () => {
    for (const id of ["lmg_heavy", "rifle_heavy"]) {
      const w = weaponById(id);
      expect(w.stats.bodyPenetration).toBeUndefined();
      expect(computeEffectiveStats(w, penAmmo).bodyPenetration).toEqual({
        maxTargets: 2, damageRetention: 0.35,
      });
    }
  });

  test("ineligible weapons cannot list or gain Penetrator Rounds, even with a forged loadout", () => {
    for (const id of [
      "smg_kp", "shotgun_br", "pistol_magnum", "launcher_rocket",
      "sniper_heavy", "crossbow_reclaimer", "rifle_electron", "dmr_cyclone",
    ]) {
      const w = weaponById(id);
      expect(compatibleAttachments(id, "magazine")).not.toContain("mag_penetrator");
      const before = computeEffectiveStats(w, empty);
      const after = computeEffectiveStats(w, penAmmo);
      expect(after.bodyPenetration).toEqual(before.bodyPenetration);
      expect(after.damage).toBe(before.damage);
      expect(after.magSize).toBe(before.magSize);
    }
    expect(computeEffectiveStats(weaponById("sniper_heavy"), empty).bodyPenetration)
      .toEqual({ maxTargets: 3, damageRetention: 0.65 });
  });
});
