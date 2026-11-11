import { equipmentAvailable, equipmentById } from "./equipment";
// ============================================================================
// VANGUARD OPS — Static game data catalog
// Shared between API routes, the game server, and the client UI.
// ============================================================================

import type { HeatConfig } from "./weapon-mechanics";
import { isFanHammer, isAkimboWeapon, FAN_HAMMER_RATE_MULTIPLIER } from "./weapon-mechanics";
import { perkById, type PerkId } from "./perks";
// Authoritative static content lives in JSON; keep runtime helpers and public exports here.
import weaponsData from "../data/catalogs/weapons.json";
import attachmentCompatibilityData from "../data/catalogs/attachment-compatibility.json";
import categoryAttachmentsData from "../data/catalogs/category-attachments.json";
import sightDefinitionsData from "../data/catalogs/sight-definitions.json";
import attachmentsData from "../data/catalogs/attachments.json";
import weaponSkinsData from "../data/catalogs/weapon-skins.json";
import operatorSkinsData from "../data/catalogs/operator-skins.json";
import weaponChallengesData from "../data/catalogs/weapon-challenges.json";
import rewardsData from "../data/catalogs/rewards.json";
import ranksData from "../data/catalogs/ranks.json";
import dailyChallengesData from "../data/catalogs/daily-challenges.json";
import weeklyChallengesData from "../data/catalogs/weekly-challenges.json";
import eliteQuestsData from "../data/catalogs/elite-quests.json";
import achievementsData from "../data/catalogs/achievements.json";
import achievementColorsData from "../data/catalogs/achievement-colors.json";
import matchModesData from "../data/catalogs/match-modes.json";
import killstreakCalloutsData from "../data/catalogs/killstreak-callouts.json";

import {ORBITAL_REAPER,ORBITAL_REAPER_ID} from "./orbital-reactor";

// Category values belong to the shared content contract.
export type WeaponCategory = import("./catalog-contract").CatalogWeaponCategory;;

// Weapon slots are the three loadout positions a player can equip.
// primary  -> assault / smg / shotgun / dmr / sniper / lmg
// secondary -> pistol / pdw / launcher
// melee    -> ordinary melee gear (Wonders, even melee-themed ones, use slot 4)
// wonder   -> Prestige Wonder Weapon
export type WeaponSlot = "primary" | "secondary" | "melee" | "wonder";

// The secondary accepts a second primary only with Well Prepared.
export function isPrimaryWeaponCategory(category: WeaponCategory): boolean {
  return ["assault", "smg", "shotgun", "dmr", "sniper", "lmg"].includes(category);
}

// Map a weapon category to its loadout slot.
export function weaponSlot(category: WeaponCategory): WeaponSlot {
  switch (category) {
    case "pistol":
    case "pdw":
    case "launcher": return "secondary";
    case "melee": return "melee";
    default: return "primary";
  }
}

export type WeaponStats = import("./catalog-contract").WeaponCatalogDef["stats"];

export type WeaponDef = import("./catalog-contract").WeaponCatalogDef;

export const WEAPONS: WeaponDef[] = weaponsData as unknown as WeaponDef[];

/** Melee is a combat category, not an entitlement: seismic and other melee Wonders use slot 4. */
export function isStandardMeleeWeapon(weapon: WeaponDef): boolean {
  return weapon.category === "melee" && !weapon.disabled && !weapon.wonder;
}
/** Invalid, disabled or Wonder-only melee choices safely fall back to the standard knife. */
export function activeMeleeWeaponId(id: string | null | undefined): string {
  return WEAPONS.find(w => w.id === id && isStandardMeleeWeapon(w))?.id ?? "knife_tactical";
}
/** Shield Wonders use a normal P-9 magazine; ownership is still Wonder-only. */
export function usesWonderCharges(weapon: WeaponDef): boolean { return !!weapon.wonder && weapon.wonder.kind !== "shield"; }

/** Single source for offline and authoritative server projectile blast radii. */
export function projectileSplashRadius(weapon: WeaponDef): number {
  return weapon.explosive?.radius ?? weapon.wonder?.radius ?? 8;
}

export type AttachmentSlot = import("./catalog-contract").CatalogAttachmentSlot;;

// All 4 attachment slots, in canonical display order.
export const ALL_ATTACHMENT_SLOTS: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];

// Per-weapon attachment compatibility map. If a weapon isn't in this map, all
// attachments for that slot are allowed. If a weapon IS in the map for a slot,
// only the listed attachment IDs are compatible with that weapon.
export const WEAPON_ATTACHMENT_COMPAT: Record<string, Partial<Record<AttachmentSlot, string[]>>> = attachmentCompatibilityData as unknown as Record<string, Partial<Record<AttachmentSlot, string[]>>>;

