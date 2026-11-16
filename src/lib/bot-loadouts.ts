/** Shared bot equipment policy. Player perks and Wonder rules remain authoritative.
 * Survival has deliberately curated pools; other modes use the entire ordinary arsenal.
 * Bots never take Battle-Hardened: infinite AI-on-AI regeneration stalemates are undesirable.
 */
import { WEAPONS, compatibleAttachments, computeEffectiveStats, weaponById, type WeaponDef, type AttachmentSlot } from "./game-data";
import { PERKS, type PerkId } from "./perks";
import { BOT_ELIGIBLE_WEAPONS, botArchetypeWeapons, type BotArchetype } from "./bot-archetypes";
import { MAX_HEALTH, type GameMode } from "./game-protocol";

const allowed = (ids: readonly string[]): WeaponDef[] => ids
  .map(id => WEAPONS.find(w => w.id === id))
  .filter((w): w is WeaponDef => !!w && !w.disabled && !w.wonder && !w.special);

/** A single trigger pull must never be capable of killing a full-health
 * operative with base weapon damage. Count every pellet and a possible
 * headshot (the worst case at point blank), but not separate burst shots.
 * Shared by online and offline Survival bots; PvP loadouts are unaffected.
 */
export function isSurvivalOneShotWeapon(weapon: WeaponDef): boolean {
  const pellets = Math.max(1, weapon.stats.pellets ?? 1);
  return weapon.stats.damage * pellets * Math.max(1, weapon.stats.headshotMult ?? 1) >= MAX_HEALTH;
}

// Explicit, deliberately close/mid-range Survival roster. The safety filter
// excludes RL-7, lethal shotguns, the Magnum and any future one-hit-kill
// weapon, while retaining lower-damage launchers and automatic shotguns.
export const SURVIVAL_BOT_WEAPONS = allowed([
  "rifle_ar", "rifle_falcon", "rifle_hydra", "rifle_burst", "rifle_heavy",
  "smg_kp", "smg_vector", "smg_compact", "shotgun_br", "shotgun_combat",
  "shotgun_auto", "dmr_scout", "dmr_whisper", "lmg_hv", "lmg_light",
  "pistol_side", "pistol_burst", "pistol_magnum", "pdw_mamba",
  "pdw_sentinel", "launcher_breach", "launcher_rocket",
]).filter(w => !isSurvivalOneShotWeapon(w));

const survivalWonderIds = [
  "wonder_deadlock", "wonder_hellfire", "wonder_bogfather",
  "wonder_corrosion", "wonder_riot_shield",
] as const;

export const SURVIVAL_BOT_WONDERS = WEAPONS.filter(w =>
  !!w.wonder && !w.disabled && (survivalWonderIds as readonly string[]).includes(w.id));
// Only Wonder kinds already handled by the shared player shot/deployable pipeline.
// Newer draft catalog entries (e.g. Chrono Anchor / Juggernaut) need their
// dedicated action messages before an AI can equip them meaningfully.
const BOT_SUPPORTED_WONDER_KINDS = new Set([
  "singularity","corrosion","turret","smart","flame",
  "storm","sludge","cluster","shield",
]);
export const BOT_WONDERS = WEAPONS.filter(w =>
  !!w.wonder&&!w.disabled&&BOT_SUPPORTED_WONDER_KINDS.has(w.wonder.kind));

export const SURVIVAL_BOT_PERKS: readonly PerkId[] = [
  "field_loader", "quickdraw", "lightweight", "steady",
  "athlete", "scavenger", "tactician", "wonder_weapon",
];
// Overall PvP eligibility is preserved for audits, but spawn perks are selected
// from the bot's combat role rather than unrelated global random choices.
export const STANDARD_BOT_PERKS: readonly PerkId[] = PERKS
  .map(p => p.id)
  .filter(id => id !== "battle_hardened");

export const BOT_ARCHETYPE_PERKS: Record<BotArchetype, readonly PerkId[]> = {
  rusher: ["lightweight", "athlete", "quickdraw", "silent_steps", "field_loader", "scavenger", "tactician", "wonder_weapon"],
  rifleman: ["field_loader", "quickdraw", "steady", "scavenger", "recon_visor", "well_prepared", "tactician", "wonder_weapon"],
  marksman: ["steady", "recon_visor", "quickdraw", "scavenger", "silent_steps", "well_prepared", "wonder_weapon"],
  support: ["field_loader", "steady", "scavenger", "explonando", "well_prepared", "tactician", "wonder_weapon"],
};

// Preferences inform combat identity; the shared attachment compatibility
// catalog remains the authority for every weapon-specific slot and modifier.
const BOT_ATTACHMENT_PREFERENCES: Record<BotArchetype, Partial<Record<AttachmentSlot, readonly string[]>>> = {
  rusher: {
    sight: ["sight_laser", "sight_compact_reflex", "sight_red_dot"],
    barrel: ["barrel_ported", "barrel_lightweight", "barrel_choke"],
    grip: ["grip_laser", "grip_runner_ads", "grip_angled"],
    magazine: ["mag_quickdraw", "mag_shell_carrier", "mag_extended"],
  },
  rifleman: {
    sight: ["sight_red_dot", "sight_holo", "sight_compact_reflex"],
    barrel: ["barrel_compensator", "barrel_muzzle_brake", "barrel_suppressor"],
    grip: ["grip_vertical", "grip_angled", "grip_precision"],
    magazine: ["mag_balanced", "mag_extended", "mag_quickdraw"],
  },
  marksman: {
    sight: ["sight_hunter", "sight_acog", "sight_thermal", "sight_nvg"],
    barrel: ["barrel_match", "barrel_heavy", "barrel_suppressor"],
    grip: ["grip_precision", "grip_stability", "grip_angled"],
    magazine: ["mag_penetrator", "mag_balanced", "mag_quickdraw", "mag_antimaterial_match"],
  },
  support: {
    sight: ["sight_holo", "sight_acog", "sight_red_dot"],
    barrel: ["barrel_heavy", "barrel_muzzle_brake", "barrel_launcher_stabilizer", "barrel_compensator"],
    grip: ["grip_stability", "grip_vertical", "grip_launcher_loader", "grip_angled"],
    magazine: ["mag_drum", "mag_extended", "mag_launcher_reinforced", "mag_launcher_quickload", "mag_balanced"],
  },
};

