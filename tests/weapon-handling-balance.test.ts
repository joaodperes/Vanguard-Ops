import { describe, expect, test } from "bun:test";
import { weaponById } from "../src/lib/game-data";
import { shotSpread, recoilKickRadians, sustainedRecoilMultiplier } from "../src/lib/weapon-accuracy";
import { shotgunConeRadians } from "../src/lib/shotgun-pattern";

describe("weapon recoil balance", () => {
  test("ADS still stabilizes the weapon but no longer cuts 35% of the kick", () => {
    const hip = recoilKickRadians(1, false);
    const ads = recoilKickRadians(1, true);
    expect(ads).toBeCloseTo(hip * 0.77, 8);
    expect(ads).toBeGreaterThan(hip * 0.65);
    expect(ads).toBeLessThan(hip);
  });

  test("perks and attachments still proportionally reduce recoil", () => {
    expect(recoilKickRadians(2, true, 0.8)).toBeCloseTo(recoilKickRadians(2, true) * 0.8, 8);
    expect(recoilKickRadians(0, true)).toBe(0);
    expect(recoilKickRadians(-1, false)).toBe(0);
  });

  test("the Bastion has a substantially stronger heavy-revolver kick", () => {
    const bastion = weaponById("pistol_bastion").stats;
    const magnum = weaponById("pistol_magnum").stats;
    const standard = weaponById("pistol_side").stats;
    expect(bastion.recoil).toBeGreaterThan(magnum.recoil);
    expect(magnum.recoil).toBeGreaterThan(standard.recoil * 2);
    expect(recoilKickRadians(bastion.recoil, true)).toBeGreaterThan(0.03);
    expect(bastion.adsSpread).toBeLessThan(bastion.spread);
  });

  test("heavy LMGs kick harder than the support variant and standard assault rifle", () => {
    const rifle = weaponById("rifle_ar").stats;
    const light = weaponById("lmg_light").stats;
    const hailstorm = weaponById("lmg_hv").stats;
    const leviathan = weaponById("lmg_heavy").stats;
    expect(light.recoil).toBeGreaterThan(rifle.recoil);
    expect(hailstorm.recoil).toBeGreaterThan(light.recoil);
    expect(leviathan.recoil).toBeGreaterThan(hailstorm.recoil);
    expect(leviathan.adsSpread).toBeGreaterThan(hailstorm.adsSpread);
  });

  test("only conventional LMGs gain additional, bounded recoil during a burst", () => {
    expect(sustainedRecoilMultiplier("lmg", 0)).toBe(1);
    expect(sustainedRecoilMultiplier("lmg", 1.0)).toBeCloseTo(1.16);
    expect(sustainedRecoilMultiplier("lmg", 100)).toBeCloseTo(1.24);
    expect(sustainedRecoilMultiplier("lmg", -2)).toBe(1);
    expect(sustainedRecoilMultiplier("lmg", 1.4, true)).toBe(1);
    expect(sustainedRecoilMultiplier("assault", 1.4)).toBe(1);
    expect(sustainedRecoilMultiplier("pistol", 1.4)).toBe(1);
  });
});

describe("weapon accuracy balance", () => {
  test("the first aimed LMG shot remains tighter than hipfire or a long burst", () => {
    const w = weaponById("lmg_heavy");
    const ads = shotSpread(w.stats, w.category, true, 0, 0, true);
    const burst = shotSpread(w.stats, w.category, true, 0.3, 1.2, false);
    const hip = shotSpread(w.stats, w.category, false, 0, 0, false);
    expect(ads).toBeLessThan(hip);
    expect(burst).toBeGreaterThan(ads * 2);
    expect(burst).toBeLessThan(hip * 2);
  });

  test("aiming while moving is less precise than fully settled ADS", () => {
    const rifle = weaponById("rifle_ar");
    const settled = shotSpread(rifle.stats, rifle.category, true, 0, 0, true);
    const moving = shotSpread(rifle.stats, rifle.category, true, 0.4, 0, false);
    expect(moving).toBeGreaterThan(settled * 1.5);
    expect(shotSpread(rifle.stats, rifle.category, false, 0, 0, false)).toBeGreaterThan(settled);
  });

  test("snipers remain precise while scoped but wildly inaccurate from the hip", () => {
    const sniper = weaponById("sniper_lr");
    expect(shotSpread(sniper.stats, sniper.category, true, 0, 0, true)).toBeLessThan(0.001);
    expect(shotSpread(sniper.stats, sniper.category, false, 0, 0, false)).toBeGreaterThan(0.2);
  });

  test("shotgun pellet cones retain their separate close-range mechanics", () => {
    const shotgun = weaponById("shotgun_br").stats;
    expect(shotgunConeRadians(shotgun, false)).toBeCloseTo(shotgun.spread * 0.65, 8);
    expect(shotgunConeRadians(shotgun, true)).toBeCloseTo(shotgun.adsSpread * 0.65, 8);
    expect(shotgunConeRadians(shotgun, false)).toBeGreaterThan(shotgunConeRadians(shotgun, true));
  });
});
