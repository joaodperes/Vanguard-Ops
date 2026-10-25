import { describe, expect, test } from "bun:test";
import { WEAPONS, weaponById } from "../src/lib/game-data";
import { WEAPON_VISUALS } from "../src/lib/weapon-models";
import { fullWonderCharges, spendWonderCharge, tickWonderCharges } from "../src/lib/wonder-charge";

const VARIANTS = ["wonder_rift_needle", "wonder_miasma_bloom", "wonder_caustic_javelin"] as const;

describe("Prestige Arsenal: tactical Wonder variants", () => {
  test("every new Wonder is a unique primary, token-only, attachment-free weapon", () => {
    const ids = new Set(WEAPONS.map(w => w.id));
    expect(ids.size).toBe(WEAPONS.length);
    for (const id of VARIANTS) {
      const weapon = weaponById(id);
      expect(weapon.id).toBe(id);
      expect(weapon.wonder).toBeDefined();
      expect(weapon.unlockLevel).toBe(1);
      expect(weapon.unlockCost).toBe(0);
      expect(weapon.attachments).toEqual([]);
      expect(weapon.stats.reloadTime).toBe(0);
      expect(weapon.stats.magSize).toBe(weapon.wonder!.maxCharges);
      expect(WEAPON_VISUALS[id]).toBeDefined();
    }
  });

  test("Rift Needle trades Event Horizon's reach for greater local damage", () => {
    const original = weaponById("wonder_singularity");
    const needle = weaponById("wonder_rift_needle");
    expect(needle.wonder!.kind).toBe("singularity");
    expect(needle.wonder!.radius).toBeLessThan(original.wonder!.radius);
    expect(needle.stats.damage).toBeGreaterThan(original.stats.damage);
    expect(needle.wonder!.rechargeMs).toBeLessThan(original.wonder!.rechargeMs);
  });

  test("Miasma Bloom spreads weaker corrosion over a broader area", () => {
    const original = weaponById("wonder_corrosion");
    const bloom = weaponById("wonder_miasma_bloom");
    expect(bloom.wonder!.kind).toBe("corrosion");
    expect(bloom.wonder!.radius).toBeGreaterThan(original.wonder!.radius);
    expect(bloom.stats.damage).toBeLessThan(original.stats.damage);
    expect(bloom.wonder!.maxCharges).toBe(2);
  });

  test("Caustic Javelin prioritizes narrow burst damage and quick recharging", () => {
    const original = weaponById("wonder_corrosion");
    const javelin = weaponById("wonder_caustic_javelin");
    expect(javelin.wonder!.kind).toBe("corrosion");
    expect(javelin.wonder!.radius).toBeLessThan(original.wonder!.radius);
    expect(javelin.stats.damage).toBeGreaterThan(original.stats.damage);
    expect(javelin.wonder!.rechargeMs).toBeLessThan(original.wonder!.rechargeMs);
  });

  test("new variants consume real charges and cannot refill from manual reload", () => {
    for (const id of VARIANTS) {
      const rules = weaponById(id).wonder!;
      let state = fullWonderCharges(rules);
      for (let i = 0; i < rules.maxCharges; i++) {
        const spent = spendWonderCharge(state, rules, 1000 + i)!;
        expect(spent).not.toBeNull();
        state = spent;
      }
      expect(spendWonderCharge(state, rules, 5000)).toBeNull();
      expect(tickWonderCharges(state, rules, 9000).charges).toBe(0);
      expect(tickWonderCharges(state, rules, 1000 + rules.rechargeMs + rules.maxCharges).charges).toBeGreaterThanOrEqual(1);
    }
  });
});
