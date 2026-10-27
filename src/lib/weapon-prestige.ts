import { WEAPONS, WEAPON_SKINS } from "./game-data";
import { allSkinChallengesForWeapon, weaponChallengeProgress, weaponMasteryProgress, type WeaponConditionStats } from "./armory-challenges";

export const PRESTIGE_CAMO_IDS = ["prestige_cosmic", "prestige_toxic"] as const;
export function prestigeEligible(
  weaponId: string,
  progress: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
  ownedSkins: ReadonlySet<string> = new Set(),
): boolean {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  if (!weapon || weapon.wonder) return false;
  const challenges = allSkinChallengesForWeapon(weaponId);
  const standard = WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency);
  // No empty/partially configured challenge catalogs can grant a token.
  if (challenges.length < standard.length) return false;
  return standard.every(s => {
    const forSkin = challenges.filter(ch => ch.skinId === s.id);
    return forSkin.length > 0 &&
      (ownedSkins.has(s.id) || forSkin.some(ch => weaponChallengeProgress(ch, progress).completed));
  });
}

/** Cosmetic prestige grants skins immediately. Only Rank 5 weapon mastery
 * combined with that earned prestige unlocks a spendable Wonder token.
 * Derive this from permanent rows so rank-ups retroactively award the token
 * exactly once without a second claim or duplicate accounting.
 */
export function tokenEligiblePrestiges(
  prestigedWeaponIds: readonly string[],
  progress: Readonly<Record<string,{kills:number;headshots:number}>>,
): string[] {
  return [...new Set(prestigedWeaponIds)].filter(id=>
    weaponMasteryProgress(progress[id]?.kills??0,progress[id]?.headshots??0,id).rank===5);
}
export function prestigeTokens(awards: number, wonderUnlocks: number): number {
  return Math.max(0, awards - wonderUnlocks);
}
