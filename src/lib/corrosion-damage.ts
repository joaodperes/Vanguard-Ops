/** Shared Plagueheart impact and poison profile for offline and authoritative combat.
 * Its rocket-like trajectory does NOT imply rocket-like instant damage.
 * Other explosives and poison sources retain their existing behavior.
 */
export const CORROSION_DURATION_MS = 6500;
export const CORROSION_TICK_MS = 500;
/** Small immediate hit; even a direct 95-damage Plagueheart shot cannot one-shot. */
export function corrosionImpactDamage(baseDamage: number, trajectoryFalloff: number): number {
  return Math.max(0, Math.min(18, baseDamage * 0.17) * Math.max(0, Math.min(1.2, trajectoryFalloff)));
}
/** 13 periodic ticks over 6.5s; reapplication refreshes instead of stacking. */
export function corrosionTickDamage(baseDamage: number): number {
  return Math.max(3, Math.round(Math.max(0, baseDamage) * 0.11));
}

/** Area around the actual Plagueheart detonation, not the projectile's
 * entire flight segment. A far enemy along the travel path is unaffected.
 * Shared by both authoritative and local gameplay for exact parity. */
export function corrosionImpactDistance(
  impact: readonly number[], target: readonly number[],
): number {
  return Math.hypot(target[0]-impact[0],target[1]-impact[1],target[2]-impact[2]);
}
