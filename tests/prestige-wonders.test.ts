import { describe, expect, test } from "bun:test";
import { fullWonderCharges, spendWonderCharge, tickWonderCharges, accelerateWonderCharge, wonderCooldownMs } from "../src/lib/wonder-charge";
import { prestigeEligible, prestigeTokens, tokenEligiblePrestiges } from "../src/lib/weapon-prestige";
import { WEAPONS, WEAPON_SKINS } from "../src/lib/game-data";
import { allSkinChallengesForWeapon, parseWeaponConditionStats } from "../src/lib/armory-challenges";

describe("Wonder charge economy", () => {
  const rules = { maxCharges: 2, rechargeMs: 40000, killBonusMs: 2000 };
  test("never spends a third bullet; reload or death cannot refill charges", () => {
    const start = fullWonderCharges(rules);
    const one = spendWonderCharge(start, rules, 1000)!;
    const empty = spendWonderCharge(one, rules, 2000)!;
    expect(one.charges).toBe(1);
    expect(empty.charges).toBe(0);
    expect(spendWonderCharge(empty, rules, 3000)).toBeNull();
    // Same object and timestamp after a simulated death/respawn.
    expect(tickWonderCharges(empty, rules, 16000).charges).toBe(0);
    expect(tickWonderCharges(empty, rules, 41000).charges).toBe(1);
    expect(tickWonderCharges(empty, rules, 81000).charges).toBe(2);
  });
  test("three-charge weapons consume and recover one charge at a time", () => {
    const triple = { maxCharges: 3, rechargeMs: 10000, killBonusMs: 1000 };
    const first = spendWonderCharge(fullWonderCharges(triple), triple, 1000)!;
    expect(first.charges).toBe(2);
    const second = spendWonderCharge(first, triple, 2000)!;
    const third = spendWonderCharge(second, triple, 3000)!;
    expect(third.charges).toBe(0);
    expect(spendWonderCharge(third, triple, 4000)).toBeNull();
    expect(tickWonderCharges(third, triple, 11000).charges).toBe(1);
    expect(tickWonderCharges(third, triple, 21000).charges).toBe(2);
    expect(tickWonderCharges(third, triple, 31000).charges).toBe(3);
  });
  test("ordinary kills accelerate only pending recharge without free overflow", () => {
    const empty = spendWonderCharge(fullWonderCharges(rules), rules, 1000)!;
    const shorter = accelerateWonderCharge(empty, rules, 5000);
    expect(wonderCooldownMs(shorter, rules, 5000)).toBe(34000);
    expect(shorter.charges).toBe(1);
    expect(accelerateWonderCharge(fullWonderCharges(rules), rules, 9000).charges).toBe(2);
  });
  test("all Wonder Weapons have finite charges and no manual reload", () => {
    const wonders = WEAPONS.filter(w => w.wonder);
    expect(wonders).toHaveLength(7);
    // Plagueheart deliberately stores three charges; the runtime charge model supports it.
    expect(wonders.find(w => w.id === "wonder_corrosion")?.wonder?.maxCharges).toBe(3);
    for (const w of wonders) {
      expect(w.wonder!.maxCharges).toBeGreaterThanOrEqual(1);
      expect(w.wonder!.maxCharges).toBeLessThanOrEqual(w.id==="wonder_hellfire"?8:5);
      expect(w.stats.magSize).toBe(w.wonder!.maxCharges);
      expect(w.stats.reloadTime).toBe(0);
      expect(w.attachments).toEqual([]);
    }
  });
});

describe("One-time Prestige mastery", () => {
  test("all ordinary skin trials must complete, not merely Gold", () => {
    const weapon = WEAPONS.find(w => !w.wonder && w.category === "assault")!;
    const all = allSkinChallengesForWeapon(weapon.id);
    const allowedSkins = WEAPON_SKINS.filter(s => !s.prestige && s.id !== "default");
    expect(all).toHaveLength(allowedSkins.length);
    const owned = new Set(all.map(ch => ch.skinId));
    expect(prestigeEligible(weapon.id, { kills: 0, headshots: 0 }, owned)).toBe(true);
    owned.delete("arctic");
    expect(prestigeEligible(weapon.id, { kills: 0, headshots: 0 }, owned)).toBe(false);
    expect(prestigeEligible("wonder_singularity", { kills: 999999, headshots: 999999 }, owned)).toBe(false);
  });
  test("Prestige and Mastery skins unlock separately; their combined entitlement is unique",()=>{
    const progress={rifle_ar:{kills:150,headshots:25},smg_kp:{kills:600,headshots:110}};
    expect(tokenEligiblePrestiges(["rifle_ar","smg_kp","smg_kp"],progress)).toEqual(["smg_kp"]);
    expect(prestigeTokens(tokenEligiblePrestiges(["rifle_ar","smg_kp"],progress).length,0)).toBe(1);
    expect(tokenEligiblePrestiges(["rifle_ar"],{rifle_ar:{kills:600,headshots:110}})).toEqual(["rifle_ar"]);
    expect(tokenEligiblePrestiges(["rifle_ar"],{rifle_ar:{kills:600,headshots:109}})).toEqual([]);
  });
  test("token balance is awards minus lifetime purchases (no double claim)", () => {
    expect(prestigeTokens(0, 0)).toBe(0);
    expect(prestigeTokens(2, 1)).toBe(1);
    expect(prestigeTokens(2, 2)).toBe(0);
    expect(prestigeTokens(1, 2)).toBe(0);
    const g = allSkinChallengesForWeapon("rifle_ar").find(c => c.skinId === "gold")!;
    expect(g.requirements).toHaveLength(3);
    expect(parseWeaponConditionStats("{}").bare_kills).toBe(0);
  });
});
