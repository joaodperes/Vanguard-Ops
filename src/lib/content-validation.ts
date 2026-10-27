/**
 * Build-time content validation. Safe to import from Bun tests or scripts;
 * game startup deliberately does not run schemas on every frame.
 *
 * Keep this in sync with the declarative catalog format documented in
 * docs/content-authoring.md and with the public types in game-data.ts.
 */
import { z } from "zod";
import { MAX_PLAYER_LEVEL } from "./progression";
import {
  WEAPONS, ATTACHMENTS, WEAPON_SKINS, PLAYER_SKINS, WEAPON_CHALLENGES,
  WEAPON_ATTACHMENT_COMPAT, CATEGORY_ATTACHMENT_CHOICES, SIGHT_DEFS,
  DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, ELITE_QUESTS, ACHIEVEMENTS,
  RANKS, REWARDS, MATCH_MODES, KILLSTREAK_CALLOUTS,
  ACHIEVEMENT_TIER_COLORS,
} from "./game-data";
import { MAP_BLUEPRINTS, validateBlueprint } from "./map-blueprints";
import { MAP_VISUAL_THEMES } from "./map-visuals";

const id = z.string().regex(/^[a-z][a-z0-9_:-]*$/);
const label = z.string().min(1);
const num = z.number().finite();
const count = num.int().nonnegative();
const pos = num.positive();
const unit = num.min(0).max(1);
const category = z.enum(["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "pistol", "pdw", "launcher", "melee"]);
const slot = z.enum(["sight", "barrel", "grip", "magazine"]);
const rarity = z.enum(["common", "rare", "epic", "legendary"]);
const weaponSkinRarity = z.enum(["common", "rare", "epic", "legendary", "prestige"]);
const cssColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const stats = z.object({
  damage: num.nonnegative(), fireRate: pos, magSize: pos, reloadTime: num.nonnegative(),
  spread: num.nonnegative(), adsSpread: num.nonnegative(), recoil: num.nonnegative(),
  range: pos, adsTime: num.nonnegative(), moveSpeed: pos, auto: z.boolean(),
  headshotMult: pos, falloffEndMultiplier: pos.optional(),
  minDamageMultiplier: unit.optional(), burst: pos.int().optional(),
  pellets: pos.int().optional(), reloadStyle: z.literal("incremental").optional(),
  reloadPerRound: pos.optional(),
});
const heat = z.object({
  kind: z.literal("heat"), heatPerShot: pos, coolPerSecond: pos, coolDelayMs: count,
  overheatAt: pos, resumeAt: num.nonnegative(), ventSeconds: pos,
});
const arc = z.object({ kind: z.literal("arc"), jumps: pos.int(), radius: pos, decay: unit });
const bolt = z.object({
  kind: z.literal("bolt"), pickupRadius: pos, lifetimeMs: pos, quickReloadSeconds: pos,
});
const weapon = z.object({
  id, name: label, description: label, category,
  unlockLevel: pos.int().max(MAX_PLAYER_LEVEL), unlockCost: count,
  stats, disabled: z.boolean().optional(), attachments: z.array(slot).optional(), baseSightType: z.string().optional(),
  explosive: z.object({ radius: pos }).optional(),
  special: z.discriminatedUnion("kind", [heat, arc, bolt]).optional(),
  wonder: z.object({
    kind: z.enum(["singularity", "corrosion", "turret", "smart", "flame", "storm", "sludge"]),
    maxCharges: z.number().int().min(1).max(8),
    rechargeMs: pos, killBonusMs: count, radius: num.nonnegative(),
  }).optional(),
});
const attachment = z.object({
  id, name: label, description: label, slot, unlockLevel: pos.int().max(MAX_PLAYER_LEVEL),
  unlockCost: count, exclusiveWeaponIds: z.array(id).optional(),
  weaponCategories: z.array(category).optional(), recommendedFor: z.array(category).optional(),
  sightType: z.string().optional(),
  shotgunAmmo: z.enum(["slug","pellets","dragons_breath","beanbag"]).optional(),
  effects: z.object({
    damage: num.optional(), recoil: num.optional(), spread: num.optional(),
    adsSpread: num.optional(), adsTime: num.optional(), magSize: num.optional(),
    reloadTime: num.optional(), moveSpeed: num.optional(), range: num.optional(),
  }),
});
const skin = z.object({
  id, name: label, unlockLevel: pos.int().max(MAX_PLAYER_LEVEL), unlockCost: count, rarity: weaponSkinRarity,
  tier: z.enum(["standard", "rare", "legendary"]), artBrief: label, color: cssColor,
  metalness: unit, roughness: unit, emissive: cssColor.optional(),
  emissiveIntensity: num.nonnegative().optional(),
  prestige: z.enum(["cosmic", "toxic"]).optional(), shopCurrency: z.enum(["credits", "career"]).optional(),
});
const operator = z.object({
  id, name: label, unlockLevel: pos.int().max(MAX_PLAYER_LEVEL), unlockCost: count, rarity,
  color: cssColor, accent: cssColor, emissive: cssColor.optional(),
});
const challenge = z.object({
  id, weaponId: id, skinId: id, goal: pos,
  metric: z.string().min(1), title: label, description: label,
  requirements: z.array(z.object({ metric: label, goal: pos })).optional(),
});
const rotatingChallenge = z.object({
  id, metric: label, goal: pos, rewardXp: count, rewardCredits: count,
  title: label, description: label, icon: label,
  category: z.enum(["daily", "weekly", "elite"]).optional(),
});
const achievement = z.object({
  id, metric: label, goal: pos, rewardXp: count, rewardCredits: count,
  title: label, description: label, icon: label,
  tier: z.enum(["bronze", "silver", "gold", "platinum"]),
  category: z.enum(["pvp", "pve", "career", "mastery"]),
  series: id,
  seriesTier: pos.int(),
  rewardTitle: label.optional(),
});
const sight = z.object({
  type: label, name: label, zoom: pos, reticle: label,
  adsFovReduction: num, adsSensMul: pos, description: label,
  overlay: z.string().optional(),
});

export interface ContentValidationInput {
  weapons?: unknown;
  attachments?: unknown;
  weaponSkins?: unknown;
  operatorSkins?: unknown;
  weaponChallenges?: unknown;
  achievements?: unknown;
}

/** A human-readable list, stable enough for CI errors and unit assertions. */
export function validateGameContent(overrides: ContentValidationInput = {}): string[] {
  const issues: string[] = [];
  const w = (overrides.weapons ?? WEAPONS) as unknown;
  const a = (overrides.attachments ?? ATTACHMENTS) as unknown;
  const sk = (overrides.weaponSkins ?? WEAPON_SKINS) as unknown;
  const op = (overrides.operatorSkins ?? PLAYER_SKINS) as unknown;
  const ch = (overrides.weaponChallenges ?? WEAPON_CHALLENGES) as unknown;
  const achievements = overrides.achievements ?? ACHIEVEMENTS;

  function check(name: string, value: unknown, schema: z.ZodTypeAny): void {
    const parsed = schema.safeParse(value);
    if (!parsed.success) for (const error of parsed.error.issues)
      issues.push(name + " [" + error.path.join(".") + "]: " + error.message);
  }
  function unique(name: string, value: unknown): void {
    if (!Array.isArray(value)) return;
    const found = new Set<string>();
    for (const entry of value) {
      if (!entry || typeof entry.id !== "string") continue;
      if (found.has(entry.id)) issues.push(name + ": duplicate ID " + entry.id);
      found.add(entry.id);
    }
  }
  const arrays: [string, unknown, z.ZodTypeAny][] = [
    ["weapons", w, z.array(weapon)],
    ["attachments", a, z.array(attachment)],
    ["weapon skins", sk, z.array(skin)],
    ["operator skins", op, z.array(operator)],
    ["weapon challenges", ch, z.array(challenge)],
    ["daily challenges", DAILY_CHALLENGE_POOL, z.array(rotatingChallenge)],
    ["weekly challenges", WEEKLY_CHALLENGE_POOL, z.array(rotatingChallenge)],
    ["elite quests (legacy)", ELITE_QUESTS, z.array(rotatingChallenge)],
    ["achievements", achievements, z.array(achievement)],
    ["ranks", RANKS, z.array(z.object({level:pos.int(),name:label,shortName:label,color:cssColor,insignia:label}))],
    ["killstreak callouts", KILLSTREAK_CALLOUTS, z.array(z.object({threshold:pos.int(),label,icon:label,color:cssColor}))],
  ];
  for (const [name, value, schema] of arrays) {
    check(name, value, schema);
    unique(name, value);
  }
  const parsedAchievements = z.array(achievement).safeParse(achievements);
  if (parsedAchievements.success) {
    const tiers = new Set<string>();
    for (const entry of parsedAchievements.data) {
      const key = `${entry.series}:${entry.seriesTier}`;
      if (tiers.has(key)) issues.push(`achievements: duplicate series tier ${key}`);
      tiers.add(key);
      if (entry.rewardTitle && parsedAchievements.data.some(other => other.series === entry.series && other.seriesTier > entry.seriesTier))
        issues.push(`achievements: ${entry.id} grants a title before the final series tier`);
    }
  }
  check("sight definitions", SIGHT_DEFS, z.record(z.string(), sight));
  check("attachment compatibility", WEAPON_ATTACHMENT_COMPAT, z.record(z.string(), z.record(z.string(), z.array(id))));
  check("category attachment choices", CATEGORY_ATTACHMENT_CHOICES, z.record(z.string(), z.record(z.string(), z.array(id))));
  check("reward constants", REWARDS, z.record(z.string(), num));
  check("achievement tier colors", ACHIEVEMENT_TIER_COLORS, z.record(z.string(), cssColor));
  check("match modes", MATCH_MODES, z.record(z.string(), z.object({
    id:label,label,description:label,icon:label,defaultScoreLimit:count,
    scoreOptions:z.array(count),defaultTimeLimit:count,timeOptions:z.array(count),
    teamBased:z.boolean(),accentColor:cssColor,
  })));

  if (Array.isArray(w) && Array.isArray(a) && Array.isArray(sk) && Array.isArray(ch)) {
    const weaponIds = new Set(w.map(v => v?.id));
    const attachmentIds = new Map(a.map(v => [v?.id,v?.slot]));
    const skinIds = new Set(sk.map(v => v?.id));
    for (const item of ch) {
      if (!weaponIds.has(item?.weaponId)) issues.push("weapon challenge " + item?.id + ": unknown weapon " + item?.weaponId);
      if (!skinIds.has(item?.skinId)) issues.push("weapon challenge " + item?.id + ": unknown skin " + item?.skinId);
    }
    for (const item of a) for (const ref of item?.exclusiveWeaponIds ?? [])
      if (!weaponIds.has(ref)) issues.push("attachment " + item.id + ": unknown exclusive weapon " + ref);

    for (const [name, rules] of [
      ["attachment compatibility", WEAPON_ATTACHMENT_COMPAT],
      ["category attachment choices", CATEGORY_ATTACHMENT_CHOICES],
    ] as const) {
      for (const [key, slots] of Object.entries(rules)) {
        if (name === "attachment compatibility" && !weaponIds.has(key))
          issues.push(name + ": unknown weapon " + key);
        if (name === "category attachment choices" && !category.safeParse(key).success)
          issues.push(name + ": unknown category " + key);
        for (const [s, ids] of Object.entries(slots)) {
          if (!slot.safeParse(s).success) issues.push(name + " " + key + ": invalid slot " + s);
          for (const ref of ids ?? []) {
            if (!attachmentIds.has(ref)) issues.push(name + " " + key + ": unknown attachment " + ref);
            else if (attachmentIds.get(ref) !== s) issues.push(name + " " + key + ": slot mismatch " + ref);
          }
        }
      }
    }
  }

  for (const [key, def] of Object.entries(SIGHT_DEFS))
    if (key !== def.type) issues.push("sight definition " + key + ": mismatched type " + def.type);
  if (Array.isArray(w)) for (const item of w) {
    if (item?.baseSightType && !(item.baseSightType in SIGHT_DEFS))
      issues.push("weapon " + item.id + ": unknown baseSightType " + item.baseSightType);
    if (item?.category === "launcher" && !(typeof item?.explosive?.radius === "number" && item.explosive.radius > 0))
      issues.push("weapon " + item.id + ": launcher requires a positive explosive radius");
    if (item?.category !== "launcher" && item?.explosive)
      issues.push("weapon " + item.id + ": non-launcher cannot declare explosive radius");
  }
  if (Array.isArray(a)) for (const item of a)
    if (item?.sightType && !(item.sightType in SIGHT_DEFS))
      issues.push("attachment " + item.id + ": unknown sightType " + item.sightType);

  // Every shipped biome has a separate JSON palette and prop library.
  // Validate those files as well as walkable geometry, not just map metadata.
  const themeSchema=z.object({
    biome:label,label,ambient:pos,vegetation:unit,
    surfaces:z.record(
      z.enum(["floor","wall","cover","stair","platform"]),
      z.object({
        pattern:z.enum(["concrete","metal","grate","planks","rust","moss","brick","stone","pavers","snow","asphalt","grass"]),tileSize:pos.max(100),roughness:unit,
      }).strict(),
    ).refine(s=>["floor","wall","cover","stair","platform"].every(k=>k in s),
      "Every map requires floor/wall/cover/stair/platform surface recipes").optional(),
    palette:z.object({
      floor:cssColor,wall:cssColor,cover:cssColor,accent:cssColor,
      platform:cssColor,stair:cssColor,sky:cssColor,fog:cssColor,grid:cssColor,
    }),
    props:z.array(z.object({
      kind:z.enum(["tree","bush","rock","ruin","temple","shop","lamp","container",
        "crane","terminal","sign","antenna","building","boat","dock","garden","bench","bandstand",
        "furnace","conveyor","hydraulic_press","generator","storage_rack","vent_stack",
        "industrial_pipe","steel_coil","cargo_pallet"]),
      x:num,z:num,y:num.optional(),w:pos.optional(),d:pos.optional(),h:pos.optional(),text:label.optional(),color:cssColor.optional(),
    })),
  });
  for(const [mapId,theme] of Object.entries(MAP_VISUAL_THEMES))
    check("visual theme "+mapId,theme,themeSchema);
    if (MAP_BLUEPRINTS.version !== 1) issues.push("map blueprints: unsupported version");
  if (!Object.keys(MAP_BLUEPRINTS.maps).length) issues.push("map blueprints: no maps");
  for (const [mapId, bp] of Object.entries(MAP_BLUEPRINTS.maps)) {
    if (!id.safeParse(mapId).success) issues.push("map " + mapId + ": invalid ID");
    for (const problem of validateBlueprint(bp)) issues.push("map " + mapId + ": " + problem);
    if (bp.templateMapId && !(bp.templateMapId in MAP_BLUEPRINTS.maps))
      issues.push("map " + mapId + ": unknown base template " + bp.templateMapId);
  }
  return issues;
}
