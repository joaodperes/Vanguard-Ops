import { describe, expect, test } from "bun:test";
import { ATTACHMENTS, WEAPONS, compatibleAttachments, computeEffectiveStats } from "../src/lib/game-data";
import { shotSpread } from "../src/lib/weapon-accuracy";

const precisionWeapons = WEAPONS.filter(w => (w.category === "dmr" || w.category === "sniper") && !w.wonder && !w.disabled);
const EMPTY = { sight: null, barrel: null, grip: null, magazine: null } as const;

describe("precision-class attachment choices", () => {
  test("DMRs and snipers do not offer hipfire-focused grips or barrels", () => {
    for (const weapon of precisionWeapons) {
      const available = (["sight", "barrel", "grip", "magazine"] as const)
        .flatMap(slot => compatibleAttachments(weapon.id, slot));
      for (const inappropriate of ["grip_angled", "grip_runner_ads", "grip_laser", "sight_laser", "barrel_ported"]) {
        expect(available).not.toContain(inappropriate);
      }
      expect(compatibleAttachments(weapon.id, "grip")).toContain("grip_marksman_quick");
      expect(compatibleAttachments(weapon.id, "grip")).toContain("grip_patrol");
    }
  });


  test("every DMR and sniper has at least four viable attachments per supported slot", () => {
    for (const weapon of precisionWeapons) {
      for (const slot of (["sight", "barrel", "grip", "magazine"] as const)) {
        if (weapon.attachments && !weapon.attachments.includes(slot)) continue;
        const valid = compatibleAttachments(weapon.id, slot);
        expect(valid.length).toBeGreaterThanOrEqual(4);
        expect(new Set(valid).size).toBe(valid.length);
      }
    }
  });

  test("patrol grip trades recoil and ADS speed for mobility without boosting hipfire", () => {
    const patrol = ATTACHMENTS.find(a => a.id === "grip_patrol");
    expect(patrol?.effects).toEqual({ moveSpeed: 7, recoil: 16, adsTime: 8 });
    for (const weapon of precisionWeapons) {
      const stock = computeEffectiveStats(weapon, { ...EMPTY });
      const modified = computeEffectiveStats(weapon, { ...EMPTY, grip: "grip_patrol" });
      expect(modified.moveSpeed).toBeGreaterThan(stock.moveSpeed);
      expect(modified.recoil).toBeGreaterThan(stock.recoil);
      expect(modified.adsTime).toBeGreaterThan(stock.adsTime);
      expect(modified.spread).toBe(stock.spread);
      expect(modified.adsSpread).toBe(stock.adsSpread);
    }
  });

  test("snipers have extreme stationary hipfire dispersion but retain scoped precision", () => {
    for (const weapon of precisionWeapons.filter(w => w.category === "sniper")) {
      const hip = shotSpread(weapon.stats, weapon.category, false, 0, 0, false);
      const scoped = shotSpread(weapon.stats, weapon.category, true, 0, 0, true);
      // The floor is doubled from 0.12; all snipers inherit the same intentional penalty.
      expect(hip).toBeCloseTo(0.24 * 1.9, 5);
      expect(scoped).toBeCloseTo(Math.max(0.0007, weapon.stats.adsSpread) * 1.1, 6);
      expect(hip).toBeGreaterThan(scoped * 50);
    }
  });

  test("Scout Tactical has a 14-round magazine with meaningful attachment tradeoffs", () => {
    const scout = WEAPONS.find(w => w.id === "dmr_scout");
    expect(scout).toBeDefined();
    if (!scout) return;
    expect(scout.category).toBe("dmr");
    expect(scout.stats.auto).toBe(false);
    expect(scout.stats.magSize).toBe(14);
    expect(scout.stats.damage).toBe(49);
    expect(computeEffectiveStats(scout, { ...EMPTY }).magSize).toBe(14);
    expect(computeEffectiveStats(scout, { ...EMPTY, magazine: "mag_extended" }).magSize).toBe(18);
    expect(computeEffectiveStats(scout, { ...EMPTY, magazine: "mag_balanced" }).magSize).toBe(16);
    expect(computeEffectiveStats(scout, { ...EMPTY, magazine: "mag_quickdraw" }).magSize).toBe(13);
    expect(computeEffectiveStats(scout, { ...EMPTY, magazine: "mag_lightweight" }).magSize).toBe(11);
    expect(computeEffectiveStats(scout, { ...EMPTY, magazine: "mag_penetrator" }).magSize).toBe(11);
  });

  test("quick-set grip is a faster-ADS/recoil tradeoff, with no hipfire bonus", () => {
    const quick = ATTACHMENTS.find(a => a.id === "grip_marksman_quick");
    expect(quick?.effects).toEqual({ adsTime: -18, recoil: 12 });
    for (const weapon of precisionWeapons) {
      const stock = computeEffectiveStats(weapon, { ...EMPTY });
      const modified = computeEffectiveStats(weapon, { ...EMPTY, grip: "grip_marksman_quick" });
      expect(modified.adsTime).toBeLessThan(stock.adsTime);
      expect(modified.recoil).toBeGreaterThan(stock.recoil);
      expect(modified.spread).toBe(stock.spread);
      expect(modified.adsSpread).toBe(stock.adsSpread);
    }
  });

  test("class-specific hipfire floors make small raw spread bonuses ineffective", () => {
    for (const weapon of precisionWeapons) {
      const before = shotSpread(weapon.stats, weapon.category, false, 0, 0, false);
      const after = shotSpread({ ...weapon.stats, spread: weapon.stats.spread * 0.5 }, weapon.category, false, 0, 0, false);
      expect(after).toBe(before);
    }
  });
});
