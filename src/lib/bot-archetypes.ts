/** Stable combat personalities shared by the offline engine and authoritative server.
 * Difficulty controls skill; archetype controls weapon choice, positioning and tempo.
 * Match-specific weapons (e.g. Gun Game) always override the preferred loadout.
 */
import { WEAPONS, type WeaponCategory } from "./game-data";

export type BotArchetype = "rusher" | "rifleman" | "marksman" | "support";

const LINEUP: readonly BotArchetype[] = ["rusher", "rifleman", "marksman", "support"];
export function botArchetypeForSlot(teamSlot: number): BotArchetype {
  return LINEUP[Math.max(0, Math.floor(teamSlot)) % LINEUP.length];
}

/** Standard ranged weapons supported by the shared hitscan/pellet bot AI.
 * Wonder weapons, launchers, melee and bespoke mechanics (heat, bolt, arc)
 * are intentionally excluded until bot-specific attack logic exists.
 */
export const BOT_ELIGIBLE_WEAPONS = WEAPONS.filter(weapon =>
  !weapon.disabled && !weapon.wonder && !weapon.special &&
  weapon.category !== "launcher" && weapon.category !== "melee"
);

/** Weighted archetype pool. Every conventional ranged weapon appears in at
 * least one pool; repeated entries favor signature weapons over backups.
 */
const poolFor = (archetype: BotArchetype): readonly string[] => {
  const byCategory=(category:WeaponCategory)=>BOT_ELIGIBLE_WEAPONS.filter(w=>w.category===category).map(w=>w.id);
  switch(archetype){
    case "rusher": return [...byCategory("smg"),...byCategory("shotgun"),...byCategory("pdw"),...byCategory("smg")];
    case "rifleman": return [...byCategory("assault"),...byCategory("assault"),...byCategory("pistol")];
    case "marksman": return [...byCategory("dmr"),...byCategory("sniper")];
    case "support": return [...byCategory("lmg"),...byCategory("lmg"),...byCategory("assault")];
  }
};

/** For assertions and mode-specific selection, without duplicating a catalog. */
export function botArchetypeWeapons(archetype: BotArchetype): readonly string[] {
  return poolFor(archetype);
}
/** Survival waves use broad random weapons; derive a matching personality. */
export function botArchetypeForCategory(category: WeaponCategory): BotArchetype {
  if (category === "smg" || category === "shotgun" || category === "pdw" || category === "melee") return "rusher";
  if (category === "sniper" || category === "dmr") return "marksman";
  if (category === "lmg") return "support";
  return "rifleman";
}

export function botArchetypeWeapon(archetype: BotArchetype, slot: number): string {
  const weapons = poolFor(archetype);
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
