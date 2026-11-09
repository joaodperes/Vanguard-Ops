import { describe, expect, test } from "bun:test";
import { totalXpForLevel, levelForXp, xpProgressInLevel, MAX_PLAYER_LEVEL } from "../src/lib/progression";
import { careerRequirement, careerXpAfterMatch, restoreCareer } from "../src/lib/career";
import { calculateMatchRewards, DIFFICULTY_REWARDS } from "../src/lib/match-rewards";
import { resolveMatchLoadout } from "../src/lib/match-loadout";
import { PERKS } from "../src/lib/perks";
import { autoUnlockedItems, newlyAvailableWeaponsAtLevel } from "../src/lib/player-service";
import { ownsOperativeSkin } from "../src/lib/collection-ownership";
import { WEAPONS, PLAYER_SKINS, DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, promoteChallengeToElite } from "../src/lib/game-data";
import { achievementTitle, titledDisplayName } from "../src/lib/achievement-titles";
import type { LoadoutWire } from "../src/lib/game-protocol";
import type { MatchResultInput } from "../src/lib/player-service";

const match: MatchResultInput = { playerKey: "test", kills: 0, deaths: 0, headshots: 0, won: false, mode: "ffa", score: 0 };

describe("faster equipment progression", () => {
  test("all thresholds are 40% lower, monotonic and round-trip at boundaries", () => {
    for (let level = 2; level <= MAX_PLAYER_LEVEL; level++) {
      const threshold = totalXpForLevel(level);
      expect(threshold).toBe(25 * (level - 1) ** 2 * level * 0.6);
      expect(levelForXp(threshold - 1)).toBe(level - 1);
      expect(levelForXp(threshold)).toBe(level);
      expect(xpProgressInLevel(threshold)).toEqual(level === MAX_PLAYER_LEVEL
        ? { current: 0, needed: 0, level }
        : { current: 0, needed: totalXpForLevel(level + 1) - threshold, level });
    }
  });
  test("level 18 legacy XP receives the faster curve without a wipe", () => {
    expect(levelForXp(25 * 17 ** 2 * 18)).toBe(21);
    expect(totalXpForLevel(36)).toBe(661500);
  });
  test("all current equipment and perks fit the cap; arbitrary excess never prepays new levels", () => {
    expect(WEAPONS.filter(w => !w.wonder).every(w => w.unlockLevel <= MAX_PLAYER_LEVEL)).toBe(true);
    expect(PERKS.every(p => p.unlockLevel <= MAX_PLAYER_LEVEL)).toBe(true);
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_PLAYER_LEVEL);
    expect(levelForXp(Infinity)).toBe(MAX_PLAYER_LEVEL);
    expect(levelForXp(NaN)).toBe(1);
    expect(levelForXp(-10)).toBe(1);
  });
});

describe("multiplayer perk entitlement", () => {
  test("server honors XP-earned perks and rejects unearned perks with a stale cache", () => {
    const player = { xp: totalXpForLevel(18), level: 1, weaponUnlocks: [], loadout: null };
    const loadout: LoadoutWire = { weaponId: "rifle_ar", perkId: "steady", secondaryWeaponId: "pistol_side", weaponSkinId: "default", playerSkinId: "default", attachments: { sight: null, barrel: null, grip: null, magazine: null } };
    expect(resolveMatchLoadout(player, loadout).perkId).toBe("steady");
    expect(resolveMatchLoadout(player, { ...loadout, perkId: "athlete" }).perkId).toBe("battle_hardened");
    expect(resolveMatchLoadout({ ...player, xp: 0 }, loadout).perkId).toBe("battle_hardened");
  });
});

describe("multiplayer level-cap cosmetic entitlement", () => {
  test("an unearned Ascendant Vanguard packet is rejected but level 40 owners can equip it", () => {
    const request: LoadoutWire = {
      weaponId: "rifle_ar", secondaryWeaponId: "pistol_side", perkId: "battle_hardened",
      weaponSkinId: "default", playerSkinId: "ascendant_vanguard",
      attachments: { sight: null, barrel: null, grip: null, magazine: null },
    };
    const player = {
      xp: totalXpForLevel(39), weaponUnlocks: [],
      loadout: { secondaryWeapon: "pistol_side", primaryReticle: "classic",
        secondaryReticle: "classic", primaryCharm: "none", secondaryCharm: "none",
        wonderWeaponId: "", equipmentId: "frag", playerSkin: "ascendant_vanguard" },
    };
    expect(resolveMatchLoadout(player, request).playerSkinId).toBe("default");
    expect(resolveMatchLoadout({ ...player, xp: totalXpForLevel(40) }, request).playerSkinId).toBe("ascendant_vanguard");
    expect(resolveMatchLoadout({ ...player, xp: totalXpForLevel(40), loadout: { ...player.loadout, playerSkin: "default" } }, request).playerSkinId).toBe("default");
    expect(resolveMatchLoadout({ ...player, xp: totalXpForLevel(40) }, { ...request, playerSkinId: "unlisted_skin" }).playerSkinId).toBe("default");
  });
});

