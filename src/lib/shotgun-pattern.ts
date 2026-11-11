import type { WeaponStats } from "./game-data";
import type { Vec3 } from "./game-protocol";

/**
 * Shotgun pellets are distributed around the unmodified aim ray, not around a
 * second, randomly deflected aim ray. This keeps the center of the pattern on
 * the reticle and avoids stacking two unrelated spread rolls.
 *
 * The stats already contain barrel, grip, sight and ammunition modifiers.
 * Use this helper for local players, server-validated shots and bots alike.
 */
export function shotgunConeRadians(
  stats: Pick<WeaponStats, "spread" | "adsSpread">,
  aiming: boolean,
): number {
  return Math.max(0.001, aiming ? stats.adsSpread : stats.spread) * 0.65;
}

/** Return a normalized ray uniformly distributed across the shotgun's cone.
 * Pellet zero follows the actual crosshair. This central buckshot pellet
 * guarantees an aimed close-range volley can connect while the remaining
 * pellets still use the full cone and normal cover / range rules.
 *
 * Keep the optional pellet index last so existing random-source callers retain
 * their seeded behavior; firing paths must pass the index in buckshot loops.
 */
export function shotgunPelletDirection(
  center: Vec3,
  stats: Pick<WeaponStats, "spread" | "adsSpread">,
  aiming: boolean,
  random: () => number = Math.random,
  pelletIndex?: number,
): Vec3 {
  const len = Math.hypot(...center) || 1;
  const forward: Vec3 = [center[0] / len, center[1] / len, center[2] / len];
  if (pelletIndex === 0) return forward;
  // Two orthogonal basis vectors ensure a circular pattern in camera space.
  const upReference: Vec3 = Math.abs(forward[1]) < 0.98 ? [0, 1, 0] : [1, 0, 0];
  const right: Vec3 = [
    upReference[1] * forward[2] - upReference[2] * forward[1],
    upReference[2] * forward[0] - upReference[0] * forward[2],
    upReference[0] * forward[1] - upReference[1] * forward[0],
  ];
  const rightLen = Math.hypot(...right) || 1;
  const rx = right[0] / rightLen, ry = right[1] / rightLen, rz = right[2] / rightLen;
  const ux = forward[1] * rz - forward[2] * ry;
  const uy = forward[2] * rx - forward[0] * rz;
  const uz = forward[0] * ry - forward[1] * rx;
  const radius = Math.sqrt(random()) * Math.tan(shotgunConeRadians(stats, aiming));
  const angle = random() * Math.PI * 2;
  const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
  const dir: Vec3 = [
    forward[0] + rx * x + ux * y,
    forward[1] + ry * x + uy * y,
    forward[2] + rz * x + uz * y,
  ];
  const directionLength = Math.hypot(...dir) || 1;
  return [dir[0] / directionLength, dir[1] / directionLength, dir[2] / directionLength];
}
