import { describe, expect, test } from "bun:test";
import { WEAPONS, compatibleAttachments, weaponAttachmentSlots } from "../src/lib/game-data";
import { attachmentChallenge, armoryChallengeProgress, WEAPON_CONDITION_METRICS } from "../src/lib/armory-challenges";
import { attachmentViewPermissions, showPendingAttachmentChallenge } from "../src/lib/armory-attachment-browse";

describe("Armory attachment browsing permissions", () => {
  test("owned but unequipped weapons may browse and buy, but cannot equip attachments", () => {
    const reaver = WEAPONS.find(w => w.name === "Reaver BR");
    expect(reaver).toBeDefined();
    const allowed = compatibleAttachments(reaver!.id, "sight");
    expect(allowed.length).toBeGreaterThan(0);
    expect(attachmentViewPermissions(reaver!.id, "rifle_ar", true)).toEqual({ canEquip: false, canPurchase: true });
  });
  test("unowned weapons remain browsable but require ownership before purchase", () => {
    expect(attachmentViewPermissions("rifle_heavy", "rifle_ar", false)).toEqual({ canEquip: false, canPurchase: false });
  });
  test("only the active owned weapon can equip or remove attachments", () => {
    expect(attachmentViewPermissions("rifle_ar", "rifle_ar", true)).toEqual({ canEquip: true, canPurchase: true });
  });
  test("every compatible sight, barrel, grip and magazine hides completed challenges while retaining eligibility", () => {
    const covered = { sight: 0, barrel: 0, grip: 0, magazine: 0 };
    for (const weapon of WEAPONS.filter(w => !w.wonder)) {
      for (const slot of weaponAttachmentSlots(weapon)) {
        for (const id of compatibleAttachments(weapon.id, slot)) {
          const challenge = attachmentChallenge(weapon.id, id);
          expect(challenge).not.toBeNull();
          const goal = challenge!.goal;
          const empty = armoryChallengeProgress(challenge!, {
            kills: 0, headshots: 0, wins: 0, matches: 0, totalKills: 0, totalHeadshots: 0,
          });
          const complete = armoryChallengeProgress(challenge!, {
            kills: goal, headshots: goal, wins: goal, matches: goal, totalKills: goal, totalHeadshots: goal,
            conditionStats: Object.fromEntries(WEAPON_CONDITION_METRICS.map(metric => [metric, goal])),
          });
          expect(empty.completed).toBe(false);
          expect(showPendingAttachmentChallenge(false, empty.completed)).toBe(true);
          expect(complete.completed).toBe(true);
          expect(showPendingAttachmentChallenge(false, complete.completed)).toBe(false);
          expect(showPendingAttachmentChallenge(true, empty.completed)).toBe(false);
          expect(showPendingAttachmentChallenge(true, complete.completed)).toBe(false);
          covered[slot]++;
        }
      }
    }
    for (const count of Object.values(covered)) expect(count).toBeGreaterThan(0);
    expect(showPendingAttachmentChallenge(false, undefined)).toBe(false);
  });
});
