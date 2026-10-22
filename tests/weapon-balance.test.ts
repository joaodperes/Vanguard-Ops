import { describe, expect, test } from "bun:test";
import {
  WEAPONS, weaponById, compatibleAttachments, computeEffectiveStats, damageAtRange, maxWeaponHitRange,
} from "../src/lib/game-data";
import { attachmentChallenge } from "../src/lib/armory-challenges";

describe("weapon range and damage falloff", () => {
  test("close shots do full damage and shots at the far edge use each weapon's floor", () => {
    for (const weapon of WEAPONS.filter(w => !w.wonder && w.category !== "melee")) {
      const stats = weapon.stats;
      const full = damageAtRange(stats.damage, stats.range, stats.range, stats);
      expect(full).toBe(stats.damage);
      const far = maxWeaponHitRange(stats.range, stats);
      expect(far).toBeGreaterThan(stats.range);
      expect(damageAtRange(stats.damage, far, stats.range, stats))
        .toBeCloseTo(stats.damage * (stats.minDamageMultiplier ?? 0.4), 5);
      const halfway = (far + stats.range) / 2;
      const mid = damageAtRange(stats.damage, halfway, stats.range, stats);
      expect(mid).toBeLessThan(full);
      expect(mid).toBeGreaterThan(damageAtRange(stats.damage, far, stats.range, stats));
    }
  });

  test("assaults have shorter reach and the machine pistol loses damage sooner than the magnum", () => {
    const rifle = weaponById("rifle_ar").stats;
    const machine = weaponById("pistol_machine").stats;
    const magnum = weaponById("pistol_magnum").stats;
    expect(rifle.range).toBeLessThan(60);
    expect(machine.range).toBeLessThan(magnum.range);
    expect(maxWeaponHitRange(machine.range, machine)).toBeLessThan(maxWeaponHitRange(magnum.range, magnum));
    expect(machine.minDamageMultiplier!).toBeLessThan(magnum.minDamageMultiplier!);
  });
});

describe("unmodified sight selection", () => {
  test("removing VK-12 sight returns the default iron sight configuration", () => {
    const rifle = weaponById("rifle_ar");
    const noAttachments = { sight: null, barrel: null, grip: null, magazine: null };
    expect(rifle.baseSightType ?? "iron").toBe("iron");
    expect(computeEffectiveStats(rifle, noAttachments).sightType).toBe("iron");
    expect(computeEffectiveStats(rifle, noAttachments).range).toBe(rifle.stats.range);
  });
});

describe("interruptible incremental reload profiles", () => {
  test("all shotguns and bolt-action snipers use per-round reloads", () => {
    for (const weapon of WEAPONS.filter(w => !w.wonder && (w.category === "shotgun" || w.category === "sniper"))) {
      expect(weapon.stats.reloadStyle).toBe("incremental");
      expect(weapon.stats.reloadPerRound).toBeGreaterThan(0);
      expect(weapon.stats.reloadPerRound).toBeLessThan(weapon.stats.reloadTime);
    }
    expect(weaponById("rifle_ar").stats.reloadStyle).toBeUndefined();
  });
});

describe("attachment challenge variety", () => {
  test("magazine attachments have distinct tasks even on the Vanguard LSW", () => {
    for (const weaponId of ["lmg_light", "rifle_ar", "pistol_machine"]) {
      const ids = compatibleAttachments(weaponId, "magazine");
      expect(ids.length).toBeGreaterThanOrEqual(3);
      const signatures = ids.map(id => {
        const ch = attachmentChallenge(weaponId, id);
        expect(ch).not.toBeNull();
        return `${ch!.metric}:${ch!.goal}`;
      });
      expect(new Set(signatures).size).toBe(ids.length);
    }
  });
});
