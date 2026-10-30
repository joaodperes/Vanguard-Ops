/** Stable combat personalities shared by the offline engine and authoritative server.
 * Difficulty controls skill; archetype controls weapon choice, positioning and tempo.
 * Match-specific weapons (e.g. Gun Game) always override the preferred loadout.
 */
import type { WeaponCategory } from "./game-data";

export type BotArchetype = "rusher" | "rifleman" | "marksman" | "support";

const LINEUP: readonly BotArchetype[] = ["rusher", "rifleman", "marksman", "support"];
export function botArchetypeForSlot(teamSlot: number): BotArchetype {
  return LINEUP[Math.max(0, Math.floor(teamSlot)) % LINEUP.length];
}

// Fixed within a match; rotating variants avoids a squad of identical rifles.
const WEAPONS: Record<BotArchetype, readonly string[]> = {
  rusher: ["smg_kp", "shotgun_br", "smg_vector", "shotgun_auto"],
  rifleman: ["rifle_ar", "rifle_burst", "rifle_heavy"],
  marksman: ["rifle_dm", "dmr_scout", "sniper_scout", "sniper_lr"],
  support: ["lmg_light", "lmg_hv", "lmg_heavy", "rifle_ar"],
};
export function botArchetypeWeapon(archetype: BotArchetype, slot: number): string {
  const weapons = WEAPONS[archetype];
  return weapons[Math.max(0, Math.floor(slot)) % weapons.length];
}

export interface BotPersonality {
  distanceScale: number;
  patrolSprintScale: number;
  moveScale: number;
  strafeScale: number;
  highGroundScale: number;
  extraBurstShots: number;
  idleAds: boolean;
}
export const BOT_PERSONALITIES: Record<BotArchetype, BotPersonality> = {
  rusher:   { distanceScale: .78, patrolSprintScale: .70, moveScale: 1.10, strafeScale: 1.10, highGroundScale: .28, extraBurstShots: 1, idleAds: false },
  rifleman: { distanceScale: 1, patrolSprintScale: 1, moveScale: 1, strafeScale: 1, highGroundScale: 1, extraBurstShots: 0, idleAds: false },
  marksman: { distanceScale: 1.28, patrolSprintScale: 1.65, moveScale: .94, strafeScale: .68, highGroundScale: 1.55, extraBurstShots: -1, idleAds: true },
  support:  { distanceScale: 1.15, patrolSprintScale: 1.30, moveScale: .96, strafeScale: .76, highGroundScale: .85, extraBurstShots: 3, idleAds: false },
};

export const botPersonality = (archetype: BotArchetype = "rifleman") => BOT_PERSONALITIES[archetype];

/** Keep positioning driven by the equipped weapon, especially in Gun Game. */
export function botArchetypeDistanceScale(archetype: BotArchetype, category: WeaponCategory): number {
  const natural = archetype === "rusher" ? ["shotgun", "smg", "pdw", "pistol", "melee"] :
    archetype === "marksman" ? ["sniper", "dmr", "assault"] :
    archetype === "support" ? ["lmg", "assault", "dmr"] : [];
  return natural.includes(category) ? botPersonality(archetype).distanceScale : 1;
}

export function botArchetypeHighGroundChance(archetype: BotArchetype, difficultyChance: number): number {
  return Math.min(.96, difficultyChance * botPersonality(archetype).highGroundScale);
}
