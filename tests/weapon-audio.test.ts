import { describe, expect, test } from "bun:test";
import { resolveShotAcoustics, weaponAcousticSpace, recordedFamilyFor, resolveRecordedMix } from "../src/lib/weapon-audio";
import weapons from "../src/data/catalogs/weapons.json";

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

  test("Mauler CS has an unfiltered, short, punchy shotgun blast", () => {
    const maulerCatalog = weapons.find((weapon) => weapon.id === "shotgun_combat");
    expect(maulerCatalog?.name).toBe("Mauler CS");
    expect(maulerCatalog?.category).toBe("shotgun");

    const mauler = resolveShotAcoustics("shotgun", { weaponId: "shotgun_combat" });
    const breacher = resolveShotAcoustics("shotgun", { weaponId: "shotgun_br" });
    expect(mauler.suppressed).toBe(false);
    expect(mauler.cutoffHz).toBeNull();
    expect(mauler.crackLevel).toBeGreaterThan(breacher.crackLevel);
    expect(mauler.crackSeconds).toBeLessThan(breacher.crackSeconds);
    expect(mauler.blastLevel).toBeGreaterThan(breacher.blastLevel);
    expect(mauler.blastHighpassHz).toBeLessThan(350);
    expect(mauler.blastLowpassHz).toBeGreaterThanOrEqual(11000);
    expect(mauler.blastSeconds).toBeLessThan(.12);
    expect(breacher.blastLevel).toBeGreaterThan(.75);
  });

  test("shotgun blast stays quiet when genuinely suppressed", () => {
    const bare = resolveShotAcoustics("shotgun", { weaponId: "shotgun_combat" });
    const suppressed = resolveShotAcoustics("shotgun", { weaponId: "shotgun_combat", suppressed: true });
    expect(suppressed.cutoffHz).toBeLessThan(1500);
    expect(suppressed.blastLevel).toBeLessThan(bare.blastLevel * .05);
    expect(suppressed.crackLevel).toBeLessThan(bare.crackLevel * .04);
    expect(resolveShotAcoustics("shotgun", { weaponId: "wonder_corrosion" }).blastLevel).toBe(0);
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

  test("Hellfire has no ballistic crack, shotgun blast or pressure pulse", () => {
    const flame=resolveShotAcoustics("lmg",{weaponId:"wonder_hellfire"});
    const ordinary=resolveShotAcoustics("lmg",{weaponId:"lmg_hv"});
    expect(flame.crackLevel).toBe(0);
    expect(flame.punchLevel).toBe(0);
    expect(flame.blastLevel).toBe(0);
    expect(ordinary.crackLevel).toBeGreaterThan(.5);
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
    expect(muted.blastLevel).toBe(0);
  });
  test("bare muzzle reports gain bass and treble without making suppressed weapons louder", () => {
    const open = resolveShotAcoustics("assault", { weaponId: "rifle_ar" });
    const suppressed = resolveShotAcoustics("assault", { weaponId: "rifle_ar", suppressed: true });
    expect(open.punchLevel).toBeGreaterThan(.65);
    expect(open.crackLevel).toBeGreaterThan(1.1);
    expect(suppressed.punchLevel).toBeLessThan(open.punchLevel * .3);
    expect(suppressed.crackLevel).toBeLessThan(open.crackLevel * .04);
    expect(resolveShotAcoustics("sniper").punchLevel).toBeGreaterThan(open.punchLevel);
    expect(resolveShotAcoustics("assault", { weaponId: "rifle_electron" }).crackLevel)
      .toBeLessThan(open.crackLevel * .5);
  });

  test("conventional guns have independent midrange report and action layers", () => {
    for (const cat of ["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "pistol", "pdw"] as const) {
      const shot = resolveShotAcoustics(cat);
      expect(shot.reportLevel).toBeGreaterThan(.4);
      expect(shot.mechanicalLevel).toBeGreaterThan(.1);
      expect(shot.reportSeconds).toBeGreaterThan(shot.crackSeconds);
    }
  });

  test("real suppressors attenuate report and tail but retain audible action", () => {
    const bare = resolveShotAcoustics("assault");
    const quiet = resolveShotAcoustics("assault", { suppressed: true });
    expect(quiet.reportLevel).toBeLessThan(bare.reportLevel * .03);
    expect(quiet.tailLevel).toBeLessThan(bare.tailLevel * .10);
    expect(quiet.mechanicalLevel / quiet.level).toBeGreaterThan(bare.mechanicalLevel / bare.level);
  });

  test("map environments select distinct delayed tails", () => {
    expect(weaponAcousticSpace("bunker")).toBe("indoor");
    expect(weaponAcousticSpace("floodgate")).toBe("urban");
    expect(weaponAcousticSpace("forest_warfare")).toBe("outdoor");
    const indoor = resolveShotAcoustics("sniper", { environment: "indoor" });
    const urban = resolveShotAcoustics("sniper", { environment: "urban" });
    const open = resolveShotAcoustics("sniper", { environment: "outdoor" });
    expect(indoor.tailLevel).toBeGreaterThan(urban.tailLevel);
    expect(urban.tailLevel).toBeGreaterThan(open.tailLevel);
    expect(indoor.tailDelay).toBeLessThan(open.tailDelay);
    expect(open.tailSeconds).toBeGreaterThan(indoor.tailSeconds);
  });

  test("experimental weapons retain special quiet and electronic identities", () => {
    for (const [cat, id] of [["assault", "rifle_electron"], ["pistol", "pistol_arc"], ["lmg", "wonder_hellfire"]] as const) {
      const shot = resolveShotAcoustics(cat, { weaponId: id });
      expect(shot.reportLevel).toBe(0);
      expect(shot.mechanicalLevel).toBe(0);
      expect(shot.tailLevel).toBe(0);
    }
    expect(resolveShotAcoustics("dmr", { weaponId: "crossbow_reclaimer" }).mechanicalLevel).toBeGreaterThan(0);
  });
  test("recorded CC0 takes cover three ballistic weapon families without replacing Wonder Weapons", () => {
    expect(recordedFamilyFor("pistol", "pistol_side")).toBe("p226");
    expect(recordedFamilyFor("smg", "smg_kp")).toBe("mp5");
    expect(recordedFamilyFor("pdw", "pdw_raptor")).toBe("mp5");
    expect(recordedFamilyFor("shotgun", "shotgun_br")).toBe("sg");
    expect(recordedFamilyFor("shotgun", "shotgun_combat")).toBe("sg");
    expect(recordedFamilyFor("assault", "rifle_ar")).toBe("rifle556");
    expect(recordedFamilyFor("assault", "rifle_falcon")).toBe("rifle762");
    expect(recordedFamilyFor("dmr", "rifle_dm")).toBe("rifle762");
    expect(recordedFamilyFor("sniper", "sniper_lr")).toBe("rifle762");
    expect(recordedFamilyFor("lmg", "lmg_hv")).toBe("rifle556");
    expect(recordedFamilyFor("pistol", "pistol_arc")).toBeNull();
    expect(recordedFamilyFor("dmr", "crossbow_reclaimer")).toBeNull();
    expect(recordedFamilyFor("lmg", "wonder_hellfire")).toBeNull();
    expect(recordedFamilyFor("melee", "knife_tactical")).toBeNull();
  });

  test("snipers and DMRs have single-report excerpts instead of rifle burst loops", () => {
    const annihilator = resolveRecordedMix("sniper", "sniper_heavy");
    const longshot = resolveRecordedMix("sniper", "sniper_lr");
    const executioner = resolveRecordedMix("dmr", "dmr_heavy");
    expect(annihilator.family).toBe("rifle762");
    expect(annihilator.duration).toBeLessThan(.11);
    expect(longshot.duration).toBeLessThan(.11);
    expect(executioner.duration).toBeLessThan(.10);
    // Playback speed must remain natural, regardless of fire rate.
    expect(annihilator.rate).toBe(1);
    expect(executioner.rate).toBe(1);
    expect(annihilator.body).toBeGreaterThan(longshot.body);
    const heavy = resolveShotAcoustics("sniper", { weaponId: "sniper_heavy" });
    const normal = resolveShotAcoustics("sniper", { weaponId: "sniper_lr" });
    expect(heavy.punchHz).toBeLessThan(normal.punchHz);
    expect(heavy.punchSeconds).toBeGreaterThan(normal.punchSeconds);
  });

  test("standard pistols, revolver and Magnum use distinct sampled and synthesized identities", () => {
    const p9 = resolveRecordedMix("pistol", "pistol_side");
    const revolver = resolveRecordedMix("pistol", "pistol_bastion");
    const magnum = resolveRecordedMix("pistol", "pistol_magnum");
    expect(p9.family).toBe("p226");
    expect(revolver.family).toBe("p226");
    expect(magnum.family).toBe("rifle762");
    expect(revolver.rate).toBeLessThan(p9.rate);
    expect(magnum.duration).toBeLessThan(p9.duration);
    expect(revolver.synthetic).toBeGreaterThan(p9.synthetic);
    const regular = resolveShotAcoustics("pistol", { weaponId: "pistol_side" });
    const rev = resolveShotAcoustics("pistol", { weaponId: "pistol_bastion" });
    const fifty = resolveShotAcoustics("pistol", { weaponId: "pistol_magnum" });
    expect(rev.mechanicalHz).toBeLessThan(regular.mechanicalHz);
    expect(rev.mechanicalDelay).toBeGreaterThan(regular.mechanicalDelay);
    expect(fifty.punchHz).toBeLessThan(rev.punchHz);
    expect(fifty.punchLevel).toBeGreaterThan(rev.punchLevel);
    expect(fifty.crackLevel).toBeGreaterThan(regular.crackLevel);
  });

  test("LMGs do not fast-forward or stack rifle samples for every automatic shot", () => {
    const hailstorm = resolveRecordedMix("lmg", "lmg_hv");
    const leviathan = resolveRecordedMix("lmg", "lmg_heavy");
    const vk12 = resolveRecordedMix("assault", "rifle_ar");
    expect(hailstorm.family).toBe("rifle556");
    expect(hailstorm.rate).toBe(1);
    expect(leviathan.rate).toBe(1);
    expect(hailstorm.duration).toBeLessThan(.06);
    expect(hailstorm.duration).toBeLessThan(vk12.duration);
    expect(leviathan.duration).toBeLessThan(.06);
    const heavy = resolveShotAcoustics("lmg", { weaponId: "lmg_heavy" });
    expect(heavy.punchLevel).toBeGreaterThan(0);
  });

  test("shotguns retain extra broad blast and pressure layers under the real sample", () => {
    const breacher = resolveRecordedMix("shotgun", "shotgun_br");
    const mauler = resolveRecordedMix("shotgun", "shotgun_combat");
    const rifle = resolveRecordedMix("assault", "rifle_ar");
    expect(breacher.synthetic).toBeGreaterThan(rifle.synthetic);
    expect(breacher.body).toBeGreaterThan(rifle.body);
    expect(mauler.synthetic).toBeGreaterThan(rifle.synthetic);
    const shot = resolveShotAcoustics("shotgun", { weaponId: "shotgun_br" });
    const smg = resolveShotAcoustics("smg", { weaponId: "smg_kp" });
    expect(shot.blastHighpassHz).toBeLessThan(200);
    expect(shot.punchLevel).toBeGreaterThan(smg.punchLevel * 2);
  });

  test("Bullet Spitter has its own unsampled servo-gun report", () => {
    const turret = resolveShotAcoustics("lmg", { weaponId: "wonder_turret" });
    const flame = resolveShotAcoustics("lmg", { weaponId: "wonder_hellfire" });
    expect(recordedFamilyFor("lmg", "wonder_turret")).toBeNull();
    expect(turret.crackLevel).toBeGreaterThan(.3);
    expect(turret.reportLevel).toBeGreaterThan(.1);
    expect(turret.mechanicalLevel).toBeGreaterThan(.2);
    expect(turret.mechanicalDelay).toBeLessThan(.020);
    expect(flame.reportLevel).toBe(0);
  });
});
