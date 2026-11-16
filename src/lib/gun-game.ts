import { WEAPONS } from "./game-data";
import { GUN_GAME_TYPE_PROGRESSION, GUN_GAME_PROGRESSION } from "./game-protocol";
export type GunGamePreset = "all" | "cqc" | "long_range";
export const GUN_GAME_BASE_TIERS = 30;
export const GUN_GAME_MAX_MULTIPLIER = 5;
export function normalizeGunGameConfig(preset?: string, multiplier?: number) {
  return {
    preset: (preset === "cqc" || preset === "long_range" ? preset : "all") as GunGamePreset,
    multiplier: Number.isInteger(multiplier) ? Math.max(1, Math.min(GUN_GAME_MAX_MULTIPLIER, multiplier!)) : 1,
  };
}
const CQC = new Set(["pistol", "pdw", "smg", "shotgun"]);
const LONG = new Set(["assault", "dmr", "sniper", "lmg"]);
const sample = <T>(values: T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(Math.max(0, Math.min(.999999,random())) * values.length))];
/** 28 distinct firearms, a standard launcher, and standard melee. Never duplicate a weapon ID
 * within a cycle. Range presets are preferred where available, then filled
 * with other guns; no 28-item CQC-only or long-range-only catalog yet exists.
 */
export function buildGunGameWeapons(preset?: string, multiplier?: number, random: () => number = Math.random): string[] {
  const config = normalizeGunGameConfig(preset, multiplier);
  const ranged = WEAPONS.filter(w => !w.wonder && !w.disabled && w.category !== "melee" && w.category !== "launcher");
  const launchers = WEAPONS.filter(w => !w.wonder && !w.disabled && w.category === "launcher");
  const melee = WEAPONS.filter(w => !w.wonder && !w.disabled && w.category === "melee");
  if (!launchers.length || !melee.length) throw new Error("Gun Game needs standard launcher and melee finishers");
  if (ranged.length < GUN_GAME_BASE_TIERS - 2) throw new Error("Gun Game needs at least 28 unique ranged weapons");
  const cycles: string[] = [];
  for (let cycle = 0; cycle < config.multiplier; cycle++) {
    const used = new Set<string>();
    const cycleWeapons: string[] = [];
    for (let tier = 0; tier < GUN_GAME_BASE_TIERS - 2; tier++) {
      let choices = ranged.filter(w => !used.has(w.id));
      if (config.preset !== "all") {
        const allowed = config.preset === "cqc" ? CQC : LONG;
        const preferred = choices.filter(w => allowed.has(w.category));
        if (preferred.length) choices = preferred;
      } else {
        const targetCategory = GUN_GAME_TYPE_PROGRESSION[tier];
        const categoryChoices = choices.filter(w => w.category === targetCategory);
        if (categoryChoices.length) choices = categoryChoices;
      }
      const picked = sample(choices,random);
      cycleWeapons.push(picked.id);
      used.add(picked.id);
    }
    // Each cycle ends with a random standard launcher and then a random standard melee weapon.
    cycles.push(...cycleWeapons, sample(launchers,random).id, sample(melee,random).id);
  }
  return cycles;
}
/** Server and offline engine may end Gun Game ONLY on the final standard melee kill,
 * immediately preceded by any standard launcher in the active 30-step list. */
export function canCompleteGunGame(index: number, weapons: readonly string[], activeWeaponId: string): boolean {
  if (weapons.length < GUN_GAME_BASE_TIERS || weapons.length % GUN_GAME_BASE_TIERS !== 0 ||
    !Number.isInteger(index) || index !== weapons.length - 1) return false;
  const last = weapons[index];
  return last === activeWeaponId && WEAPONS.some(w => w.id === last && w.category === "melee" && !w.wonder && !w.disabled) &&
    WEAPONS.some(w => w.id === weapons[index - 1] && w.category === "launcher" && !w.wonder && !w.disabled);
}

/** F is an alternate attack key only when Gun Game has actually equipped a
 * progression melee weapon. Never allow a loadout knife to bypass firearm tiers.
 * This also covers the melee checkpoint at the end of each multiplier cycle. */
export function gunGameMeleeShortcutWeapon(
  index: number, weapons: readonly string[], activeWeaponId: string,
): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= weapons.length ||
      weapons[index] !== activeWeaponId) return null;
  const active = WEAPONS.find(w => w.id === activeWeaponId);
  return active && active.category === "melee" && !active.wonder && !active.disabled
    ? active.id : null;
}
