/** Shared tactical balancing for client, authoritative server and tests.
 * Distances are gameplay world units. Geometry/LOS is checked by callers.
 */
import { equipmentById } from "./equipment";

export const TASER_STUN_MS = 2400;
export const MINE_TRIGGER_RADIUS = 1.55;
export const MINE_SPLASH_RADIUS = 2.4;
export const MINE_SPLASH_MAX_DAMAGE = 38;

export function fragDamage(distance:number):number {
  const {radius,damage}=equipmentById("frag");
  if(distance>radius)return 0;
  return Math.round(Math.max(12,damage*(1-distance/radius)));
}
export function flashDurationMs(distance:number):number {
  const radius=equipmentById("flashbang").radius;
  if(distance>radius)return 0;
  return Math.round(1400+2200*(1-distance/radius));
}
export function mineSplashDamage(distance:number):number {
  if(distance>MINE_SPLASH_RADIUS)return 0;
  return Math.round(MINE_SPLASH_MAX_DAMAGE*Math.max(0,1-distance/MINE_SPLASH_RADIUS));
}
/** Direct knife/mine hits defeat ordinary operators regardless of HP boosts or
 * Survival damage modifiers. Bosses take normal damage, not an instant kill.
 * Call after applying all normal modifiers, not before.
 */
export function tacticalDirectDamage(baseDamage:number,remainingHp:number,boss:boolean):number {
  return boss ? baseDamage : Math.max(baseDamage,remainingHp);
}
