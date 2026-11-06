import { weaponById } from "../src/lib/game-data";
import { describe, expect, test } from "bun:test";
import { fullWonderCharges, drainedWonderCharges, spendWonderCharge, tickWonderCharges, accelerateWonderCharge, wonderCooldownMs } from "../src/lib/wonder-charge";
import { prestigeEligible, prestigeChallengeStatus, prestigeTokens, tokenEligiblePrestiges, wonderUnlockChallenge } from "../src/lib/weapon-prestige";
import { WEAPONS, WEAPON_SKINS, compatibleAttachments, weaponAttachmentSlots } from "../src/lib/game-data";
import { allSkinChallengesForWeapon, attachmentChallenge, parseWeaponConditionStats } from "../src/lib/armory-challenges";

describe("Wonder charge economy", () => {
  const rules = { maxCharges: 2, rechargeMs: 40000, killBonusMs: 2000 };
  test("cannot reload empty Wonder charges manually; time still restores them", () => {
    const start = fullWonderCharges(rules);
    const one = spendWonderCharge(start, rules, 1000)!;
    const empty = spendWonderCharge(one, rules, 2000)!;
    expect(one.charges).toBe(1);
    expect(empty.charges).toBe(0);
    expect(spendWonderCharge(empty, rules, 3000)).toBeNull();
    // Without a new-life reset, recharge remains time-gated.
    expect(tickWonderCharges(empty, rules, 16000).charges).toBe(0);
    expect(tickWonderCharges(empty, rules, 41000).charges).toBe(1);
    expect(tickWonderCharges(empty, rules, 81000).charges).toBe(2);
  });
  test("match starts at zero; dying cannot bypass the pending timer", () => {
    const atStart=drainedWonderCharges(rules,1000);
    expect(atStart).toEqual({charges:0,nextAt:41000});
    expect(spendWonderCharge(atStart,rules,1001)).toBeNull();
    // Normal respawn is not a recharge action: the exact state persists.
    const afterDeath={...atStart};
    expect(tickWonderCharges(afterDeath,rules,16000)).toEqual(atStart);
    expect(tickWonderCharges(afterDeath,rules,40999).charges).toBe(0);
    expect(tickWonderCharges(afterDeath,rules,41000)).toEqual({charges:1,nextAt:81000});
    // Ordinary kills still accelerate the first available charge.
    expect(tickWonderCharges(accelerateWonderCharge(atStart,rules,12000),rules,39000).charges).toBe(1);
  });
  test("a loadout swap starts zero charges without changing other players' states", () => {
    const state=new Map([
      ["alice:wonder_deadlock",spendWonderCharge(fullWonderCharges(rules),rules,1000)!],
      ["bob:wonder_deadlock",fullWonderCharges(rules)],
    ]);
    const next=drainedWonderCharges(rules,5000);
    state.set("alice:wonder_deadlock",next);
    expect(next).toEqual({charges:0,nextAt:45000});
    expect(spendWonderCharge(next,rules,6000)).toBeNull();
    expect(tickWonderCharges(next,rules,45000).charges).toBe(1);
    expect(state.get("bob:wonder_deadlock")).toEqual(fullWonderCharges(rules));
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
  test("charge Wonders have finite charges; Bulwark keeps its P-9 magazine", () => {
    const wonders = WEAPONS.filter(w => w.wonder);
    expect(wonders).toHaveLength(9);
    // Plagueheart deliberately stores three charges; the runtime charge model supports it.
    expect(wonders.find(w => w.id === "wonder_corrosion")?.wonder?.maxCharges).toBe(3);
    for (const w of wonders) {
      expect(w.wonder!.maxCharges).toBeGreaterThanOrEqual(1);
      expect(w.wonder!.maxCharges).toBeLessThanOrEqual(w.id==="wonder_hellfire"?8:5);
      if(w.wonder!.kind!=="shield"){expect(w.stats.magSize).toBe(w.wonder!.maxCharges);expect(w.stats.reloadTime).toBe(0);}
      else{expect(w.stats.magSize).toBe(weaponById("pistol_side").stats.magSize);expect(w.stats.reloadTime).toBeGreaterThan(0);}
      expect(w.attachments).toEqual([]);
    }
  });
});

describe("One-time Prestige mastery", () => {
  test("Prestige requires both all ordinary skins and every compatible attachment trial", () => {
    const weapon = WEAPONS.find(w => !w.wonder && w.category === "assault")!;
    const skins = allSkinChallengesForWeapon(weapon.id);
    const allowedSkins = WEAPON_SKINS.filter(s => !s.prestige && !s.shopCurrency && s.id !== "default");
    expect(skins).toHaveLength(allowedSkins.length);
    const ownedSkins = new Set(skins.map(ch => ch.skinId));
    const attachmentIds = [...new Set(weaponAttachmentSlots(weapon).flatMap(slot => compatibleAttachments(weapon.id, slot)))];
    expect(attachmentIds.length).toBeGreaterThan(0);
    const unearned = prestigeChallengeStatus(weapon.id, { kills: 0, headshots: 0 }, ownedSkins);
    expect(unearned).toMatchObject({
      skinCompleted: 7, skinTotal: 7, attachmentCompleted: 0,
      attachmentTotal: attachmentIds.length, missingAttachmentIds: attachmentIds, eligible: false,
    });
    // Existing per-weapon purchases remain valid proof of completion.
    const ownedAttachments = new Set(attachmentIds);
    expect(prestigeEligible(weapon.id, { kills: 0, headshots: 0 }, ownedSkins, ownedAttachments)).toBe(true);
    ownedSkins.delete("arctic");
    expect(prestigeEligible(weapon.id, { kills: 0, headshots: 0 }, ownedSkins, ownedAttachments)).toBe(false);
    expect(prestigeEligible("wonder_singularity", { kills: 999999, headshots: 999999 }, ownedSkins, ownedAttachments)).toBe(false);
  });

  test("Completing attachment objectives suffices without spending credits", () => {
    const weapon = WEAPONS.find(w => !w.wonder && w.category === "assault")!;
    const skins = new Set(allSkinChallengesForWeapon(weapon.id).map(ch => ch.skinId));
    const attachmentIds = [...new Set(weaponAttachmentSlots(weapon).flatMap(slot => compatibleAttachments(weapon.id, slot)))];
    const ownedAttachments = new Set(attachmentIds.slice(1));
    const outstanding = attachmentChallenge(weapon.id, attachmentIds[0])!;
    expect(outstanding).not.toBeNull();
    const before = prestigeChallengeStatus(weapon.id, { kills: 0, headshots: 0 }, skins, ownedAttachments);
    expect(before.missingAttachmentIds).toEqual([attachmentIds[0]]);
    expect(before.eligible).toBe(false);
    const progress = {
      kills: outstanding.metric === "kills" ? outstanding.goal : 0,
      headshots: outstanding.metric === "headshots" ? outstanding.goal : 0,
      conditionStats: parseWeaponConditionStats({ [outstanding.metric]: outstanding.goal }),
    };
    expect(prestigeEligible(weapon.id, progress, skins, ownedAttachments)).toBe(true);
    const melee = WEAPONS.find(w => !w.wonder && w.category === "melee")!;
    const ownedMeleeSkins = new Set(allSkinChallengesForWeapon(melee.id).map(ch => ch.skinId));
    expect(prestigeChallengeStatus(melee.id, { kills: 0, headshots: 0 }, ownedMeleeSkins)).toMatchObject({
      attachmentTotal: 0, skinTotal: 7, completed: 7, total: 7, eligible: true,
    });
  });
  test("Prestige and Mastery skins unlock separately; their combined entitlement is unique",()=>{
    const progress={rifle_ar:{kills:150,headshots:70},smg_kp:{kills:600,headshots:330}};
    expect(tokenEligiblePrestiges(["rifle_ar","smg_kp","smg_kp"],progress)).toEqual(["smg_kp"]);
    expect(prestigeTokens(tokenEligiblePrestiges(["rifle_ar","smg_kp"],progress).length,0)).toBe(1);
    expect(tokenEligiblePrestiges(["rifle_ar"],{rifle_ar:{kills:600,headshots:330}})).toEqual(["rifle_ar"]);
    expect(tokenEligiblePrestiges(["rifle_ar"],{rifle_ar:{kills:600,headshots:329}})).toEqual([]);
  });
  test("Wonder milestone has two independent objectives and never counts as a Prestige trial",()=>{
    const initial=wonderUnlockChallenge("rifle_ar",false,0,0);
    expect(initial.progress).toBe(0);
    expect(initial.requirements.map(r=>r.progress)).toEqual([0,0]);
    const prestigeOnly=wonderUnlockChallenge("rifle_ar",true,150,70);
    expect(prestigeOnly.progress).toBe(1);
    expect(prestigeOnly.requirements.map(r=>r.progress)).toEqual([1,3]);
    // The objective title carries only the target rank; the UI renders 3/5 separately.
    expect(prestigeOnly.requirements[1]).toMatchObject({
      title: "Reach Weapon Mastery rank 5", progress: 3, goal: 5, completed: false,
    });
    const masteryOnly=wonderUnlockChallenge("rifle_ar",false,600,330);
    expect(masteryOnly.progress).toBe(1);
    expect(masteryOnly.completed).toBe(false);
    const complete=wonderUnlockChallenge("rifle_ar",true,600,330);
    expect(complete.progress).toBe(2);
    expect(complete.completed).toBe(true);
    expect(allSkinChallengesForWeapon("rifle_ar").some(c=>c.id===complete.id)).toBe(false);
    expect(wonderUnlockChallenge("wonder_singularity",true,600,330).completed).toBe(false);
    const owned=new Set(allSkinChallengesForWeapon("rifle_ar").map(c=>c.skinId));
    expect(prestigeEligible("rifle_ar",{kills:0,headshots:0},owned)).toBe(false);
  });
  test("Marksman DMR audit agrees with Prestige and Wonder eligibility", () => {
    const stats = { kills: 600, headshots: 330, conditionStats: {
      bare_kills: 999, fully_equipped_kills: 999, ads_kills: 999,
      hipfire_kills: 999, airborne_kills: 999, close_range_kills: 999,
      long_range_kills: 999, multikill_kills: 999, suppressed_kills: 999,
      critical_health_kills: 999, comeback_kills: 999,
    } };
    const status = prestigeChallengeStatus("rifle_dm", stats);
    expect(status).toMatchObject({
      skinCompleted: 7, skinTotal: 7, missingSkinIds: [],
      attachmentCompleted: status.attachmentTotal, missingAttachmentIds: [], eligible: true,
    });
    expect(status.completed).toBe(status.total);
    expect(prestigeEligible("rifle_dm", stats)).toBe(true);
    expect(tokenEligiblePrestiges(["rifle_dm"], { rifle_dm: stats })).toEqual(["rifle_dm"]);
    expect(prestigeTokens(1, 0)).toBe(1);
    expect(prestigeTokens(1, 1)).toBe(0);
    // Account-wide Weapon Master alone does NOT meet the per-weapon Prestige gate.
    const withoutCosmetics = { kills: 600, headshots: 330 };
    expect(prestigeChallengeStatus("rifle_dm", withoutCosmetics).eligible).toBe(false);
    expect(prestigeEligible("rifle_dm", withoutCosmetics)).toBe(false);
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
