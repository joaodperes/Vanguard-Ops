/**
 * Shared deterministic damage scaling used by the offline and authoritative
 * multiplayer simulations. Keep damage modifier composition in one place so
 * both simulations apply multiplicative factors identically.
 */
export function applyDamageFactors(baseDamage: number, ...factors: number[]): number {
  return factors.reduce((damage, factor) => damage * factor, baseDamage);
}


export interface HealthDamageResult {
  health: number;
  appliedDamage: number;
  killed: boolean;
}

/** Resolve the shared health-state transition after all mode/weapon modifiers. */
export function resolveHealthDamage(
  currentHealth: number,
  incomingDamage: number,
  alive = true,
): HealthDamageResult {
  const health = Math.max(0, Number.isFinite(currentHealth) ? currentHealth : 0);
  const damage = alive && Number.isFinite(incomingDamage)
    ? Math.max(0, incomingDamage) : 0;
  const appliedDamage = Math.min(health, damage);
  const nextHealth = Math.max(0, health - appliedDamage);
  return { health: nextHealth, appliedDamage, killed: alive && health > 0 && nextHealth <= 0 };
}