export type BotAttachmentMap = Record<AttachmentSlot, string | null>;
export const emptyBotAttachments = (): BotAttachmentMap =>
  ({ sight: null, barrel: null, grip: null, magazine: null });

/** Up to three legal upgrades for ordinary PvP bots. Survival remains curated,
 * and Gun Game's forced weapon tiers remain completely unmodified. */
export function botAttachmentsForMode(
  mode: GameMode, archetype: BotArchetype, weaponId: string,
  random: () => number = Math.random,
): BotAttachmentMap {
  const result = emptyBotAttachments();
  if (mode === "survival" || mode === "gungame" ||
      !BOT_ELIGIBLE_WEAPONS.some(w => w.id === weaponId)) return result;
  const priority: Record<BotArchetype, readonly AttachmentSlot[]> = {
    rusher: ["sight", "grip", "magazine", "barrel"],
    rifleman: ["sight", "barrel", "magazine", "grip"],
    marksman: ["sight", "barrel", "grip", "magazine"],
    support: ["magazine", "grip", "barrel", "sight"],
  };
  let count = 0;
  for (const slot of priority[archetype]) {
    const available = compatibleAttachments(weaponId, slot);
    if (!available.length) continue;
    const preferred = (BOT_ATTACHMENT_PREFERENCES[archetype][slot] ?? [])
      .filter(id => available.includes(id));
    result[slot] = pick(preferred.length ? preferred : available, random);
    if (++count === 3) break;
  }
  return result;
}

/** A switched primary, forced tier or temporary Wonder cannot inherit
 * stat bonuses from an unrelated gun. */
export function botActiveAttachments(
  primaryId: string, activeId: string, primary: BotAttachmentMap,
  secondaryId?: string, secondary?: BotAttachmentMap,
): BotAttachmentMap {
  if (activeId === primaryId) return primary;
  if (secondaryId && activeId === secondaryId) return secondary ?? emptyBotAttachments();
  return emptyBotAttachments();
}

export const botMagazineCapacity = (weaponId: string, attachments: BotAttachmentMap): number =>
  computeEffectiveStats(weaponById(weaponId), attachments).magSize;

const pick = <T>(values: readonly T[], random: () => number): T =>
  values[Math.max(0, Math.min(values.length - 1, Math.floor(random() * values.length)))];

export function botPerkForMode(
  mode: GameMode, wave = 1, random: () => number = Math.random,
  archetype: BotArchetype = "rifleman",
): PerkId {
  if (mode === "survival") {
    const commons = SURVIVAL_BOT_PERKS.filter(id => id !== "wonder_weapon");
    // Rare Wonder elites start after the opening waves, never on wave one.
    return wave >= 8 && random() < 0.045 ? "wonder_weapon" : pick(commons, random);
  }
  const pool = BOT_ARCHETYPE_PERKS[archetype];
  return pick(mode === "gungame"
    ? pool.filter(id => id !== "wonder_weapon" && id !== "well_prepared")
    : pool, random);
}

export function botWonderForMode(mode: GameMode, random: () => number = Math.random): string {
  const pool = mode === "survival" ? SURVIVAL_BOT_WONDERS : BOT_WONDERS;
  return pool.length ? pick(pool, random).id : "";
}

export function botPrimaryForMode(mode: GameMode, random: () => number = Math.random): string {
  const pool = mode === "survival" ? SURVIVAL_BOT_WEAPONS : BOT_ELIGIBLE_WEAPONS;
  return pick(pool, random).id;
}

export function botSecondaryPrimary(
  primaryId: string, random: () => number = Math.random, archetype?: BotArchetype,
): string {
  const primaryCategories = ["assault","smg","shotgun","dmr","sniper","lmg"];
  const preferred = archetype ? new Set(botArchetypeWeapons(archetype)) : null;
  const pool = BOT_ELIGIBLE_WEAPONS.filter(w =>
    w.id !== primaryId && primaryCategories.includes(w.category) &&
    (!preferred || preferred.has(w.id)));
  const fallback = BOT_ELIGIBLE_WEAPONS.filter(w =>
    w.id !== primaryId && primaryCategories.includes(w.category));
  return pick(pool.length ? pool : fallback, random).id;
}

export function botMovementPerkMultiplier(perk?: string | null, sprinting = false): number {
  if (perk === "lightweight") return 1.12;
  // Bots have no stamina meter; this models Athlete's sustained sprint advantage.
  if (perk === "athlete" && sprinting) return 1.08;
  return 1;
}
export function botAwarenessPerkMultiplier(perk?: string | null): number {
  // Bots have no minimap; give Recon Visor's additional intel a modest spotting boost.
  return perk === "recon_visor" ? 1.25 : 1;
}
