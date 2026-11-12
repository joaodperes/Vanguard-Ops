/** Shared tactical balancing for client, authoritative server and tests.
 * Distances are gameplay world units. Geometry/LOS is checked by callers.
 */
import { equipmentById } from "./equipment";
import type { CoverBox, Vec3 } from "./game-protocol";

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
export const MINE_SHOT_RADIUS = 0.38;

/** A mine has a low, broad body on the floor. Return the FIRST intersection
 * of a normalised bullet ray with its hittable volume (or null). No shooting
 * through solid cover: callers cap maxDistance at the ballistic obstruction. */
export function mineShotDistance(origin: Vec3, direction: Vec3, mine: Vec3, maxDistance: number): number | null {
  const dx = mine[0] - origin[0], dy = mine[1] + 0.11 - origin[1], dz = mine[2] - origin[2];
  const projection = dx * direction[0] + dy * direction[1] + dz * direction[2];
  if (projection < -MINE_SHOT_RADIUS || projection > maxDistance + MINE_SHOT_RADIUS) return null;
  const perpendicularSq = Math.max(0, dx * dx + dy * dy + dz * dz - projection * projection);
  if (perpendicularSq > MINE_SHOT_RADIUS * MINE_SHOT_RADIUS) return null;
  const distance = Math.max(0, projection - Math.sqrt(MINE_SHOT_RADIUS * MINE_SHOT_RADIUS - perpendicularSq));
  return distance <= maxDistance ? distance : null;
}

/** Choose the nearest armed mine hit by a bullet. The shooter is irrelevant:
 * any shot may detonate any mine, but its owner always deals the damage. */
export function closestShotMine<T extends { pos: Vec3 }>(
  mines: Iterable<T>, origin: Vec3, direction: Vec3, maxDistance: number,
): { mine: T; distance: number } | null {
  let nearest: { mine: T; distance: number } | null = null;
  for (const mine of mines) {
    const distance = mineShotDistance(origin, direction, mine.pos, maxDistance);
    if (distance !== null && (!nearest || distance < nearest.distance)) nearest = { mine, distance };
  }
  return nearest;
}

/** Mines have no fuse/expiry; only an active owner may keep them deployed. */
export function mineOwnerActive(owner: { alive: boolean } | null | undefined): boolean {
  return !!owner?.alive;
}

/** Mine throws project 1.2m ahead of the player. Snap the mine to the actual
 * supporting tread/platform there, not the thrower's feet height. A low step
 * may be climbed; tall overhead cover must never be treated as floor. */
export function groundMineImpact(impact: Vec3, deployerFeetY: number, cover: readonly CoverBox[]): Vec3 {
  let floorY = 0;
  for (const box of cover) {
    if (box.kind === "accent") continue;
    const top = box.pos[1] + box.size[1];
    if (top <= floorY || top > deployerFeetY + 0.55 + 1e-4) continue;
    if (Math.abs(impact[0] - box.pos[0]) <= box.size[0] + 1e-4 &&
        Math.abs(impact[2] - box.pos[2]) <= box.size[2] + 1e-4) floorY = top;
  }
  return [impact[0], floorY + 0.12, impact[2]];
}

/** A floor mine senses the intruder's lower body, not the torso centre.
 * Use one contact point for BOTH trigger and damage checks, including stairs.
 * Full 3D range and line of sight still prevent hits between floors. */
export function mineContactPoint(mine: Vec3, targetFeet: Vec3): Vec3 {
  return [targetFeet[0], Math.min(targetFeet[1] + 1.4,
    Math.max(targetFeet[1] + 0.35, mine[1] + 0.2)), targetFeet[2]];
}

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
