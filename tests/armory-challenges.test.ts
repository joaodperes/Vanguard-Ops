import { describe, expect, test } from "bun:test";
import {
  ATTACHMENTS, WEAPONS, PLAYER_SKINS, WEAPON_SKINS, WEAPON_CHALLENGES,
  compatibleAttachments, weaponAttachmentSlots,
} from "../src/lib/game-data";
import {
  attachmentChallenge, operatorContract, OPERATOR_CONTRACTS, skinChallengesForWeaponAndSkin,
  armoryChallengeProgress, WEAPON_MASTERY_TIERS, weaponMasteryProgress, weaponMasteryTiers,
  WEAPON_CONDITION_METRICS, parseWeaponConditionStats, weaponChallengeProgress,
} from "../src/lib/armory-challenges";

describe("permanent challenge-based Armory eligibility", () => {
  test("every compatible weapon attachment has an achievable challenge", () => {
    let count = 0;
    const keys = new Set<string>();
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      for (const slot of weaponAttachmentSlots(weapon)) {
        for (const attachmentId of compatibleAttachments(weapon.id, slot)) {
          const att = ATTACHMENTS.find(a => a.id === attachmentId)!;
          const challenge = attachmentChallenge(weapon.id, attachmentId);
          expect(challenge).not.toBeNull();
          expect(challenge?.goal).toBeGreaterThan(0);
          expect(challenge?.weaponId).toBe(weapon.id);
          expect(challenge?.rewardId).toBe(attachmentId);
          expect(["kills", "headshots", ...WEAPON_CONDITION_METRICS]).toContain(challenge?.metric);
          // Acquiring the last missing attachment must never require owning it already.
          expect(challenge?.metric).not.toBe("fully_equipped_kills");
          expect(keys.has(challenge!.id)).toBe(false);
          keys.add(challenge!.id);
          // Ownership prices are the existing catalog values (no cost redesign).
          expect(att.unlockCost).toBeGreaterThan(0);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(80);
  });

  test("challenge completion changes eligibility, not ownership or player level", () => {
    const weapon = WEAPONS.find(w => weaponAttachmentSlots(w).includes("sight") &&
      compatibleAttachments(w.id, "sight").length)!;
    const id = compatibleAttachments(weapon.id, "sight")[0];
    const ch = attachmentChallenge(weapon.id, id)!;
    const stats = { kills: 0, headshots: 0, wins: 0, matches: 0,
      totalKills: 0, totalHeadshots: 0, conditionStats: parseWeaponConditionStats({}) };
    expect(armoryChallengeProgress(ch, stats).completed).toBe(false);
    if (ch.metric === "kills" || ch.metric === "headshots") stats[ch.metric] = ch.goal;
    else if (ch.metric in stats) (stats as Record<string, unknown>)[ch.metric] = ch.goal;
    else (stats.conditionStats as Record<string, number>)[ch.metric] = ch.goal;
    expect(armoryChallengeProgress(ch, stats).completed).toBe(true);
    expect("unlockLevel" in ch).toBe(false);
    expect(attachmentChallenge("not-a-weapon", id)).toBeNull();
  });

  test("each nonstandard operator appearance has a separate contract", () => {
    const skins = PLAYER_SKINS.filter(s => s.id !== "default" && !s.shopCurrency && !s.levelReward);
    expect(OPERATOR_CONTRACTS).toHaveLength(skins.length);
    expect(new Set(OPERATOR_CONTRACTS.map(ch => ch.rewardId)).size).toBe(skins.length);
    for (const skin of skins) {
      const ch = operatorContract(skin.id);
      expect(ch?.goal).toBeGreaterThan(0);
      expect(ch?.kind).toBe("operator");
      expect(ch?.rewardId).toBe(skin.id);
      expect(skin.unlockCost).toBeGreaterThan(0);
    }
    expect(operatorContract("default")).toBeNull();
    expect(operatorContract("ascendant_vanguard")).toBeNull(); // Level-cap reward needs no contract.
  });

  test("every paid weapon skin has a weapon-specific challenge", () => {
    // Wonder weapons use their own prestige progression and have no paid skins.
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      for (const skin of WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency)) {
        const challenges = skinChallengesForWeaponAndSkin(weapon.id, skin.id);
        expect(challenges.length).toBeGreaterThanOrEqual(1);
        expect(skin.unlockCost).toBeGreaterThan(0);
      }
    }
  });

  test("condition counters reject malformed data and preserve stable zeros", () => {
    expect(parseWeaponConditionStats("{}").bare_kills).toBe(0);
    expect(parseWeaponConditionStats("invalid JSON").airborne_kills).toBe(0);
    const values = parseWeaponConditionStats({ bare_kills: 13.8, ads_kills: -5, invented: 99 });
    expect(values.bare_kills).toBe(13);
    expect(values.ads_kills).toBe(0);
    expect(Object.keys(values).sort()).toEqual([...WEAPON_CONDITION_METRICS].sort());
  });

  test("high-tier Gold mastery demands multiple different tactics", () => {
    const metrics = new Set<string>();
    let goldCount = 0;
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      for (const skin of WEAPON_SKINS.filter(s => s.id !== "default")) {
        for (const ch of skinChallengesForWeaponAndSkin(weapon.id, skin.id)) {
          metrics.add(ch.metric);
        }
      }
      const gold = skinChallengesForWeaponAndSkin(weapon.id, "gold")[0];
      expect(gold.requirements?.length).toBe(3);
      expect(new Set(gold.requirements!.map(r => r.metric)).size).toBe(3);
      const none = weaponChallengeProgress(gold, { kills: 100000, headshots: 100000 });
      expect(none.completed).toBe(false);
      const conditionStats = parseWeaponConditionStats(
        Object.fromEntries(gold.requirements!.map(r => [r.metric, r.goal])),
      );
      const ready = weaponChallengeProgress(gold, { kills: 100000, headshots: 100000, conditionStats });
      expect(ready.completed).toBe(true);
      expect(ready.steps).toHaveLength(3);
      goldCount++;
    }
    expect(goldCount).toBe(WEAPONS.filter(w => !w.wonder).length);
    expect(metrics.size).toBeGreaterThanOrEqual(6);
  });

  test("Tactical Knife has seven achievable skins and no impossible headshot trials", () => {
    const knife = WEAPONS.find(w => w.id === "knife_tactical")!;
    expect(knife.category).toBe("melee");
    const skins = WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency);
    expect(skins).toHaveLength(7);
    for (const skin of skins) {
      const trials = skinChallengesForWeaponAndSkin(knife.id, skin.id);
      expect(trials).toHaveLength(1);
      expect(trials[0].metric).not.toBe("headshots");
      expect(trials[0].requirements?.some(r => r.metric === "headshots")).not.toBe(true);
      const metrics = parseWeaponConditionStats(Object.fromEntries(WEAPON_CONDITION_METRICS.map(metric => [metric, 100000])));
      expect(weaponChallengeProgress(trials[0], { kills: 100000, headshots: 0, conditionStats: metrics }).completed).toBe(true);
    }
    expect(weaponMasteryProgress(600,0,knife.id).rank).toBe(5);
  });
  test("higher firearm mastery ranks have significant precision requirements", () => {
    expect(WEAPON_MASTERY_TIERS.map(t => t.kills)).toEqual([20,60,150,300,600]);
    expect(WEAPON_MASTERY_TIERS.map(t => t.headshots)).toEqual([0,25,70,150,330]);
    expect(weaponMasteryProgress(600,110,"rifle_dm").rank).toBe(3);
    expect(weaponMasteryProgress(600,329,"rifle_dm").rank).toBe(4);
    expect(weaponMasteryProgress(600,330,"rifle_dm").rank).toBe(5);
  });
  test("weapon mastery is permanent and monotonic", () => {
    expect(WEAPON_MASTERY_TIERS).toHaveLength(5);
    expect(weaponMasteryProgress(0, 0).rank).toBe(0);
    let previous = 0;
    for (const t of WEAPON_MASTERY_TIERS) {
      const state = weaponMasteryProgress(t.kills, t.headshots);
      expect(state.rank).toBeGreaterThan(previous);
      expect(state.title).toBe(t.title);
      previous = state.rank;
    }
    expect(weaponMasteryProgress(5000, 1000).next).toBeNull();
  });

  test("every precision rifle trial stays compatible with accurate long-range play", () => {
    const unsuited = ["hipfire_kills", "close_range_kills", "airborne_kills", "multikill_kills"];
    for (const weapon of WEAPONS.filter(w => w.category === "sniper" || w.category === "dmr")) {
      for (const slot of weaponAttachmentSlots(weapon)) {
        for (const id of compatibleAttachments(weapon.id, slot)) {
          expect(unsuited).not.toContain(attachmentChallenge(weapon.id, id)?.metric);
        }
      }
      for (const skin of WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency)) {
        for (const trial of skinChallengesForWeaponAndSkin(weapon.id, skin.id)) {
          for (const metric of trial.requirements?.map(r => r.metric) ?? [trial.metric]) {
            expect(unsuited).not.toContain(metric);
          }
        }
      }
    }
  });

  test("close-combat, launchers, and LMGs never require impossible precision or jump trials", () => {
    for (const weapon of WEAPONS.filter(w => ["shotgun", "launcher", "melee", "lmg"].includes(w.category))) {
      const skinMetrics = WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency)
        .flatMap(s => skinChallengesForWeaponAndSkin(weapon.id, s.id))
        .flatMap(ch => ch.requirements?.map(r => r.metric) ?? [ch.metric]);
      if (["melee", "shotgun", "launcher"].includes(weapon.category)) {
        expect(skinMetrics).not.toContain("headshots");
      }
      if (weapon.category === "launcher") {
        expect(skinMetrics).not.toContain("airborne_kills");
        expect(skinMetrics).not.toContain("close_range_kills");
      }
      if (weapon.category === "lmg") expect(skinMetrics).not.toContain("airborne_kills");
      for (const slot of weaponAttachmentSlots(weapon)) {
        for (const id of compatibleAttachments(weapon.id, slot)) {
          const metric = attachmentChallenge(weapon.id, id)?.metric;
          if (weapon.category === "launcher") expect(["headshots", "airborne_kills", "close_range_kills"]).not.toContain(metric);
          if (weapon.category === "lmg") expect(metric).not.toBe("airborne_kills");
        }
      }
    }
  });

  test("all Gold trials remain three-part and achievable without a forbidden mechanic", () => {
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      const challenge = skinChallengesForWeaponAndSkin(weapon.id, "gold")[0];
      expect(challenge.requirements?.length).toBe(3);
      const metrics = challenge.requirements!.map(r => r.metric);
      expect(new Set(metrics).size).toBe(3);
      expect(challenge.requirements!.every(r => r.goal > 0)).toBe(true);
      if (weapon.category === "melee") {
        expect(metrics).toEqual(["close_range_kills", "comeback_kills", "multikill_kills"]);
      }
      if (weapon.category === "launcher") {
        expect(metrics).toEqual(["multikill_kills", "bare_kills", "ads_kills"]);
      }
      const stats = parseWeaponConditionStats(Object.fromEntries(metrics.map(m => [m, 100000])));
      expect(weaponChallengeProgress(challenge, { kills: 100000, headshots: 100000, conditionStats: stats }).completed).toBe(true);
    }
  });

  test("class-specific mastery removes impossible headshot gates without diluting precision rifles", () => {
    const expected: Record<string, number> = {
      assault: 170, smg: 110, shotgun: 0, dmr: 330, sniper: 330,
      lmg: 120, pistol: 175, pdw: 100, launcher: 0, melee: 0,
    };
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      const tiers = weaponMasteryTiers(weapon.id);
      expect(tiers.map(t => t.kills)).toEqual([20, 60, 150, 300, 600]);
      expect(tiers[4].headshots).toBe(expected[weapon.category]);
      expect(tiers.every((tier, i) => i === 0 || tier.headshots >= tiers[i - 1].headshots)).toBe(true);
      expect(weaponMasteryProgress(600, expected[weapon.category], weapon.id).rank).toBe(5);
      if (["melee", "shotgun", "launcher"].includes(weapon.category)) {
        expect(weaponMasteryProgress(600, 0, weapon.id).rank).toBe(5);
      }
    }
  });

  test("attachment trials diversify weapon-wide, with meaningful repeat tiers", () => {
    const situational = new Set(["airborne_kills", "multikill_kills", "comeback_kills"]);
    let weaponCount = 0;
    let attachmentCount = 0;
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      const trials = weaponAttachmentSlots(weapon).flatMap(slot =>
        compatibleAttachments(weapon.id, slot).map(id => attachmentChallenge(weapon.id, id)!));
      if (!trials.length) continue;
      weaponCount++;
      attachmentCount += trials.length;
      const metrics = new Set(trials.map(ch => ch.metric));
      expect(metrics.size).toBeGreaterThanOrEqual(Math.min(4, trials.length));
      for (const metric of metrics) {
        const goals = trials.filter(ch => ch.metric === metric).map(ch => ch.goal).sort((a, b) => a - b);
        for (let index = 1; index < goals.length; index++) {
          // Two unlocks requiring the same action should not differ by
          // only a kill or two (the previous generator could do exactly that).
          expect(goals[index] - goals[index - 1]).toBeGreaterThanOrEqual(situational.has(metric) ? 4 : 9);
        }
      }
      for (const trial of trials) {
        // Anything requiring unusual circumstances must remain reasonable even
        // when the attachment is expensive or sits late in a slot's list.
        if (situational.has(trial.metric)) expect(trial.goal).toBeLessThanOrEqual(25);
        if (trial.metric === "long_range_kills") expect(trial.goal).toBeLessThanOrEqual(50);
        if (weapon.category === "sniper" || weapon.category === "dmr") {
          expect(["hipfire_kills", "close_range_kills", "airborne_kills", "multikill_kills"]).not.toContain(trial.metric);
        }
        if (weapon.category === "shotgun") {
          expect(["headshots", "long_range_kills"]).not.toContain(trial.metric);
        }
        if (weapon.category === "launcher") {
          expect(["headshots", "close_range_kills", "airborne_kills", "long_range_kills"]).not.toContain(trial.metric);
        }
        expect(trial.description).toContain(String(trial.goal));
      }
    }
    expect(weaponCount).toBeGreaterThan(20);
    expect(attachmentCount).toBeGreaterThan(500);
  });

});
