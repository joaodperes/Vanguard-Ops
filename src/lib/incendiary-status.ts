/** Dragon's Breath ignition rules, shared by offline damage and server combat.
 * Flames are cosmetic; actual DoT is still owned by the current poison tick
 * mechanism to preserve damage attribution, kills and regeneration delay. */
export const DRAGONS_BREATH_BURN_MS = 3000;
export const DRAGONS_BREATH_TICK_MS = 500;
export const DRAGONS_BREATH_TICK_DAMAGE = 2;
/** Fire only follows living, unshielded targets. Killing a victim removes
 * the visual immediately; there is no post-mortem flame flare. */
export function dragonBreathVisualUntil(
  now:number,incendiary:boolean,shielded:boolean,victimAlive:boolean,
):number|null {
  if(!Number.isFinite(now)||!incendiary||shielded||!victimAlive)return null;
  return now+DRAGONS_BREATH_BURN_MS;
}

export interface DragonBreathIgnition {
  expiresAt: number;
  tickAt: number;
  damagePerTick: number;
}

/** Direct, unshielded hits ignite only surviving enemies. Penetrating and
 * non-penetrating rays must both invoke this shared decision AFTER damage. */
export function dragonBreathIgnition(
  now: number, incendiary: boolean, victimAlive: boolean, shielded = false,
): DragonBreathIgnition | null {
  if (!Number.isFinite(now) || !incendiary || !victimAlive || shielded) return null;
  return {
    expiresAt: now + DRAGONS_BREATH_BURN_MS,
    tickAt: now + DRAGONS_BREATH_TICK_MS,
    damagePerTick: DRAGONS_BREATH_TICK_DAMAGE,
  };
}
