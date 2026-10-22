import { describe, expect, test } from "bun:test";
import { WEAPONS, weaponById, weaponSkinById } from "../src/lib/game-data";
import { formatWeaponNumber } from "../src/lib/weapon-numbers";
import { advanceKillChain, KILL_CHAIN_GRACE_MS } from "../src/lib/kill-chain";
import { shotSpread, shotBloomIncrease, recoilKickRadians } from "../src/lib/weapon-accuracy";
import { turretCanTrack, turretDeployPosition, TURRET_LIFETIME_MS } from "../src/lib/turret-rules";

describe("player-facing number formatting", () => {
  test("rounds floating-point artifacts without appending arbitrary zeroes", () => {
    expect(formatWeaponNumber(47.52000000000001)).toBe("47.5");
    expect(formatWeaponNumber(40)).toBe("40");
    expect(formatWeaponNumber(8.999999999999998)).toBe("9");
    expect(formatWeaponNumber(47.52000000000001, 2)).toBe("47.52");
    expect(formatWeaponNumber(Number.NaN)).toBe("—");
  });
});

describe("five-second kill chains", () => {
  test("ten eliminations at 4.9-second intervals form a ten-kill chain", () => {
    let chain = { count: 0, lastKillAt: -Infinity };
    for (let i = 0; i < 10; i++) {
      chain = advanceKillChain(chain, i * 4900);
      expect(chain.count).toBe(i + 1);
    }
    expect(chain.lastKillAt).toBe(44100);
    expect(KILL_CHAIN_GRACE_MS).toBe(5000);
  });
  test("exactly five seconds is allowed; longer gaps restart the chain", () => {
    let chain = advanceKillChain({ count: 0, lastKillAt: -Infinity }, 1000);
    chain = advanceKillChain(chain, 6000);
    expect(chain.count).toBe(2);
    chain = advanceKillChain(chain, 11001);
    expect(chain.count).toBe(1);
  });
});

describe("player shot spread and recoil", () => {
  const regular = WEAPONS.filter(w => !w.wonder && w.category !== "melee");

  test("standing hipfire is never a laser, even for nominally zero-spread weapons", () => {
    for (const w of regular) {
      const hip = shotSpread(w.stats, w.category, false, 0, 0, false);
      expect(hip).toBeGreaterThan(0.01);
      const ads = shotSpread(w.stats, w.category, true, 0, 0, true);
      expect(hip).toBeGreaterThan(ads);
    }
  });

  test("firing repeatedly blooms shot dispersion and increases the crosshair", () => {
    for (const w of regular) {
      const baseline = shotSpread(w.stats, w.category, false, 0, 0, false);
      const moving = shotSpread(w.stats, w.category, false, 0.6, 0, false);
      const sustained = shotSpread(w.stats, w.category, false, 0.6, 1.1, false);
      expect(moving).toBeGreaterThan(baseline);
      expect(sustained).toBeGreaterThan(moving);
      expect(shotBloomIncrease(w.stats.fireRate)).toBeGreaterThan(0);
    }
  });

  test("high-recoil guns kick harder and aiming reduces kick without eliminating it", () => {
    const lmg = weaponById("lmg_hv");
    const smg = weaponById("smg_kp");
    expect(recoilKickRadians(lmg.stats.recoil, false)).toBeGreaterThan(0);
    expect(recoilKickRadians(lmg.stats.recoil, true)).toBeLessThan(recoilKickRadians(lmg.stats.recoil, false));
    expect(recoilKickRadians(lmg.stats.recoil, false)).toBeGreaterThan(recoilKickRadians(smg.stats.recoil, false));
    expect(recoilKickRadians(lmg.stats.recoil, false, 0.7)).toBeLessThan(recoilKickRadians(lmg.stats.recoil, false));
  });
});

describe("Bullet Spitter deployment", () => {
  test("uses a rechargeable deploy charge, not a normal bullet magazine", () => {
    const turret = weaponById("wonder_turret");
    expect(turret.wonder?.kind).toBe("turret");
    expect(turret.wonder?.maxCharges).toBe(1);
    expect(turret.stats.reloadTime).toBe(0);
    expect(TURRET_LIFETIME_MS).toBe(25000);
  });

  test("plants ahead of the player and falls back before blocking cover", () => {
    const player: [number,number,number] = [0,0,0];
    expect(turretDeployPosition(player, 0, [])).toEqual([0,0,2.2]);
    const box = [{pos:[0,0.6,2.2],size:[1,0.6,.2]}];
    const point = turretDeployPosition(player, 0, box);
    expect(point[2]).toBeLessThan(2.2);
    expect(turretCanTrack(point, 0, [0,0,point[2]+5])).toBe(true);
    expect(turretCanTrack(point, 0, [0,0,point[2]-5])).toBe(false);
  });

  test("projector visuals remain independent of weapon skin rarity", () => {
    for (const id of ["gold", "inferno", "prestige_cosmic", "prestige_toxic"]) {
      expect(weaponSkinById(id).rarity).toBe("legendary");
    }
  });
});
