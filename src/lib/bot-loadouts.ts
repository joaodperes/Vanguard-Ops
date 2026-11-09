/** Shared bot equipment policy. Player perks and Wonder rules remain authoritative.
 * Survival has deliberately curated pools; other modes use the entire ordinary arsenal.
 * Bots never take Battle-Hardened: infinite AI-on-AI regeneration stalemates are undesirable.
 */
import { WEAPONS, type WeaponDef } from "./game-data";
import { PERKS, type PerkId } from "./perks";
import { BOT_ELIGIBLE_WEAPONS } from "./bot-archetypes";
import type { GameMode } from "./game-protocol";

const allowed = (ids: readonly string[]): WeaponDef[] => ids
  .map(id => WEAPONS.find(w => w.id === id))
  .filter((w): w is WeaponDef => !!w && !w.disabled && !w.wonder && !w.special);

// Explicit, deliberately close/mid-range Survival roster. Launchers are included,
// but the large-radius Swarm and long-range snipers are not.
export const SURVIVAL_BOT_WEAPONS = allowed([
  "rifle_ar", "rifle_falcon", "rifle_hydra", "rifle_burst", "rifle_heavy",
  "smg_kp", "smg_vector", "smg_compact", "shotgun_br", "shotgun_combat",
  "shotgun_auto", "dmr_scout", "dmr_whisper", "lmg_hv", "lmg_light",
  "pistol_side", "pistol_burst", "pistol_magnum", "pdw_mamba",
  "pdw_sentinel", "launcher_breach", "launcher_rocket",
]);

const survivalWonderIds = [
  "wonder_deadlock", "wonder_hellfire", "wonder_bogfather",
  "wonder_corrosion", "wonder_riot_shield",
] as const;

export const SURVIVAL_BOT_WONDERS = WEAPONS.filter(w =>
  !!w.wonder && !w.disabled && (survivalWonderIds as readonly string[]).includes(w.id));
export const BOT_WONDERS = WEAPONS.filter(w => !!w.wonder && !w.disabled);

export const SURVIVAL_BOT_PERKS: readonly PerkId[] = [
  "field_loader", "quickdraw", "lightweight", "steady",
  "athlete", "scavenger", "tactician", "wonder_weapon",
];
// Other modes can roll any player perk except the regen-stall one.
// Gun Game fixes weapons by tier and thus excludes loadout-changing perks.
export const STANDARD_BOT_PERKS: readonly PerkId[] = PERKS
  .map(p => p.id)
  .filter(id => id !== "battle_hardened");

const pick = <T>(values: readonly T[], random: () => number): T =>
  values[Math.max(0, Math.min(values.length - 1, Math.floor(random() * values.length)))];

export function botPerkForMode(mode: GameMode, wave = 1, random: () => number = Math.random): PerkId {
  if (mode === "survival") {
    const commons = SURVIVAL_BOT_PERKS.filter(id => id !== "wonder_weapon");
    // Rare Wonder elites start after the opening waves, never on wave one.
    return wave >= 8 && random() < 0.045 ? "wonder_weapon" : pick(commons, random);
  }
  const pool = mode === "gungame"
    ? STANDARD_BOT_PERKS.filter(id => id !== "wonder_weapon" && id !== "well_prepared")
    : STANDARD_BOT_PERKS;
  return pick(pool, random);
}

export function botWonderForMode(mode: GameMode, random: () => number = Math.random): string {
  const pool = mode === "survival" ? SURVIVAL_BOT_WONDERS : BOT_WONDERS;
  return pool.length ? pick(pool, random).id : "";
}

export function botPrimaryForMode(mode: GameMode, random: () => number = Math.random): string {
  const pool = mode === "survival" ? SURVIVAL_BOT_WEAPONS : BOT_ELIGIBLE_WEAPONS;
  return pick(pool, random).id;
}

export function botSecondaryPrimary(primaryId: string, random: () => number = Math.random): string {
  const pool = BOT_ELIGIBLE_WEAPONS.filter(w =>
    w.id !== primaryId && ["assault","smg","shotgun","dmr","sniper","lmg"].includes(w.category));
  return pool.length ? pick(pool, random).id : primaryId;
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
