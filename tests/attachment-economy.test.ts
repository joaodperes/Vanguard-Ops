import { describe, expect, test } from "bun:test";
import { ATTACHMENTS, computeEffectiveStats, compatibleAttachments, weaponById } from "../src/lib/game-data";
import { achievementRequirement } from "../src/lib/achievement-titles";

describe("attachment identity and economy", () => {
  test("Ported Barrel rewards close-range mobility, Compensator controls recoil", () => {
    const weapon = weaponById("smg_kp");
    expect(compatibleAttachments(weapon.id, "barrel")).toContain("barrel_ported");
    expect(compatibleAttachments(weapon.id, "barrel")).toContain("barrel_compensator");
    const stats = (barrel: string) => computeEffectiveStats(weapon, { sight: null, barrel, grip: null, magazine: null });
    const ported = stats("barrel_ported"), comp = stats("barrel_compensator");
    expect(comp.recoil).toBeLessThan(ported.recoil);
    expect(ported.adsTime).toBeLessThan(comp.adsTime);
    expect(ported.spread).toBeLessThan(comp.spread);
    expect(ported.range).toBeLessThan(comp.range);
  });
  test("late special attachments cost hundreds instead of thousands", () => {
    const late = ATTACHMENTS.filter(a => a.unlockLevel >= 18);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every(a => a.unlockCost >= 350 && a.unlockCost <= 850)).toBe(true);
    expect(Math.max(...ATTACHMENTS.map(a => a.unlockCost))).toBeLessThanOrEqual(850);
  });
  test("Reaper and other unlocked achievements explain requirements", () => {
    expect(achievementRequirement("kills_2000")).toBe("Get 2000 kills");
    expect(achievementRequirement("kills_2000", "Reach 2000 eliminations")).toBe("Reach 2000 eliminations");
    expect(achievementRequirement("unknown")).toBeNull();
  });
});
