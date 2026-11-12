import { describe, expect, test } from "bun:test";
import { ATTACHMENTS, SIGHT_DEFS, computeEffectiveStats, weaponById } from "../src/lib/game-data";
import { shotSpread } from "../src/lib/weapon-accuracy";

const empty = { sight: null, barrel: null, grip: null, magazine: null } as const;
const hunter = { ...empty, sight: "sight_hunter" };

describe("Hunter 2x scope handling / accuracy tradeoff", () => {
  test("catalog describes the faster but less precise 2x optic", () => {
    const optic = ATTACHMENTS.find(a => a.id === "sight_hunter");
    expect(optic?.effects.adsTime).toBe(-20);
    expect(optic?.effects.adsSpread).toBe(20);
    expect(SIGHT_DEFS.hunter.zoom).toBe(2);
    expect(SIGHT_DEFS.sniper_scope.zoom).toBe(6);
    expect(SIGHT_DEFS.hunter.adsSpreadFloor).toBe(0.0015);
  });

  test("all standard snipers aim 20% faster but are less precise than their factory 6x scopes", () => {
    for (const id of ["sniper_lr", "sniper_scout", "sniper_heavy"]) {
      const weapon = weaponById(id);
      const standard = computeEffectiveStats(weapon, { ...empty });
      const compact = computeEffectiveStats(weapon, hunter);
      expect(standard.sightType).toBe("sniper_scope");
      expect(compact.sightType).toBe("hunter");
      expect(compact.adsTime).toBeCloseTo(standard.adsTime * 0.8, 8);
      // Zero-spread sniper baselines must not nullify the Hunter's precision cost.
      expect(standard.adsSpread).toBe(0);
      expect(compact.adsSpread).toBeCloseTo(0.0018, 8);
      const standardShot = shotSpread(standard, weapon.category, true, 0, 0, true);
      const hunterShot = shotSpread(compact, weapon.category, true, 0, 0, true);
      expect(hunterShot).toBeGreaterThan(standardShot * 2);
      expect(compact.spread).toBe(standard.spread);
      expect(compact.damage).toBe(standard.damage);
    }
  });

  test("DMRs get the same handling advantage with worse ADS spread", () => {
    const dmr = weaponById("rifle_dm");
    const standard = computeEffectiveStats(dmr, { ...empty });
    const compact = computeEffectiveStats(dmr, hunter);
    expect(compact.adsTime).toBeCloseTo(standard.adsTime * 0.8, 8);
    expect(compact.adsSpread).toBeCloseTo(0.0018, 8);
    expect(compact.adsSpread).toBeGreaterThan(standard.adsSpread);
    expect(compact.spread).toBe(standard.spread);
  });

  test("other optics and incompatible Hunter attachments do not gain its spread floor", () => {
    const sniper = weaponById("sniper_lr");
    const stock = computeEffectiveStats(sniper, { ...empty });
    const acog = computeEffectiveStats(sniper, { ...empty, sight: "sight_acog" });
    expect(acog.adsSpread).toBe(stock.adsSpread);
    const rifle = weaponById("rifle_ar");
    const rifleStock = computeEffectiveStats(rifle, { ...empty });
    const invalidHunter = computeEffectiveStats(rifle, hunter);
    expect(invalidHunter.adsSpread).toBe(rifleStock.adsSpread);
    expect(invalidHunter.adsTime).toBe(rifleStock.adsTime);
  });
});
