import { explonandoDamage, explonandoCanHit, EXPLO_FUSE_MS } from "../src/lib/explonando";
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

  test("perk choices arrive every three levels and end with the new perks", () => {
    expect(PERKS.map(p => p.unlockLevel)).toEqual([1,4,7,10,13,16,19,22,25,28]);
    expect(PERKS.at(-2)?.id).toBe("explonando");
    expect(PERKS.at(-1)?.id).toBe("well_prepared");
    for (let i = 1; i < PERKS.length; i++) {
      expect(PERKS[i].unlockLevel - PERKS[i-1].unlockLevel).toBe(3);
      expect(perkUnlocked(PERKS[i].id, PERKS[i].unlockLevel - 1)).toBe(false);
      expect(perkUnlocked(PERKS[i].id, PERKS[i].unlockLevel)).toBe(true);
    }
  });
  test("common weapons unlock before rare, then epic and legendary", () => {
    const weapons = WEAPONS.filter(w => !w.wonder);
    const group = (min: number, max: number) => weapons.filter(w => w.unlockCost >= min && w.unlockCost < max);
    const common = group(0,800), rare = group(800,2000), epic = group(2000,3500), legendary = group(3500,Infinity);
    expect(Math.max(...common.map(w=>w.unlockLevel))).toBeLessThan(Math.min(...rare.map(w=>w.unlockLevel)));
    expect(Math.max(...rare.map(w=>w.unlockLevel))).toBeLessThan(Math.min(...epic.map(w=>w.unlockLevel)));
    expect(Math.max(...epic.map(w=>w.unlockLevel))).toBeLessThan(Math.min(...legendary.map(w=>w.unlockLevel)));
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

describe("Explonando and Well Prepared gameplay rules", () => {
  test("death charge has a two-second fuse and falloff", () => {
    expect(EXPLO_FUSE_MS).toBe(2000);
    expect(explonandoDamage(0)).toBeGreaterThan(explonandoDamage(2));
    expect(explonandoDamage(5)).toBe(0);
    expect(explonandoDamage(Infinity)).toBe(0);
  });
  test("death charges do not hit owner or allies", () => {
    expect(explonandoCanHit("tdm","red","red","friend","owner")).toBe(false);
    expect(explonandoCanHit("tdm","blue","red","enemy","owner")).toBe(true);
    expect(explonandoCanHit("ffa","ffa","ffa","enemy","owner")).toBe(true);
    expect(explonandoCanHit("ffa","ffa","ffa","owner","owner")).toBe(false);
  });
});
