/**
 * Permanent, server-evaluable progression gates for armory purchases.
 * Unlike rotating dailies, these objectives never expire or depend on level.
 *
 * Scrappy-inspired design: per-weapon attachment mastery, lasting operator
 * contracts, visible milestones and a distinct "earned / purchased" state.
 * This catalog is deliberately separate from Survival mode and achievements.
 */
import {
  ATTACHMENTS, WEAPONS, PLAYER_SKINS, WEAPON_SKINS, WEAPON_CHALLENGES,
  type WeaponChallengeDef,
  compatibleAttachments, weaponAttachmentSlots,
  type AttachmentDef, type WeaponDef,
} from "./game-data";

/** A skin challenge exists for every purchasable (weapon, skin) pair.
 * Keep hand-authored catalog challenges intact, generate missing newer-weapon
 * entries deterministically so no gun has inaccessible cosmetic choices.
 */
export function skinChallengesForWeaponAndSkin(weaponId: string, skinId: string): WeaponChallengeDef[] {
  if (!WEAPONS.some(w => w.id === weaponId) ||
      !WEAPON_SKINS.some(s => s.id === skinId && s.id !== "default")) return [];
  const authored = WEAPON_CHALLENGES.filter(c => c.weaponId === weaponId && c.skinId === skinId);
  if (authored.length) return authored;
  const weapon = WEAPONS.find(w => w.id === weaponId)!;
  const goals: Record<string, { metric: "kills" | "headshots"; goal: number }> = {
    arctic: { metric: "kills", goal: 15 },
    crimson: { metric: "kills", goal: 30 },
    emerald: { metric: "kills", goal: 55 },
    carbon: { metric: "headshots", goal: 25 },
    neon: { metric: "kills", goal: 100 },
    inferno: { metric: "kills", goal: 175 },
    gold: { metric: "kills", goal: 275 },
  };
  const goal = goals[skinId];
  if (!goal) return [];
  return [{
    id: `mastery:${weaponId}:${skinId}`,
    weaponId, skinId, goal: goal.goal, metric: goal.metric,
    title: `${weapon.name} ${skinId.replace(/_/g, " ")} mastery`,
    description: `Get ${goal.goal} ${goal.metric === "kills" ? "kills" : "headshots"} with the ${weapon.name}.`,
  }];
}
export function allSkinChallengesForWeapon(weaponId: string): WeaponChallengeDef[] {
  return WEAPON_SKINS.filter(s => s.id !== "default")
    .flatMap(s => skinChallengesForWeaponAndSkin(weaponId, s.id));
}

export type ArmoryMetric = "kills" | "headshots" | "matches" | "wins" | "totalKills" | "totalHeadshots";
export interface ArmoryChallengeDef {
  id: string;
  metric: ArmoryMetric;
  goal: number;
  title: string;
  description: string;
  weaponId?: string;
  rewardId: string;
  kind: "attachment" | "operator";
}
export interface ArmoryCounters {
  kills: number;
  headshots: number;
  matches: number;
  wins: number;
  totalKills: number;
  totalHeadshots: number;
}
export interface ArmoryChallengeView extends ArmoryChallengeDef {
  progress: number;
  completed: boolean;
}
export function armoryChallengeProgress(ch: ArmoryChallengeDef, stats: ArmoryCounters): ArmoryChallengeView {
  const value = Math.max(0, Math.floor(stats[ch.metric] || 0));
  return { ...ch, progress: Math.min(ch.goal, value), completed: value >= ch.goal };
}

/** Weapon / attachment pair is the unlock unit, matching per-weapon ownership. */
export function attachmentChallenge(weaponId: string, attachmentId: string): ArmoryChallengeDef | null {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  const attachment = ATTACHMENTS.find(a => a.id === attachmentId);
  if (!weapon || !attachment || !weaponAttachmentSlots(weapon).includes(attachment.slot) ||
      !compatibleAttachments(weaponId, attachment.slot).includes(attachmentId)) return null;

  const difficulty = Math.max(0, Math.min(3, Math.floor(attachment.unlockCost / 180)));
  let metric: ArmoryMetric = "kills";
  let goal: number;
  switch (attachment.slot) {
    case "sight":
      goal = 12 + difficulty * 8; // early functional optics are approachable
      break;
    case "barrel":
      metric = weapon.category === "shotgun" || weapon.category === "melee" ? "kills" : "headshots";
      goal = metric === "kills" ? 22 + difficulty * 12 : 10 + difficulty * 9;
      break;
    case "grip":
      goal = 28 + difficulty * 15;
      break;
    case "magazine":
      goal = 24 + difficulty * 15;
      break;
  }
  if (attachmentId === "barrel_poison") {
    metric = "kills";
    goal = 80; // advanced crossbow specialization
  }
  return {
    id: `att:${weaponId}:${attachmentId}`,
    kind: "attachment", rewardId: attachmentId, weaponId,
    metric, goal,
    title: `${attachment.name} Trial`,
    description: `Get ${goal} ${metric === "headshots" ? "headshots" : "kills"} with the ${weapon.name}.`,
  };
}

export const OPERATOR_CONTRACTS: ArmoryChallengeDef[] = [
  { id: "op:red", kind: "operator", rewardId: "red", metric: "totalKills", goal: 20, title: "Field Initiation", description: "Earn 20 total eliminations." },
  { id: "op:blue", kind: "operator", rewardId: "blue", metric: "matches", goal: 5, title: "Active Duty", description: "Complete 5 matches." },
  { id: "op:green", kind: "operator", rewardId: "green", metric: "wins", goal: 3, title: "Jungle Operative", description: "Win 3 matches." },
  { id: "op:orange", kind: "operator", rewardId: "orange", metric: "totalKills", goal: 100, title: "Frontline Veteran", description: "Earn 100 eliminations." },
  { id: "op:purple", kind: "operator", rewardId: "purple", metric: "wins", goal: 10, title: "Elite Operator", description: "Win 10 matches." },
  { id: "op:phantom", kind: "operator", rewardId: "phantom", metric: "totalHeadshots", goal: 80, title: "Silent Precision", description: "Land 80 headshots." },
  { id: "op:crimson_lord", kind: "operator", rewardId: "crimson_lord", metric: "wins", goal: 25, title: "Crimson Commander", description: "Win 25 matches." },
];
export function operatorContract(skinId: string): ArmoryChallengeDef | null {
  if (skinId === "default") return null;
  if (!PLAYER_SKINS.some(s => s.id === skinId)) return null;
  return OPERATOR_CONTRACTS.find(c => c.rewardId === skinId) ?? null;
}

export interface WeaponMasteryTier { rank: number; title: string; kills: number; headshots: number }
export const WEAPON_MASTERY_TIERS: WeaponMasteryTier[] = [
  { rank: 1, title: "Recruit", kills: 20, headshots: 0 },
  { rank: 2, title: "Skilled", kills: 60, headshots: 10 },
  { rank: 3, title: "Specialist", kills: 150, headshots: 25 },
  { rank: 4, title: "Veteran", kills: 300, headshots: 55 },
  { rank: 5, title: "Elite", kills: 600, headshots: 110 },
];
export function weaponMasteryProgress(kills: number, headshots: number) {
  const rank = WEAPON_MASTERY_TIERS.filter(t => kills >= t.kills && headshots >= t.headshots).length;
  return {
    rank, title: rank ? WEAPON_MASTERY_TIERS[rank - 1].title : "Unranked",
    next: WEAPON_MASTERY_TIERS[rank] ?? null,
    kills, headshots,
  };
}
