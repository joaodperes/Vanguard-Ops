import { damageAtRange, type WeaponDef, type WeaponStats } from "./game-data";
import { burstShotIntervalMs } from "./weapon-mechanics";

/**
 * Ideal first-magazine TTK against a stationary 100-HP target, assuming every
 * bullet connects. Excludes ADS, movement, recoil, bloom, projectile travel,
 * networking, reloads, splash, pellets and heat interruptions.
 *
 * This is an audit metric, not a prediction of real PvP performance.
 */
export const BALANCE_TARGET_HEALTH = 100;

export function hitsToEliminate(
  stats: WeaponStats,
  distanceMeters = 0,
  headshotsFirst = 0,
  targetHealth = BALANCE_TARGET_HEALTH,
): number | null {
  if (stats.damage <= 0 || targetHealth <= 0) return targetHealth <= 0 ? 0 : null;
  let health = targetHealth;
  for (let shot = 1; shot <= 512; shot++) {
    const multiplier = shot <= headshotsFirst ? stats.headshotMult : 1;
    health -= damageAtRange(stats.damage * multiplier, distanceMeters, stats.range, stats);
    if (health <= 1e-7) return shot;
  }
  return null;
}

export function idealTimeToKillMs(
  weapon: Pick<WeaponDef, "category">,
  stats: WeaponStats,
  distanceMeters = 0,
  headshotsFirst = 0,
  targetHealth = BALANCE_TARGET_HEALTH,
): number | null {
  const hits = hitsToEliminate(stats, distanceMeters, headshotsFirst, targetHealth);
  if (hits === null || hits > stats.magSize) return null;
  if (hits <= 1) return 0;
  const normalInterval = 1000 / Math.max(0.1, stats.fireRate);
  const burst = Math.max(1, stats.burst ?? 1);
  const intraBurstInterval = burstShotIntervalMs(stats.fireRate, weapon.category);
  let timeMs = 0;
  for (let shot = 1; shot < hits; shot++) {
    timeMs += burst > 1 && shot % burst !== 0 ? intraBurstInterval : normalInterval;
  }
  return timeMs;
}
