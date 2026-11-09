/** Shared, build-time-only structural contracts for ALL shipped content catalogs.
 * JSON remains the source of gameplay content. No duplicate handwritten
 * validation allowlists or external schema definitions are authoritative.
 * Runtime client/server mechanics and cross-catalog references are checked
 * separately by content-validation.ts (not inferred from metadata).
 */
import {z} from "zod";
import {MAX_PLAYER_LEVEL} from "./progression";

export const id = z.string().regex(/^[a-z][a-z0-9_:-]*$/);
export const label = z.string().min(1);
export const num = z.number().finite();
export const count = num.int().nonnegative();
export const pos = num.positive();
export const unit = num.min(0).max(1);
export const category = z.enum(["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "pistol", "pdw", "launcher", "melee"]);
export const slot = z.enum(["sight", "barrel", "grip", "magazine"]);
export const rarity = z.enum(["common", "rare", "epic", "legendary"]);
export const weaponSkinRarity = z.enum(["common", "rare", "epic", "legendary", "prestige"]);
export const cssColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);


/** Gameplay identity vocabularies shared by TypeScript consumers and validators. */
export const SIGHT_TYPES = ["iron","red_dot","holo","acog","hunter","thermal","nvg","laser","sniper_scope"] as const;
export const WEAPON_CONDITION_METRICS = [
  "bare_kills","fully_equipped_kills","ads_kills","hipfire_kills",
  "airborne_kills","close_range_kills","long_range_kills","multikill_kills",
  "suppressed_kills","critical_health_kills","comeback_kills",
] as const;
export const WEAPON_CHALLENGE_METRICS = ["kills","headshots",...WEAPON_CONDITION_METRICS] as const;
export const ROTATING_CHALLENGE_METRICS = [
  "kills","headshots","wins","matches","tdm_kills","ffa_kills",
  "kills_with_shotgun","kills_with_sniper","kills_with_secondary","kills_with_melee",
  "multikills","survival_kills","survival_waves","gungame_kills",
  "kill_confirmations","kill_denials","level",
] as const;
export const ACHIEVEMENT_METRICS = [
  "kills","headshots","wins","matches","level","credits_earned_total",
  "survival_waves","survival_default_wins","survival_hard_waves",
  "survival_elite_waves","survival_nightmare_waves",
  "daily_challenges_completed","weekly_challenges_completed",
  "elite_challenges_completed","total_challenges_completed",
  "best_killstreak","ctf_captures","ctf_wins","mastery_recruits",
  "mastery_specialists","mastery_elites","nexus_reaper_kills","collection_percent",
] as const;
export const weaponChallengeMetric = z.enum(WEAPON_CHALLENGE_METRICS);
export const rotatingMetric = z.enum(ROTATING_CHALLENGE_METRICS);
export const achievementMetric = z.enum(ACHIEVEMENT_METRICS);
export type CatalogWeaponCategory = z.infer<typeof category>;
export type CatalogAttachmentSlot = z.infer<typeof slot>;
export type CatalogSightType = typeof SIGHT_TYPES[number];
export type CatalogWeaponConditionMetric = typeof WEAPON_CONDITION_METRICS[number];
export type CatalogWeaponChallengeMetric = typeof WEAPON_CHALLENGE_METRICS[number];
export type CatalogChallengeMetric = typeof ROTATING_CHALLENGE_METRICS[number];
export type CatalogAchievementMetric = typeof ACHIEVEMENT_METRICS[number];
export const stats = z.strictObject({
  damage: num.nonnegative(), fireRate: pos, magSize: pos, reloadTime: num.nonnegative(),
  spread: num.nonnegative(), adsSpread: num.nonnegative(), recoil: num.nonnegative(),
  range: pos, adsTime: num.nonnegative(), moveSpeed: pos, auto: z.boolean(),
  headshotMult: pos, falloffEndMultiplier: pos.optional(),
  minDamageMultiplier: unit.optional(), burst: pos.int().optional(),
  pellets: pos.int().optional(), reloadStyle: z.literal("incremental").optional(),
  reloadPerRound: pos.optional(), reloadOnlyWhenEmpty: z.boolean().optional(),
  coverPenetration: num.nonnegative().optional(),
  // Opt-in human-body hitscan only (cover/shields remain impenetrable).
  bodyPenetration: z.strictObject({
    maxTargets: pos.int().min(2).max(3),
    damageRetention: unit.refine(v => v > 0, "Retention must be positive"),
  }).optional(),
});
export const heat = z.strictObject({
  kind: z.literal("heat"), heatPerShot: pos, coolPerSecond: pos, coolDelayMs: count,
  overheatAt: pos, resumeAt: num.nonnegative(), ventSeconds: pos,
});
export const arc = z.strictObject({ kind: z.literal("arc"), jumps: pos.int(), radius: pos, decay: unit });
export const bolt = z.strictObject({
  kind: z.literal("bolt"), pickupRadius: pos, lifetimeMs: pos, quickReloadSeconds: pos,
});
export const throwingKnife = z.strictObject({kind:z.literal("throwing_knife")});
export const weapon = z.strictObject({
  id, name: label, description: label, category,
  unlockLevel: pos.int().max(MAX_PLAYER_LEVEL), unlockCost: count,
  stats, disabled: z.boolean().optional(), attachments: z.array(slot).optional(), baseSightType: z.string().optional(),
  explosive: z.strictObject({ radius: pos }).optional(),
  special: z.discriminatedUnion("kind", [heat, arc, bolt, throwingKnife]).optional(),
  wonder: z.strictObject({
    kind: z.enum(["singularity", "corrosion", "turret", "smart", "flame", "storm", "sludge", "cluster", "shield"]),
    maxCharges: z.number().int().min(1).max(8),
    rechargeMs: pos, killBonusMs: count, radius: num.nonnegative(),
  }).optional(),
});
export const statEffect = z.strictObject({
  damage: num.optional(), recoil: num.optional(), spread: num.optional(),
  adsSpread: num.optional(), adsTime: num.optional(), magSize: num.optional(), fireRate: num.optional(),
  reloadTime: num.optional(), moveSpeed: num.optional(), range: num.optional(),
});
export const attachment = z.strictObject({
  id, name: label, description: label, slot, unlockLevel: pos.int().max(MAX_PLAYER_LEVEL),
  unlockCost: count, exclusiveWeaponIds: z.array(id).optional(),
  weaponCategories: z.array(category).optional(), recommendedFor: z.array(category).optional(),
  sightType: z.string().optional(),
  shotgunAmmo: z.enum(["slug","pellets","dragons_breath","beanbag"]).optional(),
  bodyPenetration: z.object({
    maxTargets: pos.int().min(2).max(3),
    damageRetention: unit.refine(v => v > 0, "Retention must be positive"),
    retentionBonus: unit.optional(),
  }).optional(),
  effects: statEffect,
  heatOnly: z.boolean().optional(),
  categoryEffects: z.record(z.string(),statEffect).optional(),
  weaponEffects: z.record(z.string(),statEffect).optional(),
  heatEffects: z.strictObject({
    heatPerShot: num.optional(), coolPerSecond: num.optional(), coolDelayMs: num.optional(),
    ventSeconds: num.optional(), overheatAt: num.optional(), resumeAt: num.optional(),
  }).optional(),
});
export const skin = z.strictObject({
  id, name: label, unlockLevel: pos.int().max(MAX_PLAYER_LEVEL), unlockCost: count, rarity: weaponSkinRarity,
  tier: z.enum(["standard", "rare", "legendary"]), artBrief: label, color: cssColor,
  metalness: unit, roughness: unit, emissive: cssColor.optional(),
  emissiveIntensity: num.nonnegative().optional(),
  prestige: z.enum(["cosmic", "toxic"]).optional(), shopCurrency: z.enum(["credits", "career"]).optional(),
});
export const operator = z.strictObject({
  id, name: label, unlockLevel: pos.int().max(MAX_PLAYER_LEVEL), unlockCost: count, rarity,
  color: cssColor, accent: cssColor, emissive: cssColor.optional(), shopCurrency: z.enum(["credits", "career"]).optional(),
  levelReward: z.boolean().optional(),
});
export const challenge = z.strictObject({
  id, weaponId: id, skinId: id, goal: pos,
  metric: weaponChallengeMetric, title: label, description: label,
  requirements: z.array(z.strictObject({ metric: weaponChallengeMetric, goal: pos })).optional(),
});
export const rotatingChallenge = z.strictObject({
  id, metric: rotatingMetric, goal: pos, rewardXp: count, rewardCredits: count,
  title: label, description: label, icon: label,
  category: z.enum(["daily", "weekly", "elite"]).optional(),
});
export const achievement = z.strictObject({
  id, metric: achievementMetric, goal: pos, rewardXp: count, rewardCredits: count,
  title: label, description: label, icon: label,
  tier: z.enum(["bronze", "silver", "gold", "platinum"]),
  category: z.enum(["pvp", "pve", "career", "mastery"]),
  series: id,
  seriesTier: pos.int(),
  rewardTitle: label.optional(),
});
export const sight = z.strictObject({
  type: z.enum(SIGHT_TYPES), name: label, zoom: pos,
  reticle: z.enum(["iron","dot","holo","chevron","mildot","thermal","nvg","laser"]),
  adsFovReduction: num, adsSensMul: pos, description: label,
  overlay: z.enum(["thermal","nvg","laser"]).optional(),
});



/** Every shipped JSON catalog has exactly one structural schema. */
export const CATALOG_SCHEMAS = {
  weapons:z.array(weapon),
  attachments:z.array(attachment),
  "weapon-skins":z.array(skin),
  "operator-skins":z.array(operator),
  "weapon-challenges":z.array(challenge),
  "daily-challenges":z.array(rotatingChallenge),
  "weekly-challenges":z.array(rotatingChallenge),
  "elite-quests":z.array(rotatingChallenge),
  achievements:z.array(achievement),
  ranks:z.array(z.strictObject({level:pos.int(),name:label,shortName:label,color:cssColor,insignia:label})),
  "killstreak-callouts":z.array(z.strictObject({threshold:pos.int(),label,icon:label,color:cssColor})),
  "sight-definitions":z.record(z.string(),sight),
  "attachment-compatibility":z.record(z.string(),z.record(z.string(),z.array(id))),
  "category-attachments":z.record(z.string(),z.record(z.string(),z.array(id))),
  rewards:z.record(z.string(),num),
  "achievement-colors":z.record(z.string(),cssColor),
  "match-modes":z.record(z.string(),z.strictObject({
    id:label,label,description:label,icon:label,defaultScoreLimit:count,
    scoreOptions:z.array(count),defaultTimeLimit:count,timeOptions:z.array(count),
    teamBased:z.boolean(),accentColor:cssColor,
  })),
} as const;
export type CatalogName = keyof typeof CATALOG_SCHEMAS;

/** Checked-in schemas that external editors and scripts already consume. */
export const PUBLISHED_CATALOG_SCHEMA_NAMES = [
  "weapons","attachments","weapon-skins","operator-skins","weapon-challenges",
] as const;
export type PublishedCatalogSchemaName = typeof PUBLISHED_CATALOG_SCHEMA_NAMES[number];

/** Stable fields underpinning both JSON authoring and gameplay public types. */
export type WeaponCatalogDef = z.infer<typeof weapon>;
export type AttachmentCatalogDef = z.infer<typeof attachment>;
export type WeaponSkinCatalogDef = z.infer<typeof skin>;
export type OperatorSkinCatalogDef = z.infer<typeof operator>;
export type WeaponChallengeCatalogDef = z.infer<typeof challenge>;
export type RotatingChallengeCatalogDef = z.infer<typeof rotatingChallenge>;
export type AchievementCatalogDef = z.infer<typeof achievement>;
