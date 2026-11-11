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
  type AttachmentDef, type WeaponDef, type AttachmentSlot,
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

  const category = weapon.category;
  const equipped = weaponAttachmentSlots(weapon).length > 0;
  const ranged = category === "sniper" || category === "dmr";
  const cqc = category === "shotgun" || category === "melee";
  const mobile = category === "smg" || category === "pdw";

  // Splash and melee kills cannot be headshots. Pellet headshot finishes are
  // inconsistent enough that they should not gate a shotgun cosmetic either.
  // Keep authored challenge IDs/goals and all previously purchased cosmetics.
  if (ch.metric === "headshots" && ch.skinId !== "gold") {
    if (category === "melee" || category === "shotgun" || category === "launcher") {
      const replacement: WeaponConditionMetric = category === "melee" ? "close_range_kills"
        : category === "shotgun" ? "ads_kills" : "multikill_kills";
      const condition = category === "melee" ? "at 10m or closer"
        : category === "shotgun" ? "while aiming down sights"
        : "as part of a multi-kill (within 5 seconds)";
      return { ...ch, metric: replacement,
        description: "Get " + ch.goal + " kills with the " + weapon.name + " " + condition + "." };
    }
    return ch;
  }
  if (category === "melee" && ch.metric === "close_range_kills" && ch.id.includes("_hs_")) {
    return { ...ch, description: "Get " + ch.goal + " close-range eliminations with the " + weapon.name + "." };
  }
  // Precision rifles never require hipfire or airborne eliminations. SMGs
  // reward mobility, shotguns close quarters, and launchers splash multi-kills.
  const choice: Record<string, WeaponConditionMetric> = {
    arctic: ranged ? "long_range_kills" : cqc ? "close_range_kills" : mobile ? "airborne_kills" : "comeback_kills",
    crimson: equipped ? "bare_kills" : "multikill_kills",
    emerald: cqc ? "close_range_kills" : category === "assault" && compatibleAttachments(weapon.id, "barrel").includes("barrel_suppressor") ? "suppressed_kills" : "ads_kills",
    carbon: ranged ? "long_range_kills" : category === "shotgun" ? "ads_kills" : category === "launcher" ? "multikill_kills" : "hipfire_kills",
    neon: ranged ? "critical_health_kills" : category === "melee" ? "comeback_kills"
      : category === "shotgun" ? "hipfire_kills" : mobile ? "airborne_kills"
      : category === "launcher" || category === "lmg" ? "multikill_kills"
      : category === "pistol" ? "comeback_kills" : "hipfire_kills",
    inferno: equipped ? "fully_equipped_kills" : "multikill_kills",
    gold: ranged ? "long_range_kills" : cqc ? "close_range_kills"
      : category === "launcher" ? "multikill_kills" : "fully_equipped_kills",
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
  // Rare kill conditions are meaningful objectives, not most of the grind.
  const factor = metric === "airborne_kills" ? .16
    : metric === "critical_health_kills" ? .12
    : metric === "comeback_kills" && (category === "melee" || category === "pistol") ? .16
    : metric === "multikill_kills" && (category === "melee" || category === "launcher") ? .12
    : factors[metric];
  const goal = Math.max(5, Math.ceil(ch.goal * factor));

  if (ch.skinId === "gold") {
    // Three varied but realistic mastery steps, including special treatment
    // for weapons that cannot reliably jump-shoot or land headshots.
    const steps: { metric: WeaponChallengeMetric; goal: number }[] =
      category === "melee" ? [
        { metric: "close_range_kills", goal: Math.max(15, Math.ceil(ch.goal * .55)) },
        { metric: "comeback_kills", goal: Math.max(10, Math.ceil(ch.goal * .10)) },
        { metric: "multikill_kills", goal: Math.max(5, Math.ceil(ch.goal * .06)) },
      ] : category === "shotgun" ? [
        { metric: "close_range_kills", goal: Math.max(10, Math.ceil(ch.goal * .55)) },
        { metric: "bare_kills", goal: Math.max(10, Math.ceil(ch.goal * .16)) },
        { metric: "ads_kills", goal: Math.max(10, Math.ceil(ch.goal * .16)) },
      ] : category === "launcher" ? [
        { metric: "multikill_kills", goal: Math.max(5, Math.ceil(ch.goal * .08)) },
        { metric: "bare_kills", goal: Math.max(10, Math.ceil(ch.goal * .16)) },
        { metric: "ads_kills", goal: Math.max(10, Math.ceil(ch.goal * .20)) },
      ] : [
        { metric, goal },
        { metric: equipped ? "bare_kills" : "close_range_kills", goal: Math.max(10, Math.ceil(ch.goal * .16)) },
        { metric: ranged || category === "lmg" ? "ads_kills" : "hipfire_kills",
          goal: Math.max(10, Math.ceil(ch.goal * .20)) },
      ];
    return {
      ...ch, metric: steps[0].metric, goal: steps[0].goal, requirements: steps,
      title: weapon.name + " Complete Mastery",
      description: steps.map(r => r.goal + " kills " + circumstances[r.metric as WeaponConditionMetric]).join("; ") + ".",
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
function baseAttachmentChallenge(weaponId: string, attachmentId: string): ArmoryChallengeDef | null {
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
      metric = weapon.category === "smg" || weapon.category === "pistol" || weapon.category === "pdw" ? "airborne_kills" : "hipfire_kills";
      goal = 10 + difficulty * 8;
      break;
    case "magazine":
      metric = difficulty >= 2 ? "multikill_kills" : "kills";
      goal = difficulty >= 2 ? 8 + difficulty * 5 : 24 + difficulty * 12;
      break;
  }

  // Rotate within curated CATEGORY + SLOT objectives instead of a generic
  // positional list. No attachment requires itself to be equipped first.
  const attachmentIndex = compatibleAttachments(weaponId, attachment.slot).indexOf(attachmentId);
  const styles: Record<string, Record<AttachmentSlot, WeaponChallengeMetric[]>> = {
    assault: {
      sight: ["hipfire_kills", "ads_kills", "bare_kills", "long_range_kills"],
      barrel: ["bare_kills", "ads_kills", "hipfire_kills", "multikill_kills"],
      grip: ["hipfire_kills", "ads_kills", "airborne_kills", "bare_kills"],
      magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills", "long_range_kills"],
    },
    smg: {
      sight: ["hipfire_kills", "ads_kills", "bare_kills", "close_range_kills"],
      barrel: ["bare_kills", "ads_kills", "hipfire_kills", "comeback_kills"],
      grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills"],
      magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills"],
    },
    shotgun: {
      sight: ["hipfire_kills", "ads_kills", "bare_kills", "close_range_kills"],
      barrel: ["bare_kills", "close_range_kills", "hipfire_kills", "ads_kills"],
      grip: ["hipfire_kills", "close_range_kills", "ads_kills", "bare_kills"],
      magazine: ["ads_kills", "close_range_kills", "bare_kills", "hipfire_kills", "comeback_kills", "kills"],
    },
    dmr: {
      sight: ["long_range_kills", "ads_kills", "bare_kills", "comeback_kills"],
      barrel: ["bare_kills", "ads_kills", "long_range_kills", "comeback_kills"],
      grip: ["ads_kills", "long_range_kills", "bare_kills", "comeback_kills"],
      magazine: ["kills", "ads_kills", "long_range_kills", "bare_kills", "comeback_kills"],
    },
    sniper: {
      sight: ["long_range_kills", "ads_kills", "bare_kills", "comeback_kills"],
      barrel: ["bare_kills", "ads_kills", "long_range_kills", "comeback_kills"],
      grip: ["ads_kills", "long_range_kills", "bare_kills", "comeback_kills"],
      magazine: ["kills", "ads_kills", "long_range_kills", "bare_kills", "comeback_kills"],
    },
    lmg: {
      sight: ["ads_kills", "bare_kills", "long_range_kills", "hipfire_kills"],
      barrel: ["bare_kills", "ads_kills", "long_range_kills", "multikill_kills"],
      grip: ["ads_kills", "multikill_kills", "long_range_kills", "bare_kills"],
      magazine: ["kills", "multikill_kills", "ads_kills", "long_range_kills", "long_range_kills"],
    },
    pistol: {
      sight: ["hipfire_kills", "ads_kills", "bare_kills", "close_range_kills"],
      barrel: ["bare_kills", "ads_kills", "hipfire_kills", "comeback_kills"],
      grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills"],
      magazine: ["kills", "ads_kills", "hipfire_kills", "close_range_kills"],
    },
    pdw: {
      sight: ["hipfire_kills", "ads_kills", "bare_kills", "close_range_kills"],
      barrel: ["bare_kills", "ads_kills", "hipfire_kills", "comeback_kills"],
      grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills"],
      magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills"],
    },
    launcher: {
      sight: ["ads_kills", "bare_kills", "comeback_kills", "kills"],
      barrel: ["bare_kills", "ads_kills", "multikill_kills", "comeback_kills"],
      grip: ["ads_kills", "bare_kills", "comeback_kills", "kills"],
      magazine: ["kills", "ads_kills", "bare_kills", "comeback_kills"],
    },
    melee: { sight: [], barrel: [], grip: [], magazine: [] },
  };
  const slotStyles = (styles[weapon.category] ?? styles.assault)[attachment.slot];
  const objectives: Record<string, WeaponChallengeMetric> = {
    mag_extended: "kills", mag_quickdraw: "ads_kills",
    mag_drum: "multikill_kills", mag_balanced: "hipfire_kills",
    mag_shell_carrier: "close_range_kills",
  };
  const named = objectives[attachmentId];
  const precision = weapon.category === "sniper" || weapon.category === "dmr";
  const unsuitedForPrecision = ["hipfire_kills", "close_range_kills", "airborne_kills", "multikill_kills"];
  metric = named && !(precision && unsuitedForPrecision.includes(named))
    ? named : slotStyles[attachmentIndex % slotStyles.length];
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


/**
 * Attachment trials share only a small pool of achievable, category-appropriate
 * actions. Spread that pool across the whole weapon rather than assigning tiny
 * numerical variations (e.g. 17 vs 18 ADS kills) to neighbouring attachments.
 *
 * A repeated action is a deliberately spaced mastery tier, not another
 * effectively identical unlock. Rare situational kills have small targets.
 * No trial requires owning its own attachment or a fully fitted weapon.
 */
const ATTACHMENT_METRIC_POOL: Record<WeaponDef["category"], Partial<Record<AttachmentSlot, readonly WeaponChallengeMetric[]>>> = {
  assault: {
    sight: ["hipfire_kills", "ads_kills", "long_range_kills", "headshots", "bare_kills"],
    barrel: ["bare_kills", "ads_kills", "long_range_kills", "headshots", "hipfire_kills"],
    grip: ["hipfire_kills", "ads_kills", "airborne_kills", "bare_kills", "headshots"],
    magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills", "long_range_kills", "headshots"],
  },
  smg: {
    sight: ["hipfire_kills", "ads_kills", "close_range_kills", "headshots", "bare_kills"],
    barrel: ["bare_kills", "ads_kills", "hipfire_kills", "close_range_kills", "headshots"],
    grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills", "bare_kills"],
    magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills", "close_range_kills"],
  },
  shotgun: {
    sight: ["hipfire_kills", "ads_kills", "close_range_kills", "bare_kills"],
    barrel: ["bare_kills", "close_range_kills", "hipfire_kills", "ads_kills", "kills"],
    grip: ["hipfire_kills", "close_range_kills", "ads_kills", "bare_kills"],
    magazine: ["ads_kills", "close_range_kills", "hipfire_kills", "bare_kills", "kills", "multikill_kills"],
  },
  dmr: {
    sight: ["long_range_kills", "ads_kills", "headshots", "bare_kills"],
    barrel: ["bare_kills", "ads_kills", "long_range_kills", "headshots"],
    grip: ["ads_kills", "long_range_kills", "bare_kills", "headshots"],
    magazine: ["kills", "ads_kills", "long_range_kills", "headshots", "bare_kills"],
  },
  sniper: {
    sight: ["long_range_kills", "ads_kills", "headshots", "bare_kills"],
    barrel: ["bare_kills", "ads_kills", "long_range_kills", "headshots"],
    grip: ["ads_kills", "long_range_kills", "bare_kills", "headshots"],
    magazine: ["kills", "ads_kills", "long_range_kills", "headshots", "bare_kills"],
  },
  lmg: {
    sight: ["ads_kills", "long_range_kills", "bare_kills", "headshots", "hipfire_kills"],
    barrel: ["bare_kills", "ads_kills", "long_range_kills", "multikill_kills", "headshots"],
    grip: ["ads_kills", "multikill_kills", "long_range_kills", "bare_kills", "hipfire_kills"],
    magazine: ["kills", "multikill_kills", "ads_kills", "long_range_kills", "bare_kills", "hipfire_kills"],
  },
  pistol: {
    sight: ["hipfire_kills", "ads_kills", "close_range_kills", "bare_kills", "headshots"],
    barrel: ["bare_kills", "ads_kills", "hipfire_kills", "headshots", "close_range_kills"],
    grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills", "bare_kills"],
    magazine: ["kills", "ads_kills", "hipfire_kills", "close_range_kills", "headshots"],
  },
  pdw: {
    sight: ["hipfire_kills", "ads_kills", "close_range_kills", "headshots", "bare_kills"],
    barrel: ["bare_kills", "ads_kills", "hipfire_kills", "close_range_kills", "headshots"],
    grip: ["hipfire_kills", "ads_kills", "airborne_kills", "close_range_kills", "bare_kills"],
    magazine: ["kills", "ads_kills", "hipfire_kills", "multikill_kills", "close_range_kills"],
  },
  launcher: {
    sight: ["ads_kills", "bare_kills", "kills"],
    barrel: ["bare_kills", "ads_kills", "multikill_kills", "kills"],
    grip: ["ads_kills", "bare_kills", "kills"],
    magazine: ["kills", "ads_kills", "bare_kills", "multikill_kills"],
  },
  melee: {},
};

/** Keep unmistakable attachment roles tied to their natural playstyle. */
const ATTACHMENT_THEMED_METRICS: Partial<Record<string, WeaponChallengeMetric>> = {
  sight_laser: "hipfire_kills",
  grip_akimbo: "hipfire_kills",
  grip_fan_hammer: "hipfire_kills",
  mag_extended: "kills",
  mag_quickdraw: "ads_kills",
  mag_drum: "multikill_kills",
  mag_balanced: "hipfire_kills",
  mag_shell_carrier: "close_range_kills",
  mag_slug: "ads_kills",
  mag_pellets: "hipfire_kills",
  mag_dragons_breath: "close_range_kills",
  mag_penetrator: "long_range_kills",
  barrel_launcher_blast: "multikill_kills",
};

const ATTACHMENT_METRIC_TARGETS: Partial<Record<WeaponChallengeMetric, { first: number; gap: number }>> = {
  kills: { first: 20, gap: 14 },
  headshots: { first: 8, gap: 10 },
  ads_kills: { first: 12, gap: 10 },
  hipfire_kills: { first: 12, gap: 10 },
  bare_kills: { first: 10, gap: 10 },
  close_range_kills: { first: 12, gap: 10 },
  long_range_kills: { first: 8, gap: 10 },
  airborne_kills: { first: 4, gap: 5 },
  multikill_kills: { first: 4, gap: 5 },
  comeback_kills: { first: 5, gap: 5 },
};

const ATTACHMENT_METRIC_DESCRIPTIONS: Partial<Record<WeaponChallengeMetric, string>> = {
  bare_kills: "without any attachments",
  ads_kills: "while aiming down sights",
  hipfire_kills: "without aiming down sights",
  airborne_kills: "while airborne",
  close_range_kills: "at 10m or closer",
  long_range_kills: "from at least 35m away",
  multikill_kills: "as part of a multi-kill (within 5 seconds)",
  comeback_kills: "within 10 seconds of respawning",
};

export function attachmentChallenge(weaponId: string, attachmentId: string): ArmoryChallengeDef | null {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  if (!weapon) return null;

  // Fixed order makes the result stable regardless of how an individual weapon
  // declares its supported slots. Eligibility never depends on challenge order.
  const used: Partial<Record<WeaponChallengeMetric, number>> = {};
  for (const slot of ["sight", "barrel", "grip", "magazine"] as const) {
    if (!weaponAttachmentSlots(weapon).includes(slot)) continue;
    for (const id of compatibleAttachments(weaponId, slot)) {
      const seed = baseAttachmentChallenge(weaponId, id);
      if (!seed) continue;
      const options = ATTACHMENT_METRIC_POOL[weapon.category][slot] ?? [];
      const themed = ATTACHMENT_THEMED_METRICS[id];
      const preferred = themed && options.includes(themed) ? themed : seed.metric;
      const candidates = themed && options.includes(themed)
        ? [themed]
        : [preferred, ...options.filter(m => m !== preferred)].filter(m => options.includes(m));
      if (!candidates.length) continue;

      // Prefer the attachment's curated style when usage is tied; otherwise
      // select an underrepresented, viable playstyle before repeating a metric.
      const metric = candidates.reduce((best, candidate) =>
        (used[candidate] ?? 0) < (used[best] ?? 0) ? candidate : best);
      const tier = used[metric] ?? 0;
      used[metric] = tier + 1;

      const attachment = ATTACHMENTS.find(a => a.id === id)!;
      const difficulty = Math.max(0, Math.min(3, Math.floor(attachment.unlockCost / 180)));
      const target = ATTACHMENT_METRIC_TARGETS[metric]!;
      // Cost modestly nudges the target; repeated metrics have a much larger
      // deliberate gap. This prevents 36/39/42-style near-duplicate unlocks.
      const goal = target.first + tier * target.gap + Math.min(1, difficulty);
      const circumstance = ATTACHMENT_METRIC_DESCRIPTIONS[metric];
      const description = `Get ${goal} ${metric === "headshots" ? "headshots" : "kills"} with the ${weapon.name}${circumstance ? " " + circumstance : ""}.`;
      if (id === attachmentId) return { ...seed, metric, goal, description };
    }
  }
  return null;
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
// Reference precision-rifle targets; other classes have tailored headshot gates.
export const WEAPON_MASTERY_TIERS: WeaponMasteryTier[] = [
  { rank: 1, title: "Recruit", kills: 20, headshots: 0 },
  { rank: 2, title: "Skilled", kills: 60, headshots: 25 },
  { rank: 3, title: "Specialist", kills: 150, headshots: 70 },
  { rank: 4, title: "Veteran", kills: 300, headshots: 150 },
  { rank: 5, title: "Elite", kills: 600, headshots: 330 },
];
const MASTERY_HEADSHOTS: Record<string, readonly number[]> = {
  assault: [0, 12, 35, 80, 170],
  smg: [0, 8, 24, 50, 110],
  shotgun: [0, 0, 0, 0, 0],
  dmr: [0, 25, 70, 150, 330],
  sniper: [0, 25, 70, 150, 330],
  lmg: [0, 8, 26, 55, 120],
  pistol: [0, 14, 40, 80, 175],
  pdw: [0, 8, 24, 50, 100],
  launcher: [0, 0, 0, 0, 0],
  melee: [0, 0, 0, 0, 0],
};
/** Kill milestones stay constant, but classes without consistent headshot
 * mechanics (shotguns, launchers, melee) no longer have impossible mastery.
 */
export function weaponMasteryTiers(weaponId?: string): WeaponMasteryTier[] {
  const category = WEAPONS.find(w => w.id === weaponId)?.category;
  const thresholds = category ? MASTERY_HEADSHOTS[category] : undefined;
  return WEAPON_MASTERY_TIERS.map((tier, i) => ({
    ...tier, headshots: thresholds?.[i] ?? tier.headshots,
  }));
}
export function weaponMasteryProgress(kills: number, headshots: number, weaponId?: string) {
  const tiers = weaponMasteryTiers(weaponId);
  const rank = tiers.filter(t => kills >= t.kills && headshots >= t.headshots).length;
  return {
    rank, title: rank ? tiers[rank - 1].title : "Unranked",
    next: tiers[rank] ?? null,
    kills, headshots,
  };
}
