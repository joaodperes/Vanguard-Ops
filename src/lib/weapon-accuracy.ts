import type { WeaponCategory, WeaponStats } from "./game-data";

/** Bullets deviate from the aim ray, especially without ADS.
 * High fire-rate weapons accumulate bloom; pausing lets it settle.
 * Scoped single-shot weapons retain precision when aimed, but no weapon has
 * pixel-perfect hipfire simply because its base data had a zero spread.
 */
export function shotSpread(
  stats: Pick<WeaponStats,"spread"|"adsSpread">,
  category: WeaponCategory, aiming: boolean, motion: number, bloom: number, steadyAds: boolean,
): number {
  if (category === "melee") return 0;
  // Snipers and shotguns should be unreliable from the hip even when stationary.
  // ADS precision is intentionally left untouched.
  const hipFloor = category === "sniper" ? 0.12 :
    category === "shotgun" ? 0.14 :
    category === "dmr" ? 0.014 : 0.012;
  const base = aiming ? Math.max(0.0007, stats.adsSpread) : Math.max(hipFloor, stats.spread);
  return base * (aiming ? steadyAds ? 1.1 : 1.35 : 1.9) *
    (1 + Math.max(0, motion) * 1.55 + Math.max(0, bloom) * (aiming ? 1.15 : 2));
}

export function shotBloomIncrease(fireRate: number): number {
  return Math.min(0.3, 0.1 + Math.max(0, fireRate) * 0.011);
}

export function recoilKickRadians(recoil: number, aiming: boolean, perkMultiplier = 1): number {
  return Math.max(0, recoil) * 0.012 * (aiming ? 0.65 : 1) * Math.max(0, perkMultiplier);
}