// Curated, balanced 2–4 attachment choices for each supported category/slot.
// Weapon-specific overrides above win (special mechanics, sniper restrictions).
// No generic "all attachments" fallback: the Armory and server must agree on
// which attachments are valid for a particular weapon.
export const CATEGORY_ATTACHMENT_CHOICES: Partial<Record<WeaponCategory, Partial<Record<AttachmentSlot, string[]>>>> = categoryAttachmentsData as unknown as Partial<Record<WeaponCategory, Partial<Record<AttachmentSlot, string[]>>>>;

export function compatibleAttachments(weaponId: string, slot: AttachmentSlot): string[] {
  const weapon = weaponById(weaponId);
  if (!weaponAttachmentSlots(weapon).includes(slot)) return [];
  // Heat weapons share a reusable pool of cooling, venting and emitter hardware.
  // Explicit weapon overrides take precedence; conventional magazines never apply.
  const heatOptions: Partial<Record<AttachmentSlot, string[]>> = {
    barrel: ["barrel_heat_sink", "barrel_heat_focus", "barrel_heat_compact", "barrel_heat_insulated"],
    magazine: ["mag_heat_reservoir", "mag_heat_quickvent", "mag_heat_coolant", "mag_heat_lightweight"],
  };
  const allowed = WEAPON_ATTACHMENT_COMPAT[weaponId]?.[slot] ??
    (weapon.special?.kind === "heat" && heatOptions[slot]
      ? heatOptions[slot] : CATEGORY_ATTACHMENT_CHOICES[weapon.category]?.[slot]) ?? [];
  return allowed.filter(id => ATTACHMENTS.some(a =>
    a.id === id && a.slot === slot &&
    (!a.exclusiveWeaponIds || a.exclusiveWeaponIds.includes(weaponId)) &&
    (!a.heatOnly || weapon.special?.kind === "heat")
  ));
}

// Helper: list the attachment slots a weapon supports. Defaults to all 4.
export function weaponAttachmentSlots(weapon: WeaponDef): AttachmentSlot[] {
  return weapon.attachments ?? ALL_ATTACHMENT_SLOTS;
}

// ---- Sight system -----------------------------------------------------------
// Sight attachments reference a SightType, which carries the optic's zoom level,
// reticle style, and any ADS visual overlay (thermal/NVG tint, laser beam, etc.).
// "iron" is the default sight used when no sight attachment is equipped.
export type SightType = import("./catalog-contract").CatalogSightType;

export type SightDef = import("./catalog-contract").SightCatalogDef;

export const SIGHT_DEFS: Record<SightType, SightDef> = sightDefinitionsData as unknown as Record<SightType, SightDef>;

export const SIGHT_LIST: SightDef[] = Object.values(SIGHT_DEFS);

/** Convert true optical magnification into a camera FOV at any player-selected base FOV.
 * 1x sights preserve the existing ADS framing instead of adding artificial optical zoom.
 */
export function adsFieldOfView(baseFov: number, sight: Pick<SightDef, "zoom" | "adsFovReduction">, progress = 1): number {
  const p = Math.max(0, Math.min(1, progress));
  const scopedFov = sight.zoom > 1
    ? 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) / sight.zoom) * 180 / Math.PI
    : baseFov - sight.adsFovReduction;
  return baseFov + (scopedFov - baseFov) * p;
}

export function sightDefForType(type: SightType): SightDef {
  return SIGHT_DEFS[type] ?? SIGHT_DEFS.iron;
}

// Resolve the effective sight for a loadout: returns the SightDef for the equipped
// sight attachment, or the weapon's baseSightType (default "iron") if no sight is
// equipped. Snipers set baseSightType="sniper_scope" so they get a 6x scope out
// of the box instead of iron sight.
export function sightDefForAttachments(atts: Partial<Record<AttachmentSlot, string | null>>, baseSightType?: SightType): SightDef {
  const sightId = atts.sight;
  if (!sightId) return SIGHT_DEFS[baseSightType ?? "iron"];
  const def = ATTACHMENTS.find((a) => a.id === sightId);
  if (def?.sightType) return SIGHT_DEFS[def.sightType];
  return SIGHT_DEFS[baseSightType ?? "iron"];
}

/** Whether this exact weapon has a physical optic/sight piece to render.
 * An explicit compatible sight or an authored factory scope counts; an empty
 * slot never inherits optics from another weapon or from stale/invalid ids.
 */
export function hasMountedSight(weapon: WeaponDef, atts: Partial<Record<AttachmentSlot, string | null>>): boolean {
  const id = atts.sight;
  const mountedAttachment = !!id && compatibleAttachments(weapon.id, "sight").includes(id) &&
    ATTACHMENTS.some(a => a.id === id && a.slot === "sight" && !!a.sightType);
  const factoryScope = !!weapon.baseSightType && weapon.baseSightType !== "iron";
  return mountedAttachment || factoryScope;
}

