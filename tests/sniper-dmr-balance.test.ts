import { describe, expect, test } from "bun:test";
import { WEAPONS, ATTACHMENTS, compatibleAttachments, computeEffectiveStats, type AttachmentSlot } from "../src/lib/game-data";
import { reloadMotionFor, sampleReloadMotion } from "../src/lib/first-person-animation";

const empty: Record<AttachmentSlot, string | null> = { sight: null, barrel: null, grip: null, magazine: null };
const weapon = (id: string) => WEAPONS.find(w => w.id === id && !w.wonder)!;
const stats = (id: string, barrel: string | null = null) =>
  computeEffectiveStats(weapon(id), { ...empty, barrel });

describe("sniper and DMR balance", () => {
  test("Hunting Rifle has optional optics, empty-clip reloads and a bolt cycle after every shot", () => {
    const rifle = weapon("sniper_scout");
    const s = stats("sniper_scout");
    expect(rifle.category).toBe("sniper");
    expect(rifle.baseSightType).toBe("iron");
    expect(rifle.attachments).toContain("sight");
    expect(compatibleAttachments(rifle.id, "sight").length).toBeGreaterThan(0);
    expect(s.reloadOnlyWhenEmpty).toBe(true);
    expect(reloadMotionFor(rifle.id, rifle.category, rifle.special?.kind)).toBe("bolt_action");
    expect(sampleReloadMotion(0.35, "bolt_action").propVisible).toBe(true);
    expect(sampleReloadMotion(0.35, "bolt_action").hand[2]).toBeGreaterThan(-0.18);
    expect(compatibleAttachments(rifle.id, "magazine")).not.toContain("mag_penetrator");
    expect(s.damage).toBe(100);
    expect(s.damage * s.headshotMult).toBe(200);
    expect(s.bodyPenetration).toBeUndefined();
    expect(s.coverPenetration).toBeLessThanOrEqual(1);
    expect(s.fireRate).toBeLessThan(0.8);
    expect(s.magSize).toBe(5);
    expect(weapon("dmr_heavy").stats.reloadOnlyWhenEmpty).toBe(true);
    expect(s.range).toBeLessThan(weapon("sniper_lr").stats.range);
  });

  test("DMRs cannot kill a full-health target with one headshot or a two-round burst", () => {
    for (const id of ["dmr_scout", "dmr_cyclone", "dmr_whisper", "rifle_dm", "dmr_heavy"]) {
      const s = stats(id);
      expect(s.damage * s.headshotMult).toBeLessThan(100);
    }
    const cyclone = stats("dmr_cyclone");
    expect(cyclone.damage * cyclone.headshotMult * 2).toBeLessThan(100);
    expect(stats("rifle_dm").damage * stats("rifle_dm").headshotMult).toBeLessThan(100);
    expect(stats("dmr_heavy").damage * stats("dmr_heavy").headshotMult).toBeLessThan(100);
  });

  test("Match Barrel gives DMRs a precision trade-off and remains available to snipers", () => {
    const barrel = ATTACHMENTS.find(a => a.id === "barrel_match")!;
    expect(barrel.effects.adsSpread).toBe(-30);
    expect(barrel.effects.recoil).toBe(-5);
    expect(barrel.effects.adsTime).toBe(12);
    for (const id of ["sniper_scout", "sniper_lr", "sniper_heavy", "dmr_scout", "dmr_cyclone", "dmr_whisper", "rifle_dm", "dmr_heavy"]) {
      expect(compatibleAttachments(id, "barrel")).toContain("barrel_match");
    }
  });
});
