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
  type WeaponChallengeDef, type WeaponChallengeMetric, type WeaponConditionMetric,
  compatibleAttachments, weaponAttachmentSlots,
  type AttachmentDef, type WeaponDef,
} from "./game-data";

/** Stable combat condition identifiers used in network payloads and saved profiles. */
export const WEAPON_CONDITION_METRICS = [
  "bare_kills", "fully_equipped_kills", "ads_kills", "hipfire_kills",
  "airborne_kills", "close_range_kills", "long_range_kills", "multikill_kills",
  "suppressed_kills", "critical_health_kills", "comeback_kills",
] as const satisfies readonly WeaponConditionMetric[];
export type WeaponConditionStats = Record<WeaponConditionMetric, number>;
export function emptyWeaponConditionStats(): WeaponConditionStats {
  return Object.fromEntries(WEAPON_CONDITION_METRICS.map(key => [key, 0])) as WeaponConditionStats;
}
export function parseWeaponConditionStats(value: unknown): WeaponConditionStats {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch { /* invalid or legacy state: start at zero */ }
  const result = emptyWeaponConditionStats();
  for (const key of WEAPON_CONDITION_METRICS) {
    const n = raw[key];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) result[key] = Math.min(10000000, Math.floor(n));
  }
  return result;
}
export function weaponChallengeValue(
  metric: WeaponChallengeMetric,
  data: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
): number {
  return metric === "kills" || metric === "headshots" ? data[metric] : data.conditionStats?.[metric] ?? 0;
}

/** AND-based milestones let a high-tier unlock require several distinct playstyles. */
export function weaponChallengeProgress(
  challenge: WeaponChallengeDef,
  totals: { kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> },
) {
  const steps = (challenge.requirements?.length
    ? challenge.requirements
    : [{ metric: challenge.metric, goal: challenge.goal }])
    .map(step => {
      const value = weaponChallengeValue(step.metric, totals);
      return { metric: step.metric, goal: step.goal,
        progress: Math.min(step.goal, value), completed: value >= step.goal };
    });
  return {
    goal: steps.reduce((sum, step) => sum + step.goal, 0),
    progress: steps.reduce((sum, step) => sum + step.progress, 0),
    completed: steps.every(step => step.completed),
    steps,
  };
}

/** Skin themes now carry a gameplay condition, specialized for each weapon category.
 * All existing purchased skins remain owned, regardless of challenge updates.
 */
