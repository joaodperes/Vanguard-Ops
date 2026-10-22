import { describe, expect, test } from "bun:test";
import { DEFAULT_PERK_ID, PERKS, perkById, perkUnlocked, perkSelection } from "../src/lib/perks";
import { WEAPONS, computeEffectiveStats, compatibleAttachments, attachmentById, type AttachmentSlot } from "../src/lib/game-data";

describe("level-ordered passive perk unlocks", () => {
  test("Battle-Hardened is the initial free perk", () => {
    expect(DEFAULT_PERK_ID).toBe("battle_hardened");
    expect(PERKS[0].id).toBe(DEFAULT_PERK_ID);
    expect(PERKS[0].unlockLevel).toBe(1);
    expect(perkById("unknown").id).toBe(DEFAULT_PERK_ID);
    expect(perkSelection(1)).toBe(DEFAULT_PERK_ID);
  });

  test("all perk levels are ordered and occupy no normal weapon unlock level", () => {
    const available = WEAPONS.filter(w => !w.wonder).map(w => w.unlockLevel);
    for (let i = 1; i < PERKS.length; i++) {
      expect(PERKS[i].unlockLevel).toBeGreaterThan(PERKS[i - 1].unlockLevel);
      expect(available).not.toContain(PERKS[i].unlockLevel);
      expect(perkUnlocked(PERKS[i].id, PERKS[i].unlockLevel - 1)).toBe(false);
      expect(perkUnlocked(PERKS[i].id, PERKS[i].unlockLevel)).toBe(true);
    }
    expect(perkUnlocked("battle_hardened", 1)).toBe(true);
  });
});

describe("attachment-adjusted weapon stat previews", () => {
  test("the displayed value uses the same effective-stat calculator as gameplay", () => {
    const w = WEAPONS.find(w => w.id === "rifle_ar")!;
    const empty: Record<AttachmentSlot, string | null> = { sight: null, barrel: null, grip: null, magazine: null };
    const available = compatibleAttachments(w.id, "magazine");
    const item = available.map(id => attachmentById(id)).find(a => a?.effects.magSize);
    expect(item).toBeDefined();
    const equipped = { ...empty, magazine: item!.id };
    const base = computeEffectiveStats(w, empty);
    const final = computeEffectiveStats(w, equipped);
    expect(final.magSize).not.toBe(base.magSize);
    expect(final.damage).toBe(base.damage);
    expect(computeEffectiveStats(w, empty).magSize).toBe(base.magSize);
  });
});
