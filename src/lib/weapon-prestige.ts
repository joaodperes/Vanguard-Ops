import { WEAPONS, WEAPON_SKINS } from "./game-data";
import { allSkinChallengesForWeapon, weaponChallengeProgress, type WeaponConditionStats } from "./armory-challenges";

export const PRESTIGE_CAMO_IDS = ["prestige_cosmic", "prestige_toxic"] as const;
export function prestigeEligible(
  weaponId: string,
  progress: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
  ownedSkins: ReadonlySet<string> = new Set(),
): boolean {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  if (!weapon || weapon.wonder) return false;
  const challenges = allSkinChallengesForWeapon(weaponId);
  const standard = WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige);
  // No empty/partially configured challenge catalogs can grant a token.
  if (challenges.length < standard.length) return false;
  return standard.every(s => {
    const forSkin = challenges.filter(ch => ch.skinId === s.id);
    return forSkin.length > 0 &&
      (ownedSkins.has(s.id) || forSkin.some(ch => weaponChallengeProgress(ch, progress).completed));
  });
}

export function prestigeTokens(awards: number, wonderUnlocks: number): number {
  return Math.max(0, awards - wonderUnlocks);
}
