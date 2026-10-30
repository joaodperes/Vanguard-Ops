import { WEAPONS, WEAPON_SKINS } from "./game-data";
import { allSkinChallengesForWeapon, weaponChallengeProgress, weaponMasteryProgress, type WeaponConditionStats } from "./armory-challenges";

export const PRESTIGE_CAMO_IDS = ["prestige_cosmic", "prestige_toxic"] as const;

/** Shared server/UI audit of the seven ordinary cosmetic challenges.
 * A completed mastery achievement alone is not a Wonder entitlement.
 * Keep this in the same code path as prestigeEligible so the Armory never
 * claims 7/7 when the server would reject a Prestige award.
 */
export function prestigeChallengeStatus(
  weaponId: string,
  progress: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
  ownedSkins: ReadonlySet<string> = new Set(),
) {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  const standard = WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency);
  const challenges = weapon && !weapon.wonder ? allSkinChallengesForWeapon(weaponId) : [];
  const missingSkinIds = standard.filter(s => {
    const forSkin = challenges.filter(ch => ch.skinId === s.id);
    return !forSkin.length || (!ownedSkins.has(s.id) &&
      !forSkin.some(ch => weaponChallengeProgress(ch, progress).completed));
  }).map(s => s.id);
  const configured = !!weapon && !weapon.wonder && standard.length > 0 &&
    challenges.length >= standard.length;
  return {
    completed: standard.length - missingSkinIds.length,
    total: standard.length,
    missingSkinIds,
    eligible: configured && missingSkinIds.length === 0,
  };
}
export function prestigeEligible(
  weaponId: string,
  progress: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
  ownedSkins: ReadonlySet<string> = new Set(),
): boolean {
  return prestigeChallengeStatus(weaponId, progress, ownedSkins).eligible;
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

// An independent endgame milestone, NOT a Prestige skin challenge.
export function wonderUnlockChallenge(weaponId:string,prestiged:boolean,kills:number,headshots:number){
  const weapon=WEAPONS.find(w=>w.id===weaponId);
  const eligible=!!weapon&&!weapon.wonder;
  const rank=weaponMasteryProgress(kills,headshots,weaponId).rank;
  const prestigeDone=eligible&&prestiged;
  const masteryDone=eligible&&rank===5;
  return {
    id:`wonder_unlock:${weaponId}`, title:"Wonder Weapon Unlock",
    goal:2,progress:Number(prestigeDone)+Number(masteryDone),
    completed:prestigeDone&&masteryDone,reward:"1 Wonder Weapon unlock",
    requirements:[
      {id:"prestige",title:"Complete Weapon Prestige",progress:Number(prestigeDone),goal:1,completed:prestigeDone},
      {id:"mastery",title:"Reach Weapon Mastery rank 5/5",progress:eligible?rank:0,goal:5,completed:masteryDone},
    ],
  };
}