function contextualSkinChallenge(ch: WeaponChallengeDef, weapon: WeaponDef): WeaponChallengeDef {
  // Preserve hand-authored headshot challenges, including unusual melee mastery.
  if (ch.metric === "headshots" && ch.skinId !== "gold") return ch;
  const category = weapon.category;
  const equipped = weaponAttachmentSlots(weapon).length > 0;
  const ranged = category === "sniper" || category === "dmr";
  const cqc = category === "shotgun" || category === "melee";
  const mobile = category === "smg" || category === "sidearm";
  const choice: Record<string, WeaponConditionMetric> = {
    arctic: ranged ? "long_range_kills" : cqc ? "close_range_kills" : mobile ? "airborne_kills" : "comeback_kills",
    crimson: equipped ? "bare_kills" : "multikill_kills",
    emerald: cqc ? "close_range_kills" : category === "assault" && compatibleAttachments(weapon.id, "barrel").includes("barrel_suppressor") ? "suppressed_kills" : "ads_kills",
    carbon: ranged ? "long_range_kills" : "hipfire_kills",
    neon: mobile ? "airborne_kills" : ranged ? "long_range_kills" : cqc ? "critical_health_kills" : "hipfire_kills",
    inferno: equipped ? "fully_equipped_kills" : "multikill_kills",
    gold: ranged ? "long_range_kills" : cqc ? "multikill_kills" : equipped ? "fully_equipped_kills" : "bare_kills",
  };
  const metric = choice[ch.skinId];
  if (!metric) return ch;
  const factors: Record<WeaponConditionMetric, number> = {
    bare_kills: .40, fully_equipped_kills: .24, ads_kills: .65,
    hipfire_kills: .45, airborne_kills: .25, close_range_kills: .55,
    long_range_kills: .28, multikill_kills: .25,
    suppressed_kills: .28, critical_health_kills: .18, comeback_kills: .25,
  };
  const circumstances: Record<WeaponConditionMetric, string> = {
    bare_kills: "without any attachments",
    fully_equipped_kills: "with every supported attachment slot equipped",
    ads_kills: "while aiming down sights",
    hipfire_kills: "without aiming down sights",
    airborne_kills: "while airborne",
    close_range_kills: "at 10m or closer",
    long_range_kills: "from at least 35m away",
    multikill_kills: "as part of a multi-kill (within 5 seconds)",
    suppressed_kills: "while using a suppressor",
    critical_health_kills: "while at 35 HP or lower",
    comeback_kills: "within 10 seconds of respawning",
  };
  const goal = Math.max(5, Math.ceil(ch.goal * factors[metric]));
  if (ch.skinId === "gold") {
    // Unlike a single 400-kill grind, final mastery asks the player to switch
    // tactics: dedicated weapon configuration, opposite configuration, precision/mobility.
    const second: WeaponConditionMetric = equipped ? "bare_kills" : "close_range_kills";
    const third: WeaponConditionMetric = ranged ? "ads_kills"
      : cqc ? "airborne_kills" : "hipfire_kills";
    const requirements = [
      { metric, goal },
      { metric: second, goal: Math.max(10, Math.ceil(ch.goal * .16)) },
      { metric: third, goal: Math.max(10, Math.ceil(ch.goal * .20)) },
    ];
    return {
      ...ch, metric, goal, requirements,
      title: `${weapon.name} Complete Mastery`,
      description: requirements.map(r => `${r.goal} kills ${circumstances[r.metric]}`).join("; ") + ".",
    };
  }
  return { ...ch, metric, goal,
    description: `Get ${goal} kills with the ${weapon.name} ${circumstances[metric]}.`,
  };
}

/** A skin challenge exists for every purchasable (weapon, skin) pair.
 * Retain hand-authored catalog IDs/titles while specializing their conditions; generate missing newer-weapon
 * entries deterministically so no gun has inaccessible cosmetic choices.
 */
function weaponByIdStrict(id: string): WeaponDef {
  return WEAPONS.find(w => w.id === id)!;
}
export function skinChallengesForWeaponAndSkin(weaponId: string, skinId: string): WeaponChallengeDef[] {
  if (!WEAPONS.some(w => w.id === weaponId) ||
      !WEAPON_SKINS.some(s => s.id === skinId && s.id !== "default" && !s.prestige) ||
      WEAPONS.some(w => w.id === weaponId && w.wonder)) return [];
  const authored = WEAPON_CHALLENGES.filter(c => c.weaponId === weaponId && c.skinId === skinId);
  if (authored.length) return authored.map(ch => contextualSkinChallenge(ch, weaponByIdStrict(weaponId)));
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
  return [contextualSkinChallenge({
    id: `mastery:${weaponId}:${skinId}`,
    weaponId, skinId, goal: goal.goal, metric: goal.metric,
    title: `${weapon.name} ${skinId.replace(/_/g, " ")} mastery`,
    description: `Get ${goal.goal} ${goal.metric === "kills" ? "kills" : "headshots"} with the ${weapon.name}.`,
  }, weapon)];
}
export function allSkinChallengesForWeapon(weaponId: string): WeaponChallengeDef[] {
  return WEAPON_SKINS.filter(s => s.id !== "default" && !s.prestige)
    .flatMap(s => skinChallengesForWeaponAndSkin(weaponId, s.id));
}

export type ArmoryMetric = WeaponChallengeMetric | "matches" | "wins" | "totalKills" | "totalHeadshots";
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
  conditionStats?: Partial<WeaponConditionStats>;
}
export interface ArmoryChallengeView extends ArmoryChallengeDef {
  progress: number;
  completed: boolean;
}
export function armoryChallengeProgress(ch: ArmoryChallengeDef, stats: ArmoryCounters): ArmoryChallengeView {
  const raw = ch.metric in stats ? stats[ch.metric as keyof ArmoryCounters] : stats.conditionStats?.[ch.metric as WeaponConditionMetric];
  const value = Math.max(0, Math.floor((typeof raw === "number" ? raw : 0) || 0));
  return { ...ch, progress: Math.min(ch.goal, value), completed: value >= ch.goal };
}

