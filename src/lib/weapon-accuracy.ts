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
  // Keep accurate first shots for DMRs and snipers and the dedicated shotgun
  // pellet pattern. LMGs should require bursts; assault rifles and pistols
  // receive a smaller accuracy penalty instead of a blanket nerf.
  const handling = category === "lmg" ? (aiming ? 1.12 : 1.15) :
    category === "assault" ? 1.06 :
    category === "pistol" ? (aiming ? 1.04 : 1.08) : 1;
  return base * handling * (aiming ? steadyAds ? 1.1 : 1.35 : 1.9) *
    (1 + Math.max(0, motion) * (aiming ? 1.9 : 1.55) +
      Math.max(0, bloom) * (aiming ? 1.15 : 2));
}

export function shotBloomIncrease(fireRate: number): number {
  return Math.min(0.3, 0.1 + Math.max(0, fireRate) * 0.011);
}

export function recoilKickRadians(recoil: number, aiming: boolean, perkMultiplier = 1): number {
  // ADS stabilizes the gun, but no longer erases 35% of its vertical kick.
  // The larger base kick makes single heavy shots and sustained fire demand
  // deliberate correction without changing first-shot bullet direction.
  return Math.max(0, recoil) * 0.0138 * (aiming ? 0.77 : 1) * Math.max(0, perkMultiplier);
}

/** LMGs develop extra climb during a long burst, without making a first shot
 * inaccurate or interfering with ordinary/Wonder weapon recoil profiles. */
export function sustainedRecoilMultiplier(category: WeaponCategory, bloom: number, wonder = false): number {
  return category === "lmg" && !wonder
    ? 1 + Math.min(0.24, Math.max(0, bloom) * 0.16) : 1;
}

/** Shared shot-direction sampling. The caller controls WHEN spread is applied:
 * offline at the client, multiplayer exactly once on the authoritative server.
 * Supplying a random source also makes trajectory tests reproducible. */
export function spreadShotDirection(
  aim: readonly [number, number, number], spread: number, random: () => number = Math.random,
): [number, number, number] {
  const s = Number.isFinite(spread) ? Math.max(0, spread) : 0;
  const x = aim[0] + (random() - 0.5) * s;
  const y = aim[1] + (random() - 0.5) * s;
  const z = aim[2] + (random() - 0.5) * s;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export interface FiringMotion {
  sprinting: boolean;
  airborne: boolean;
  movingFast: boolean;
  firing: boolean;
  aiming: boolean;
  bloom: number;
  tasered: boolean;
}

/** Shared posture penalty for the HUD/offline shot model and online authority.
 * Online posture is reconstructed from server-observed movement/state. */
export function firingMotionFactor(state: FiringMotion): number {
  let motion = state.sprinting ? 0.85 : state.airborne ? 0.5 : state.movingFast ? 0.3 : 0;
  if (state.firing) motion += 0.15;
  if (state.aiming) motion *= 0.3;
  return Math.min(1, motion + Math.max(0, state.bloom) * (state.aiming ? 0.22 : 0.45) +
    (state.tasered ? 0.55 : 0));
}
