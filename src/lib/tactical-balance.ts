/** Shared tactical balancing for client, authoritative server and tests.
 * Distances are gameplay world units. Geometry/LOS is checked by callers.
 */
import { equipmentById } from "./equipment";

/** Taser jams precision aiming, without immobilizing or disarming the target. */
export const TASER_ADS_BLOCK_MS = 2400;
/** Tasers jam ADS and make hipfire notably less precise without disabling fire. */
export const TASER_HIPFIRE_SPREAD_MULTIPLIER = 1.7;

/** The player faces +Z at yaw 0. Blindness is entirely frontal; even a
 * close flash behind the viewer can only affect hearing. Peripheral flashes
 * taper smoothly and reaches full strength within about 45 degrees.
 */
export function flashFacingExposure(
  viewer: readonly [number,number,number],
  yaw: number,
  explosion: readonly [number,number,number],
): number {
  const dx=explosion[0]-viewer[0], dz=explosion[2]-viewer[2];
  const distance=Math.hypot(dx,dz);
  if(distance<0.001)return 1;
  const alignment=(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/distance;
  return Math.max(0,Math.min(1,(alignment-0.05)/0.65));
}

/** Bounded pseudo-random twitch that changes every 220ms. Combined with
 * player input, never replaces or blocks movement commands. */
export function taserMovementJitter(nowMs:number):{x:number;z:number} {
  const beat=Math.floor(nowMs/220);
  const noise=(n:number)=>{const v=Math.sin(n)*43758.5453123;return v-Math.floor(v);};
  return {x:(noise(beat*12.9898+7.13)-0.5)*0.16,
          z:(noise(beat*78.233+49.61)-0.5)*0.16};
}

/** A Survival bot's taser can disrupt aiming but never deliver a killing
 * blow. Apply this clamp after all damage multipliers so glass-cannon or other
 * vulnerabilities cannot turn the stun into a lethal hit. Other modes and
 * human-owned tasers keep their usual damage. */
export function survivalNonLethalTaserDamage(
  damage:number,remainingHp:number,mode:string,attackerIsBot:boolean,weaponId:string,
):number {
  if(mode!=="survival"||!attackerIsBot||weaponId!=="equipment_taser")return damage;
  return Math.max(0,Math.min(damage,Math.max(0,remainingHp-1)));
}
export function isTaserAdsBlocked(adsBlockedUntil:number,now:number):boolean {
  return adsBlockedUntil>now;
}
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
/** Audio duck with short recovery as flash clears; independent of gameplay controls. */
export function flashAudioGain(remainingMs:number):number {
  if(remainingMs<=0)return 1;
  return 1-0.85*Math.min(1,remainingMs/600);
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