export type AttachmentDef = import("./catalog-contract").AttachmentCatalogDef;

export const ATTACHMENTS: AttachmentDef[] = attachmentsData as unknown as AttachmentDef[];

export function attachmentEffectsForWeapon(att: AttachmentDef, weapon: WeaponDef): AttachmentDef["effects"] {
  return { ...att.effects, ...(att.categoryEffects?.[weapon.category] ?? {}), ...(att.weaponEffects?.[weapon.id] ?? {}) };
}

/** Heat upgrades are defined by mechanic rather than weapon ID, so subsequent
 * heat weapons inherit the same cooling hardware and authoritative handling. */
export function effectiveHeatConfig(weapon: WeaponDef, atts: Partial<Record<AttachmentSlot,string|null>>): HeatConfig | null {
  const special = weapon.special;
  if (special?.kind !== "heat") return null;
  const mods: Record<string, number> = {};
  for (const slot of ALL_ATTACHMENT_SLOTS) {
    const id = atts[slot];
    if (!id || !compatibleAttachments(weapon.id,slot).includes(id)) continue;
    const attachment = attachmentById(id);
    for (const [key,value] of Object.entries(attachment?.heatEffects ?? {}))
      mods[key] = (mods[key] ?? 0) + value;
  }
  const scaled = (key: keyof HeatConfig, base: number) => base * (1 + (mods[key] ?? 0)/100);
  const overheatAt = Math.max(10,scaled("overheatAt",special.overheatAt));
  return { ...special,
    heatPerShot: Math.max(.1,scaled("heatPerShot",special.heatPerShot)),
    coolPerSecond: Math.max(.1,scaled("coolPerSecond",special.coolPerSecond)),
    coolDelayMs: Math.max(0,scaled("coolDelayMs",special.coolDelayMs)),
    ventSeconds: Math.max(.2,scaled("ventSeconds",special.ventSeconds)),
    overheatAt,
    resumeAt: Math.min(overheatAt - 1,Math.max(0,scaled("resumeAt",special.resumeAt))),
  };
}

export type WeaponSkinDef = import("./catalog-contract").WeaponSkinCatalogDef;

// Wildcard weaponId used in SkinUnlock rows for standard-tier skins. A skin
// unlocked with weaponId="*" is available on every weapon (one unlock grants
// it globally). Non-standard skins use the specific weaponId they were
// unlocked for.
export const SKIN_WILDCARD_WEAPON_ID = "*";

// Helper: is this skin tier globally unlocked by a single SkinUnlock row?
export function isStandardSkin(skin: WeaponSkinDef): boolean {
  return skin.tier === "standard";
}

export const WEAPON_SKINS: WeaponSkinDef[] = weaponSkinsData as unknown as WeaponSkinDef[];

export type PlayerSkinDef = import("./catalog-contract").OperatorSkinCatalogDef;

export const PLAYER_SKINS: PlayerSkinDef[] = operatorSkinsData as unknown as PlayerSkinDef[];

// ============================================================================
// WEAPON CHALLENGES — per-weapon skin unlocks.
// Skins are no longer unlocked by player level alone; they're earned by hitting
// gameplay milestones with a specific weapon. Each challenge maps a (weaponId,
// metric, goal) to a skinId reward. The Armory shows live progress and the
// match-completion flow auto-grants the skin when a challenge is cleared.
// ============================================================================
// Persistent per-elimination conditions shared by gameplay and progression.
export type WeaponConditionMetric = import("./catalog-contract").CatalogWeaponConditionMetric;
export type WeaponChallengeMetric = import("./catalog-contract").CatalogWeaponChallengeMetric;

export type WeaponChallengeDef = import("./catalog-contract").WeaponChallengeCatalogDef;

export const WEAPON_CHALLENGES: WeaponChallengeDef[] = weaponChallengesData as unknown as WeaponChallengeDef[];

// Helper: list all challenges for a given weapon.
export function challengesForWeapon(weaponId: string): WeaponChallengeDef[] {
  return WEAPON_CHALLENGES.filter((c) => c.weaponId === weaponId);
}

// Helper: list all challenges whose skin reward applies to the given weapon.
export function skinChallengesForWeapon(weaponId: string, skinId: string): WeaponChallengeDef[] {
  return WEAPON_CHALLENGES.filter((c) => c.weaponId === weaponId && c.skinId === skinId);
}

// XP is authoritative for every level gate. Keep stable exports for callers.
export { MAX_PLAYER_LEVEL, totalXpForLevel, levelForXp, xpProgressInLevel } from "./progression";

