/** Shared Plagueheart impact and poison profile for offline and authoritative combat.
 * Its rocket-like trajectory does NOT imply rocket-like instant damage.
 * Other explosives and poison sources retain their existing behavior.
 */
export const CORROSION_DURATION_MS = 5000;
export const CORROSION_TICK_MS = 500;
/** Moderate direct hit; a 95-damage profile delivers 26 immediately. */
export function corrosionImpactDamage(baseDamage: number, trajectoryFalloff: number): number {
  return Math.max(0, Math.min(26, baseDamage * 0.30) * Math.max(0, Math.min(1.2, trajectoryFalloff)));
}
/** Ten ticks over five seconds; reapplication refreshes instead of stacking. */
export function corrosionTickDamage(baseDamage: number): number {
  return Math.max(3, Math.round(Math.max(0, baseDamage) * 0.085));
}

/** Area around the actual Plagueheart detonation, not the projectile's
 * entire flight segment. A far enemy along the travel path is unaffected.
 * Shared by both authoritative and local gameplay for exact parity. */
export function corrosionImpactDistance(
  impact: readonly number[], target: readonly number[],
): number {
  return Math.hypot(target[0]-impact[0],target[1]-impact[1],target[2]-impact[2]);
}
