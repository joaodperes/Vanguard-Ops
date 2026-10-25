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
/** 28 distinct firearms, rocket launcher, melee. Never duplicate a weapon ID
 * within a cycle. Range presets are preferred where available, then filled
 * with other guns; no 28-item CQC-only or long-range-only catalog yet exists.
 */
export function buildGunGameWeapons(preset?: string, multiplier?: number, random: () => number = Math.random): string[] {
  const config = normalizeGunGameConfig(preset, multiplier);
  const ranged = WEAPONS.filter(w => !w.wonder && w.category !== "melee" && w.category !== "launcher");
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
    // Fixed two-step ending is preserved for every multiplier cycle.
    cycles.push(...cycleWeapons,"launcher_rocket","knife_tactical");
  }
  return cycles;
}
/** Server and offline engine may end Gun Game ONLY on the final melee kill,
 * immediately preceded by the rocket launcher tier in the active 30-step list. */
export function canCompleteGunGame(index: number, weapons: readonly string[], activeWeaponId: string): boolean {
  if (weapons.length < GUN_GAME_BASE_TIERS || weapons.length % GUN_GAME_BASE_TIERS !== 0 ||
    !Number.isInteger(index) || index !== weapons.length - 1) return false;
  const last = weapons[index];
  return last === activeWeaponId && WEAPONS.some(w => w.id === last && w.category === "melee") &&
    weapons[index - 1] === "launcher_rocket";
}
