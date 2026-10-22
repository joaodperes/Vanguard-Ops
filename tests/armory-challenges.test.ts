import { describe, expect, test } from "bun:test";
import {
  ATTACHMENTS, WEAPONS, PLAYER_SKINS, WEAPON_SKINS, WEAPON_CHALLENGES,
  compatibleAttachments, weaponAttachmentSlots,
} from "../src/lib/game-data";
import {
  attachmentChallenge, operatorContract, OPERATOR_CONTRACTS, skinChallengesForWeaponAndSkin,
  armoryChallengeProgress, WEAPON_MASTERY_TIERS, weaponMasteryProgress,
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
    const skins = PLAYER_SKINS.filter(s => s.id !== "default");
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
  });

  test("every paid weapon skin has a weapon-specific challenge", () => {
    for (const weapon of WEAPONS) {
      for (const skin of WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige)) {
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
    for (const weapon of WEAPONS) {
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
});
