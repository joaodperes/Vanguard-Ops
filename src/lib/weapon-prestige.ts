import { WEAPONS, WEAPON_SKINS, compatibleAttachments, weaponAttachmentSlots } from "./game-data";
import { allSkinChallengesForWeapon, attachmentChallenge, armoryChallengeProgress, weaponChallengeProgress, weaponMasteryProgress, type WeaponConditionStats } from "./armory-challenges";

export const PRESTIGE_CAMO_IDS = ["prestige_cosmic", "prestige_toxic"] as const;

/** Shared server/UI audit of ordinary cosmetic AND compatible attachment trials.
 * Attachment challenges must be completed, but their credit purchases are not
 * required. Existing purchased skins/attachments count as completed to preserve
 * legacy entitlements. A Mastery rank alone is not a Wonder entitlement.
 */
export function prestigeChallengeStatus(
  weaponId: string,
  progress: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
  ownedSkins: ReadonlySet<string> = new Set(),
  ownedAttachments: ReadonlySet<string> = new Set(),
) {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  const supported = !!weapon && !weapon.wonder;
  const standard = WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige && !s.shopCurrency);
  const skinChallenges = supported ? allSkinChallengesForWeapon(weaponId) : [];
  const missingSkinIds = standard.filter(s => {
    const forSkin = skinChallenges.filter(ch => ch.skinId === s.id);
    return !forSkin.length || (!ownedSkins.has(s.id) &&
      !forSkin.some(ch => weaponChallengeProgress(ch, progress).completed));
  }).map(s => s.id);

  // Compatibility defines the checklist, not global attachment ownership or
  // the player's equipped loadout. Melee weapons intentionally have zero trials.
  const attachmentIds = supported
    ? [...new Set(weaponAttachmentSlots(weapon).flatMap(slot => compatibleAttachments(weaponId, slot)))]
    : [];
  const missingAttachmentIds = attachmentIds.filter(id => {
    const ch = attachmentChallenge(weaponId, id);
    if (!ch) return true; // invalid catalog must never silently grant Prestige
    return !ownedAttachments.has(id) && !armoryChallengeProgress(ch, {
      kills: progress.kills, headshots: progress.headshots,
      conditionStats: progress.conditionStats,
      matches: 0, wins: 0, totalKills: 0, totalHeadshots: 0,
    }).completed;
  });

  const skinCompleted = standard.length - missingSkinIds.length;
  const attachmentCompleted = attachmentIds.length - missingAttachmentIds.length;
  const configured = supported && standard.length > 0 &&
    skinChallenges.length >= standard.length;
  return {
    completed: skinCompleted + attachmentCompleted,
    total: standard.length + attachmentIds.length,
    skinCompleted, skinTotal: standard.length, missingSkinIds,
    attachmentCompleted, attachmentTotal: attachmentIds.length, missingAttachmentIds,
    eligible: configured && missingSkinIds.length === 0 && missingAttachmentIds.length === 0,
  };
}
export function prestigeEligible(
  weaponId: string,
  progress: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
  ownedSkins: ReadonlySet<string> = new Set(),
  ownedAttachments: ReadonlySet<string> = new Set(),
): boolean {
  return prestigeChallengeStatus(weaponId, progress, ownedSkins, ownedAttachments).eligible;
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
      {id:"mastery",title:"Reach Weapon Mastery rank 5",progress:eligible?rank:0,goal:5,completed:masteryDone},
    ],
  };
}
