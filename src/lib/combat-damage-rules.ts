/**
 * Shared deterministic damage scaling used by the offline and authoritative
 * multiplayer simulations. Keep damage modifier composition in one place so
 * both simulations apply multiplicative factors identically.
 */
export function applyDamageFactors(baseDamage: number, ...factors: number[]): number {
  return factors.reduce((damage, factor) => damage * factor, baseDamage);
}