// All combat and objective payouts share the deployment-bundled catalog.
export const REWARDS = rewardsData;

// ---- Lookup helpers ---------------------------------------------------------
export const weaponById = (id: string) => id===ORBITAL_REAPER_ID?ORBITAL_REAPER:WEAPONS.find(w=>w.id===id)??WEAPONS[0];
export const attachmentById = (id: string) => ATTACHMENTS.find((a) => a.id === id);
export const weaponSkinById = (id: string) => WEAPON_SKINS.find((s) => s.id === id) ?? WEAPON_SKINS[0];
export const playerSkinById = (id: string) => PLAYER_SKINS.find((s) => s.id === id) ?? PLAYER_SKINS[0];

export interface ResolvedLoadout {
  equipmentId: import("./equipment").EquipmentId;
  perkId: PerkId;
  wonderWeaponId: string;
  wonderModuleId?: string;
  wonderSkinId?: string;
  wonderKillEffectId?: string;
  weapon: WeaponDef;
  secondary: WeaponDef;
  melee: WeaponDef;
  weaponSkin: WeaponSkinDef;
  // Per-weapon skins (secondary + melee). Each slot has its own skin so
  // changing one doesn't change the others.
  secondaryWeaponSkin: WeaponSkinDef;
  meleeWeaponSkin: WeaponSkinDef;
  playerSkin: PlayerSkinDef;
  primaryReticle: string; secondaryReticle: string;
  primaryCharm: string; secondaryCharm: string;
  attachments: Record<AttachmentSlot, string | null>;
  // Secondary-slot attachments (sidearms). Defaults to all-null when not provided.
  secondaryAttachments: Record<AttachmentSlot, string | null>;
  // Melee-slot attachments. Always all-null for now (melee weapons don't take
  // attachments) — included for forward-compat.
  meleeAttachments: Record<AttachmentSlot, string | null>;
}

export function resolveLoadout(input: {
  perkId?: string;
  wonderWeaponId?: string;
  primaryWeapon: string;
  secondaryWeapon?: string;
  meleeWeapon?: string;
  equipmentId?: string;
  /** Account level for live loadout entitlement validation. Omit for previews. */
  level?: number;
  weaponSkin: string;
  // Per-weapon skins for the secondary + melee slots.
  secondaryWeaponSkin?: string;
  meleeWeaponSkin?: string;
  playerSkin: string;
  primaryReticle?: string; secondaryReticle?: string;
  primaryCharm?: string; secondaryCharm?: string;
  attachments: Record<string, string | null> | string;
  // Optional secondary + melee attachment maps (JSON string or object).
  // Default to all-null if not provided.
  secondaryAttachments?: Record<string, string | null> | string;
  meleeAttachments?: Record<string, string | null> | string;
  // Optional: set of skin IDs unlocked for the equipped primary weapon. When
  // supplied, the resolved skin falls back to "default" if not in this set.
  unlockedSkinsForWeapon?: string[];
  // Optional: skin IDs unlocked for the secondary + melee weapons (per-weapon
  // skin validation). Defaults to ["default"] when not supplied.
  unlockedSkinsForSecondary?: string[];
  unlockedSkinsForMelee?: string[];
}): ResolvedLoadout {
  const parseAtts = (v: Record<string, string | null> | string | undefined): Record<AttachmentSlot, string | null> => {
    const o = v ? (typeof v === "string" ? JSON.parse(v || "{}") : v) : {};
    return {
      sight: o.sight ?? null,
      barrel: o.barrel ?? null,
      grip: o.grip ?? null,
      magazine: o.magazine ?? null,
    };
  };
  const requestedPrimary = weaponById(input.primaryWeapon);
  const weapon = requestedPrimary.disabled || requestedPrimary.wonder ? weaponById("rifle_ar") : requestedPrimary;
  const requestedSecondary = weaponById(input.secondaryWeapon ?? "pistol_side");
  const secondary = requestedSecondary.disabled || requestedSecondary.wonder ? weaponById("pistol_side") : requestedSecondary;
  const meleeId = activeMeleeWeaponId(input.meleeWeapon);
  const replacedMelee = meleeId !== (input.meleeWeapon ?? "knife_tactical");
  // Validate each slot's skin is unlocked for that slot's weapon. If not,
  // fall back to the default skin (which is always available).
  const validateSkin = (skinId: string, unlocked: string[] | undefined): WeaponSkinDef => {
    if (unlocked && !unlocked.includes(skinId)) return weaponSkinById("default");
    return weaponSkinById(skinId);
  };
  const skinId = requestedPrimary.disabled || requestedPrimary.wonder ? weaponSkinById("default") : validateSkin(input.weaponSkin, input.unlockedSkinsForWeapon);
  const secondarySkin = validateSkin(input.secondaryWeaponSkin ?? "default", input.unlockedSkinsForSecondary);
  const meleeSkin = replacedMelee ? weaponSkinById("default") : validateSkin(input.meleeWeaponSkin ?? "default", input.unlockedSkinsForMelee);
  return {
    perkId: perkById(input.perkId).id,
    wonderWeaponId: input.wonderWeaponId ?? "",
    equipmentId: input.level === undefined ? equipmentById(input.equipmentId).id : equipmentAvailable(input.equipmentId, input.level),
    weapon,
    secondary,
    melee: weaponById(meleeId),
    weaponSkin: skinId,
    secondaryWeaponSkin: secondarySkin,
    meleeWeaponSkin: meleeSkin,
    playerSkin: playerSkinById(input.playerSkin),
    primaryReticle: input.primaryReticle ?? "classic", secondaryReticle: input.secondaryReticle ?? "classic",
    primaryCharm: input.primaryCharm ?? "none", secondaryCharm: input.secondaryCharm ?? "none",
    attachments: requestedPrimary.disabled ? parseAtts(undefined) : parseAtts(input.attachments),
    secondaryAttachments: requestedSecondary.disabled ? parseAtts(undefined) : parseAtts(input.secondaryAttachments),
    meleeAttachments: replacedMelee ? parseAtts(undefined) : parseAtts(input.meleeAttachments),
  };
}

