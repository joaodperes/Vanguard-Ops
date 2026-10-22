/** Bullet Spitter placed Wonder Weapon: fixed ±70° horizontal traverse,
 * but unlimited vertical elevation. Only targets enemies within line of sight.
 */
export const TURRET_ARC_DEG = 140;
export const TURRET_RANGE = 30;
export const TURRET_DAMAGE = 17;
export const TURRET_INTERVAL_MS = 360;
export const TURRET_LIFETIME_MS = 25000;
export function turretCanTrack(
  turret: readonly number[], forwardYaw: number, target: readonly number[],
  range = TURRET_RANGE,
): boolean {
  const dx = target[0] - turret[0], dz = target[2] - turret[2];
  const dist = Math.hypot(dx,dz);
  if (dist < 0.25 || dist > range) return false;
  const forwardX = Math.sin(forwardYaw), forwardZ = Math.cos(forwardYaw);
  // Horizontal arc only: elevated enemies do not lose tracking eligibility.
  return (dx * forwardX + dz * forwardZ) / dist >= Math.cos(TURRET_ARC_DEG * Math.PI / 360);
}
