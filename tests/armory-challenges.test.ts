import { describe, expect, test } from "bun:test";
import {
  ATTACHMENTS, WEAPONS, PLAYER_SKINS, WEAPON_SKINS, WEAPON_CHALLENGES,
  compatibleAttachments, weaponAttachmentSlots,
} from "../src/lib/game-data";
import {
  attachmentChallenge, operatorContract, OPERATOR_CONTRACTS, skinChallengesForWeaponAndSkin,
  armoryChallengeProgress, WEAPON_MASTERY_TIERS, weaponMasteryProgress,
} from "../src/lib/armory-challenges";

describe("permanent challenge-based Armory eligibility", () => {
  test("every compatible weapon attachment has an achievable challenge", () => {
    let count = 0;
    const keys = new Set<string>();
    for (const weapon of WEAPONS) {
      for (const slot of weaponAttachmentSlots(weapon)) {
        for (const attachmentId of compatibleAttachments(weapon.id, slot)) {
          const att = ATTACHMENTS.find(a => a.id === attachmentId)!;
          const challenge = attachmentChallenge(weapon.id, attachmentId);
          expect(challenge).not.toBeNull();
          expect(challenge?.goal).toBeGreaterThan(0);
          expect(challenge?.weaponId).toBe(weapon.id);
          expect(challenge?.rewardId).toBe(attachmentId);
          expect(["kills", "headshots"]).toContain(challenge?.metric);
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
    const stats = { kills: 0, headshots: 0, wins: 0, matches: 0, totalKills: 0, totalHeadshots: 0 };
    expect(armoryChallengeProgress(ch, stats).completed).toBe(false);
    stats[ch.metric] = ch.goal;
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
      for (const skin of WEAPON_SKINS.filter(s => s.id !== "default")) {
        const challenges = skinChallengesForWeaponAndSkin(weapon.id, skin.id);
        expect(challenges.length).toBeGreaterThanOrEqual(1);
        expect(skin.unlockCost).toBeGreaterThan(0);
      }
    }
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