/** Weapon / attachment pair is the unlock unit, matching per-weapon ownership. */
export function attachmentChallenge(weaponId: string, attachmentId: string): ArmoryChallengeDef | null {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  const attachment = ATTACHMENTS.find(a => a.id === attachmentId);
  if (!weapon || !attachment || !weaponAttachmentSlots(weapon).includes(attachment.slot) ||
      !compatibleAttachments(weaponId, attachment.slot).includes(attachmentId)) return null;

  const difficulty = Math.max(0, Math.min(3, Math.floor(attachment.unlockCost / 180)));
  // Do not gate attachment purchases on a full loadout: this would deadlock progression.
  let metric: WeaponChallengeMetric = "kills";
  let goal = 12;
  switch (attachment.slot) {
    case "sight":
      metric = weapon.category === "sniper" || weapon.category === "dmr" ? "long_range_kills"
        : weapon.category === "shotgun" ? "close_range_kills" : "hipfire_kills";
      goal = 10 + difficulty * 7;
      break;
    case "barrel":
      metric = difficulty >= 2 ? "ads_kills" : "bare_kills";
      goal = 12 + difficulty * 9;
      break;
    case "grip":
      metric = weapon.category === "smg" || weapon.category === "sidearm" ? "airborne_kills" : "hipfire_kills";
      goal = 10 + difficulty * 8;
      break;
    case "magazine":
      metric = difficulty >= 2 ? "multikill_kills" : "kills";
      goal = difficulty >= 2 ? 8 + difficulty * 5 : 24 + difficulty * 12;
      break;
  }
  // Every attachment in a slot gets a distinct requirement, not one generic
  // magazine/sight/grip challenge repeated for the entire weapon. Keep the
  // criteria achievable without first owning the attachment being unlocked.
  const attachmentIndex = compatibleAttachments(weaponId, attachment.slot).indexOf(attachmentId);
  const objectives: Record<string, WeaponChallengeMetric> = {
    mag_extended: "kills", mag_quickdraw: "ads_kills",
    mag_drum: "multikill_kills", mag_balanced: "hipfire_kills",
    mag_shell_carrier: "close_range_kills",
  };
  const styles: Record<string, WeaponChallengeMetric[]> = {
    sight: ["hipfire_kills", "ads_kills", "bare_kills", "close_range_kills", "airborne_kills"],
    barrel: ["bare_kills", "ads_kills", "hipfire_kills", "multikill_kills", "comeback_kills"],
    grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills", "bare_kills"],
    magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills", "close_range_kills"],
  };
  metric = objectives[attachmentId] ??
    (weapon.category === "sniper" && attachment.slot === "sight" ? "long_range_kills"
      : styles[attachment.slot][attachmentIndex % styles[attachment.slot].length]);
  goal += Math.max(0, attachmentIndex) * 6;
  if (attachmentId === "barrel_poison") { metric = "bare_kills"; goal = 45; }
  const circumstances: Partial<Record<WeaponChallengeMetric, string>> = {
    bare_kills: "without any attachments",
    ads_kills: "while aiming down sights",
    hipfire_kills: "without aiming down sights",
    airborne_kills: "while airborne",
    close_range_kills: "at 10m or closer",
    long_range_kills: "from at least 35m away",
    multikill_kills: "as part of a multi-kill (within 5 seconds)",
    suppressed_kills: "while using a suppressor",
    critical_health_kills: "while at 35 HP or lower",
    comeback_kills: "within 10 seconds of respawning",
  };
  return {
    id: `att:${weaponId}:${attachmentId}`,
    kind: "attachment", rewardId: attachmentId, weaponId,
    metric, goal,
    title: `${attachment.name} Challenge`,
    description: `Get ${goal} ${metric === "headshots" ? "headshots" : "kills"} with the ${weapon.name}${circumstances[metric] ? " " + circumstances[metric] : ""}.`,
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