// Shared damage model used by offline shots, bots, and the authoritative server.
// An optional per-weapon falloff tuning overrides the conservative defaults.
export function maxWeaponHitRange(range: number, stats: WeaponStats): number {
  return range * Math.max(1.05, stats.falloffEndMultiplier ?? 1.6);
}
export function damageAtRange(baseDamage: number, distance: number, range: number, stats: WeaponStats): number {
  if (distance <= range) return baseDamage;
  const maxRange = maxWeaponHitRange(range, stats);
  const minimum = Math.min(1, Math.max(0.05, stats.minDamageMultiplier ?? 0.4));
  if (distance >= maxRange) return baseDamage * minimum;
  return baseDamage * (1 - (1 - minimum) * (distance - range) / (maxRange - range));
}

// Compute effective stats after applying attachment effects.
// Hipfire and ADS dispersion are independent; hipfire lasers never buff ADS.
export interface EffectiveStats extends WeaponStats {
  shotgunAmmo?: "slug" | "pellets" | "dragons_breath" | "beanbag";
  magSize: number;
  // The resolved sight type for this loadout (engine reads this for zoom/reticle).
  sightType: SightType;
}

export function computeEffectiveStats(weapon: WeaponDef, atts: Record<AttachmentSlot, string | null>): EffectiveStats {
  const base = { ...weapon.stats };
  const acc: Record<string, number> = {};
  for (const slot of ["sight", "barrel", "grip", "magazine"] as AttachmentSlot[]) {
    const id = atts[slot];
    if (!id) continue;
    const def = attachmentById(id);
    if (!def || !compatibleAttachments(weapon.id,slot).includes(id)) continue;
    for (const [k, v] of Object.entries(attachmentEffectsForWeapon(def, weapon))) {
      acc[k] = (acc[k] ?? 0) + (v as number);
    }
  }
  const pct = (val: number, key: string) => base[key as keyof WeaponStats] as number * (1 + (acc[key] ?? 0) / 100);
  // This attachment changes the firing action. Enforce the exact allowlist
  // so illegal/forged secondary attachments cannot activate fanning.
  const fanHammer = isFanHammer(weapon.id, atts.grip) &&
    compatibleAttachments(weapon.id,"grip").includes("grip_fan_hammer");
  const akimbo = isAkimboWeapon(weapon.id,atts.grip) &&
    compatibleAttachments(weapon.id,"grip").includes("grip_akimbo");
  // Shell choice is a magazine attachment but alters projectile behavior. All
  // these values go through EffectiveStats so offline and server agree.
  const ammoAttachment = attachmentById(atts.magazine ?? "");
  // Magazine ammo effects are opt-in and must be legal for this exact weapon.
  const barrelAttachment = attachmentById(atts.barrel ?? "");
  const piercingAmmo = [ammoAttachment,barrelAttachment].find(a =>
    a?.bodyPenetration && compatibleAttachments(weapon.id,a.slot).includes(a.id))?.bodyPenetration;
  const bodyPenetration = !piercingAmmo ? base.bodyPenetration
    : base.bodyPenetration
      ? {
          maxTargets: Math.min(3, Math.max(base.bodyPenetration.maxTargets, piercingAmmo.maxTargets)),
          damageRetention: Math.min(0.85, Math.max(
            base.bodyPenetration.damageRetention + (piercingAmmo.retentionBonus ?? 0),
            piercingAmmo.damageRetention,
          )),
        }
      : { maxTargets: piercingAmmo.maxTargets, damageRetention: piercingAmmo.damageRetention };
  // This energy rating now governs both body and material penetration. Keep
  // the intrinsic rating distinct from direct-hit damage and TTK.
  const shell = weapon.category === "shotgun" && ammoAttachment &&
    compatibleAttachments(weapon.id,"magazine").includes(ammoAttachment.id) ? ammoAttachment.shotgunAmmo : undefined;
  // A slug is a single dense projectile, not a spray of low-energy pellets.
  const coverPenetration = Math.min(6,(base.coverPenetration ?? 0) +
    (piercingAmmo && ammoAttachment?.id === "mag_penetrator" ? .6 : 0) + (shell === "slug" ? .9 : 0));
  const shellTuning = shell === "slug" ? { pellets: 1, damageMul: 3.3, spreadMul: .18, rangeMul: 2.2, rateMul: .8 } :
    shell === "dragons_breath" ? { pellets: 6, damageMul: .75, spreadMul: 1.25, rangeMul: .95, rateMul: .9 } :
    shell === "pellets" ? { pellets: Math.round((base.pellets ?? 8) * 1.75), damageMul: .70, spreadMul: 1.8, rangeMul: .75, rateMul: 1 } :
    shell === "beanbag" ? { pellets: 5, damageMul: .85, spreadMul: .72, rangeMul: .9, rateMul: 1.35 } :
    null;
    const magBonus = acc.magSize ?? 0;
  // Each magazine / tube retains its own rounded attachment capacity. Round
  // per hand BEFORE doubling so odd combined totals cannot lose a cartridge.
  const akimboCapacity = akimbo ? 2*Math.max(1,Math.round(base.magSize*(1+(magBonus-100)/100))) : 0;
  // Resolve sight type from the equipped sight attachment (iron if none).
  const sightDef = sightDefForAttachments(atts, weapon.baseSightType);
  return {
    ...base,
    bodyPenetration,
    coverPenetration: coverPenetration > 0 ? coverPenetration : undefined,
    shotgunAmmo: shell,
    auto: fanHammer || (weapon.id === "crossbow_reclaimer" && atts.magazine === "mag_bolt_quiver" &&
      compatibleAttachments(weapon.id,"magazine").includes("mag_bolt_quiver")) ? true : base.auto,
    pellets: shellTuning?.pellets ?? base.pellets,
    fireRate: pct(base.fireRate, "fireRate") * (shellTuning?.rateMul ?? 1) * (fanHammer ? FAN_HAMMER_RATE_MULTIPLIER : 1),
    damage: Math.round(pct(base.damage, "damage") * (shellTuning?.damageMul ?? 1)),
    recoil: Math.max(0.05, base.recoil * (1 + (acc.recoil ?? 0) / 100)),
    // Hipfire spread: clamp so an attachment can't make it negative.
    spread: Math.max(0.0005, base.spread * (1 + (acc.spread ?? 0) / 100) * (shellTuning?.spreadMul ?? 1)),
    // An explicit ADS effect is required to influence ADS accuracy.
    adsSpread: Math.max(0.0, base.adsSpread * (1 + (acc.adsSpread ?? 0) / 100) * (shellTuning?.spreadMul ?? 1)),
    adsTime: Math.max(0.05, base.adsTime * (1 + (acc.adsTime ?? 0) / 100)),
    reloadTime: Math.max(0.4, base.reloadTime * (1 + (acc.reloadTime ?? 0) / 100)),
    moveSpeed: Math.max(0.4, base.moveSpeed * (1 + (acc.moveSpeed ?? 0) / 100) * (weapon.category === "melee" ? 1.19 : 1)),
    range: Math.max(8, base.range * (1 + (acc.range ?? 0) / 100) * (shellTuning?.rangeMul ?? 1)),
    // A single-chamber bolt-action rifle cannot gain extra chambered rounds from old attachments.
    magSize: weapon.id === "sniper_heavy" ? 1 : akimbo ? akimboCapacity : Math.max(1, Math.round(base.magSize * (1 + magBonus / 100))),
    sightType: sightDef.type,
  };
}

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  prestige: "#c4b5fd",
};

