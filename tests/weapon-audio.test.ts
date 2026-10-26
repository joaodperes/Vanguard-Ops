import { describe, expect, test } from "bun:test";
import { resolveShotAcoustics } from "../src/lib/weapon-audio";

describe("Weapon audio — gunshot dynamics", () => {
  test("unsuppressed shots retain a bright, immediate muzzle crack", () => {
    for (const category of ["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "pistol", "pdw"] as const) {
      const shot = resolveShotAcoustics(category);
      expect(shot.cutoffHz).toBeNull();
      expect(shot.crackLevel).toBeGreaterThan(.5);
      expect(shot.crackSeconds).toBeLessThan(.045);
      expect(shot.punchLevel).toBeGreaterThan(0);
    }
  });

  test("a real suppressor strongly reduces and filters the crack", () => {
    const loud = resolveShotAcoustics("assault");
    const quiet = resolveShotAcoustics("assault", { suppressed: true });
    expect(quiet.cutoffHz).toBeLessThanOrEqual(1400);
    expect(quiet.level).toBeLessThan(loud.level * .5);
    expect(quiet.crackLevel).toBeLessThan(loud.crackLevel * .04);
    expect(quiet.punchLevel).toBeLessThan(loud.punchLevel);
  });

  test("shotguns and snipers have deeper, longer pressure pulses than SMGs", () => {
    const smg = resolveShotAcoustics("smg");
    const shotgun = resolveShotAcoustics("shotgun");
    const sniper = resolveShotAcoustics("sniper");
    expect(shotgun.punchHz).toBeLessThan(smg.punchHz);
    expect(sniper.punchHz).toBeLessThan(smg.punchHz);
    expect(shotgun.punchSeconds).toBeGreaterThan(smg.punchSeconds * 2);
    expect(sniper.punchLevel).toBeGreaterThan(smg.punchLevel * 2);
  });

  test("special weapons retain their individual electronic or quiet character", () => {
    const normal = resolveShotAcoustics("assault", { weaponId: "rifle_ar" });
    const electron = resolveShotAcoustics("assault", { weaponId: "rifle_electron" });
    const crossbow = resolveShotAcoustics("dmr", { weaponId: "crossbow_reclaimer" });
    expect(electron.crackLevel).toBeLessThan(normal.crackLevel);
    expect(crossbow.crackLevel).toBeLessThan(.2);
    expect(resolveShotAcoustics("melee").crackLevel).toBe(0);
  });

  test("nearby enemies remain identifiable, distant gunfire fades and darkens", () => {
    const near = resolveShotAcoustics("pistol", { distance: 5 });
    const mid = resolveShotAcoustics("pistol", { distance: 30 });
    const far = resolveShotAcoustics("pistol", { distance: 90 });
    expect(near.cutoffHz).toBeNull();
    expect(mid.cutoffHz).toBeLessThan(8500);
    expect(mid.level).toBeLessThan(near.level);
    expect(far.level).toBe(0);
  });

  test("mix volume still mutes all shot layers", () => {
    const muted = resolveShotAcoustics("shotgun", { volume: 0 });
    expect(muted.level).toBe(0);
    expect(muted.crackLevel).toBe(0);
    expect(muted.punchLevel).toBe(0);
  });
});