describe("credit economy across every match reward path", () => {
  test("a naturally completed 30-kill win pays 151 CR", () => {
    const result = calculateMatchRewards({ ...match, kills: 30, headshots: 10, assists: 6, won: true, completed: true, multikills: 3, killDifficulties: Array(30).fill("normal") });
    expect(result.creditsGained).toBe(151);
    expect(result.xpGained).toBe(1147);
  });
  test("difficulty, legacy, headshot and assist payouts all use the smaller economy", () => {
    expect(Object.values(DIFFICULTY_REWARDS).map(r => r.credits)).toEqual([1,2,4,5,5]);
    expect(calculateMatchRewards({ ...match, kills: 5, killDifficulties: ["easy","normal","hard","veteran","enemy_player"] }).creditsGained).toBe(17);
    expect(calculateMatchRewards({ ...match, kills: 1, headshots: 1, assists: 1 }).creditsGained).toBe(7);
  });
  test("partial difficulty lists still account for every kill, unknown entries use normal", () => {
    const result = calculateMatchRewards({ ...match, kills: 3, killDifficulties: ["easy"] });
    expect(result.killCredits).toBe(5);
    expect(result.killXp).toBe(40);
    expect(calculateMatchRewards({ ...match, kills: 1, killDifficulties: ["invalid"] }).killCredits).toBe(2);
  });
  test("objectives and multikills cannot bypass the rebalance", () => {
    expect(calculateMatchRewards({ ...match, mode: "ctf", score: 2 }).creditsGained).toBe(24);
    expect(calculateMatchRewards({ ...match, mode: "killconfirmed", confirmations: 3, denials: 2 }).creditsGained).toBe(8);
    expect(calculateMatchRewards({ ...match, multikills: 2 }).creditsGained).toBe(16);
  });
  test("Survival clear credit windfalls are smaller while XP and difficulty bonuses stay meaningful", () => {
    const result = calculateMatchRewards({ ...match, mode: "survival", survivalTier: "default", kills: 200, headshots: 75, won: true, multikills: 3, survivalWaves: 30, killDifficulties: Array(200).fill("veteran") });
    expect(result.creditsGained).toBe(2249);
    expect(result.xpGained).toBe(17250);
    expect(calculateMatchRewards({ ...match, mode: "survival", survivalTier: "nightmare", survivalWaves: 10 }).creditsGained).toBe(160);
  });
  test("elite variants multiply the reduced base quest reward", () => {
    for (const q of [...DAILY_CHALLENGE_POOL, ...WEEKLY_CHALLENGE_POOL]) {
      expect(promoteChallengeToElite(q).rewardCredits).toBe(q.rewardCredits * 3);
    }
    expect(DAILY_CHALLENGE_POOL.find(q => q.id === "ch_kills_25")!.rewardCredits).toBe(100);
  });
});

describe("repeatable Career progression", () => {
  test("only the portion of a newly completed match above the equipment cap counts", () => {
    const cap = totalXpForLevel(MAX_PLAYER_LEVEL);
    expect(careerXpAfterMatch(0, 0, 1000, 100)).toBe(0);
    expect(careerXpAfterMatch(0, 0, cap - 100, 250)).toBe(150);
    expect(careerXpAfterMatch(0, 0, cap + 1000000, 100)).toBe(100);
  });
  test("full meters stop banking, each promotion raises both costs", () => {
    expect(careerRequirement(0)).toEqual({ xp: 20000, credits: 5000 });
    expect(careerRequirement(1)).toEqual({ xp: 25000, credits: 7500 });
    expect(careerXpAfterMatch(19900, 0, 1000000, 100000)).toBe(20000);
    expect(careerXpAfterMatch(0, 1, 1000000, 50)).toBe(50);
  });
  test("older backups cannot refill the next rank; new imports bound progress", () => {
    expect(restoreCareer({ careerRank: 2, careerXp: 50 }, { careerRank: 1, careerXp: 999999 })).toEqual({ careerRank: 2, careerXp: 50 });
    expect(restoreCareer(null, {})).toEqual({ careerRank: 0, careerXp: 0 });
    expect(restoreCareer(null, { careerRank: 1, careerXp: 999999 })).toEqual({ careerRank: 1, careerXp: 25000 });
  });
  test("earned Career titles resolve on existing match nameplates", () => {
    expect(achievementTitle("career_veteran")).toBe("Veteran Operative");
    expect(titledDisplayName("Recruit", "career_legend")).toBe("Recruit · Vanguard Legend");
  });
});

describe("rebalanced level rewards", () => {
  test("disabled melee is not announced and empty levels have a reward", () => {
    const active = WEAPONS.filter(w => !w.wonder && !w.disabled);
    const at = (name: string) => active.find(w => w.name === name)?.unlockLevel;
    expect(at("Breacher")).toBe(2);
    expect(at("Sentinel-45")).toBe(33);
    expect(at("Hydra Twin")).toBe(37);
    expect(at("Machine Pistol")).toBe(38);
    expect(at("RL-7 Rocket Launcher")).toBe(39);
    expect(newlyAvailableWeaponsAtLevel(33).map(w => w.name)).toContain("Sentinel-45");
    for (const name of ["Shiv", "Throwing Knives", "Breacher Axe"]) {
      const w = WEAPONS.find(w => w.name === name);
      expect(w?.disabled).toBe(true);
      expect(active.some(item => item.id === w?.id)).toBe(false);
      expect(newlyAvailableWeaponsAtLevel(w!.unlockLevel).map(item => item.id)).not.toContain(w!.id);
    }
  });
  test("level 40 Ascendant Vanguard is earned at cap without purchase", () => {
    const skin = PLAYER_SKINS.find(s => s.id === "ascendant_vanguard");
    expect(skin).toBeDefined();
    expect(skin?.unlockLevel).toBe(MAX_PLAYER_LEVEL);
    expect(skin?.unlockCost).toBe(0);
    expect(skin?.levelReward).toBe(true);
    expect(autoUnlockedItems(39).playerSkins).not.toContain(skin!.id);
    expect(autoUnlockedItems(40).playerSkins).toContain(skin!.id);
    expect(ownsOperativeSkin(skin!, 39, ["default"])).toBe(false);
    expect(ownsOperativeSkin(skin!, 40, ["default"])).toBe(true);
  });
});