// ============================================================================
// RANKS — tier system based on level. Purely cosmetic title shown in UI.
// ============================================================================
export type RankDef = import("./catalog-contract").RankCatalogDef;

export const RANKS: RankDef[] = ranksData as unknown as RankDef[];

export function rankForLevel(level: number): RankDef {
  let r = RANKS[0];
  for (const rank of RANKS) if (level >= rank.level) r = rank;
  return r;
}
export function nextRank(level: number): RankDef | null {
  for (const rank of RANKS) if (rank.level > level) return rank;
  return null;
}

// ============================================================================
// DAILY CHALLENGES — 3 rotating objectives. The current set is determined by
// the day-of-year so all players share the same set on a given day.
// ============================================================================
export type ChallengeMetric = import("./catalog-contract").CatalogChallengeMetric;

export type ChallengeDef = import("./catalog-contract").RotatingChallengeCatalogDef;

export const DAILY_CHALLENGE_POOL: ChallengeDef[] = dailyChallengesData as unknown as ChallengeDef[];

// Each day combines a general objective, an arsenal quest and a map/mode quest.
// Independent buckets avoid assigning three restrictive maps or attachments.
export const CHALLENGE_FOCUSES = ["general", "arsenal", "operations"] as const;
export function dailyChallengeSet(date = new Date()): ChallengeDef[] {
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const year = date.getUTCFullYear();
  const dayOfYear = Math.floor((utcDate - Date.UTC(year, 0, 1)) / 86400000);
  return CHALLENGE_FOCUSES.map(focus => {
    const candidates = DAILY_CHALLENGE_POOL.filter(c => c.focus === focus);
    if (!candidates.length) throw new Error(`No daily challenges for focus ${focus}`);
    const offset = Math.floor(hashToUnitInterval(`daily|${year}|${focus}`) * candidates.length);
    return candidates[(offset + dayOfYear) % candidates.length];
  });
}

