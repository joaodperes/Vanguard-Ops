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
    }
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