// ============================================================================
// WEEKLY CHALLENGES — 3 varied objectives rotating weekly (ISO week). Larger
// goals + bigger rewards than daily challenges. All players share the same
// weekly set, so it's a global "this week's challenge" for everyone.
// ============================================================================
export const WEEKLY_CHALLENGE_POOL: ChallengeDef[] = weeklyChallengesData as unknown as ChallengeDef[];

// ISO weeks start on Monday; use the UTC ISO week-year, including year boundaries.
function isoWeekParts(date: Date): { year: number; week: number } {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const year = thursday.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year, week };
}

// One general, one arsenal and one operations quest per ISO week.
// Independent round-robin cycles guarantee that every authored quest eventually appears.
export function weeklyChallengeSet(date = new Date()): ChallengeDef[] {
  const { year, week } = isoWeekParts(date);
  return CHALLENGE_FOCUSES.map(focus => {
    const candidates = WEEKLY_CHALLENGE_POOL.filter(c => c.focus === focus);
    if (!candidates.length) throw new Error(`No weekly challenges for focus ${focus}`);
    const offset = Math.floor(hashToUnitInterval(`weekly|${year}|${focus}`) * candidates.length);
    return candidates[(offset + week - 1) % candidates.length];
  });
}

// The same ISO week-year is used for rotation and persisted progress.
export function weeklyChallengeKey(date = new Date()): string {
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ============================================================================
// ELITE PROMOTION (17-C) — daily/weekly challenges can be "promoted" to an
// Elite variant per-player per-period. An elite variant has 3x the goal and
// 3x the reward (XP + credits). Promotion chance is deterministic per
// (playerKey, periodKey, challengeId) so the same player sees the same elite
// quests on reload within the same period. The elite id is suffixed `_elite`
// so its DB row (keyed by challengeId+dayKey) doesn't collide with the base.
// ============================================================================
export const DAILY_ELITE_CHANCE = 0.15;
export const WEEKLY_ELITE_CHANCE = 0.25;
export const ELITE_GOAL_MULTIPLIER = 3;
export const ELITE_REWARD_MULTIPLIER = 3;

// Grind-only or opponent-dependent quests can explicitly opt out of promotion.
export function canPromoteChallengeToElite(challenge: ChallengeDef): boolean {
  return challenge.eliteEligible !== false;
}

// Stable 0..1 hash from an arbitrary string (FNV-1a 32-bit, normalized).
// Deterministic — same input always returns same output. Used to decide
// elite promotion per (playerKey, periodKey, challengeId).
export function hashToUnitInterval(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // unsigned 32-bit normalize to [0, 1)
  return (h >>> 0) / 0x100000000;
}

// Returns true if a (playerKey, periodKey, challengeId) combination should be
// promoted to elite. Deterministic.
export function shouldPromoteToElite(
  playerKey: string,
  periodKey: string,
  challengeId: string,
  threshold: number,
): boolean {
  return hashToUnitInterval(`${playerKey}|${periodKey}|${challengeId}`) < threshold;
}

// Build an elite-promoted copy of a ChallengeDef. The base challenge's id is
// suffixed with `_elite` to ensure DB uniqueness, and the goal + rewards are
// scaled by ELITE_GOAL_MULTIPLIER / ELITE_REWARD_MULTIPLIER. The category is
// preserved (daily/weekly) — elite is just a flag on top.
export function promoteChallengeToElite(base: ChallengeDef): ChallengeDef {
  if (!canPromoteChallengeToElite(base)) throw new Error(`Elite promotion disabled for ${base.id}`);
  const goal = base.eliteGoal ?? base.goal * ELITE_GOAL_MULTIPLIER;
  // Keep the objective description accurate when its Elite target is curated.
  const description = base.description.replace(new RegExp(`\\b${base.goal}\\b`), String(goal));
  return {
    ...base,
    id: `${base.id}_elite`,
    goal,
    rewardXp: base.rewardXp * ELITE_REWARD_MULTIPLIER,
    rewardCredits: base.rewardCredits * ELITE_REWARD_MULTIPLIER,
    title: `Elite ${base.title}`,
    description: `${description} · Elite rewards (3× XP and credits)`,
  };
}

/** Restrict map, Survival tier and equipped-attachment quests using match telemetry.
 * Missing telemetry must never be interpreted as qualifying for a filtered quest.
 */
export function contextualChallengeDelta(
  challenge: Pick<ChallengeDef, "metric" | "mapId" | "attachmentId" | "survivalTier">,
  match: { mapId?: string; survivalTier?: string; mode: string; kills: number; perAttachmentKills?: Record<string, number> },
  baseDelta: number,
): number {
  if (challenge.mapId && challenge.mapId !== match.mapId) return 0;
  if (challenge.survivalTier && (match.mode !== "survival" || challenge.survivalTier !== match.survivalTier)) return 0;
  if (challenge.attachmentId) {
    if (challenge.metric !== "kills") return 0;
    const hits = match.perAttachmentKills?.[challenge.attachmentId] ?? 0;
    return Math.min(Math.max(0, match.kills), Math.max(0, hits));
  }
  return baseDelta;
}

// "In one run" Survival wave challenges track the best run within the period,
// not the sum of waves from multiple matches. Other metrics stay cumulative.
export function nextChallengeProgress(
  challenge: Pick<ChallengeDef, "metric" | "goal">,
  existingProgress: number,
  matchDelta: number,
): number {
  const previous = Math.max(0, existingProgress);
  const contribution = Math.max(0, matchDelta);
  return Math.min(challenge.goal,
    challenge.metric === "survival_waves"
      ? Math.max(previous, contribution)
      : previous + contribution);
}

// ============================================================================
// ELITE QUESTS (LEGACY) — LIFETIME accomplishments.
// DEPRECATED (17-C): Elite Quests are no longer a separate lifetime list.
// Instead, daily/weekly challenges can be promoted to elite variants per
// (playerKey, periodKey, challengeId) — see DAILY_ELITE_CHANCE etc. above.
// This array is kept only for backward-compat with old DB rows that still
// exist with type="elite" / dayKey="elite" from prior migrations. It is no
// longer used by getEliteQuestsView / applyMatchResult (which now handle
// only daily/weekly + their elite variants).
// ============================================================================
export const ELITE_QUESTS: ChallengeDef[] = eliteQuestsData as unknown as ChallengeDef[];

// ============================================================================
// ACHIEVEMENTS — one-time lifetime accomplishments.
// ============================================================================
export type AchievementDef = import("./catalog-contract").AchievementCatalogDef;

export const ACHIEVEMENTS: AchievementDef[] = achievementsData as unknown as AchievementDef[];

export const ACHIEVEMENT_TIER_COLORS: Record<string, string> = achievementColorsData as unknown as Record<string, string>;

// ============================================================================
// MATCH SETTINGS — configurable per-match options.
// ============================================================================
export interface MatchModeConfig {
  id: "ffa" | "tdm" | "survival" | "gungame" | "killconfirmed" | "ctf";
  label: string;
  description: string;
  icon: string;
  defaultScoreLimit: number;
  scoreOptions: number[];
  defaultTimeLimit: number; // minutes
  timeOptions: number[];
  teamBased: boolean;
  accentColor: string;
}

export const MATCH_MODES: Record<string, MatchModeConfig> = matchModesData as unknown as Record<string, MatchModeConfig>;

// ============================================================================
// KILLSTREAK CALLOUTS — used by the HUD for multi-kill announcements.
// ============================================================================
export interface KillstreakCallout {
  threshold: number;   // kills within the streak window (3s)
  label: string;
  color: string;
  icon: string;
}

export const KILLSTREAK_CALLOUTS: KillstreakCallout[] = killstreakCalloutsData as unknown as KillstreakCallout[];
