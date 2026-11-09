import type { Vec3 } from "./game-protocol";
/** Shared impact-rocket splash profile for offline and authoritative matches.
 * Swarm has broad, persistent radial fragment damage rather than RL-7's
 * focused direct-hit bonus; still uses unguided impact detonation.
 */
export function launcherSplashFactor(weaponId:string,distance:number,radius:number):number {
  if(!Number.isFinite(distance)||!Number.isFinite(radius)||radius<=0||distance>radius)return 0;
  const n=Math.max(0,distance/radius);
  if(weaponId==="launcher_swarm"){
    // Wide shockwave: 48% at the edge, good against groups, low point damage.
    return 1-.52*n*n;
  }
  if(weaponId==="launcher_breach")return .90*(1-n*n)+.05;
  if(weaponId==="launcher_rocket")return distance<=.55?1.32:1.05*(1-n*n);
  return distance<=1.5?1.2:(1-n*n)*.9+.1;
}

/** Blast visibility starts just before the projectile's collision plane.
 * Ray-box tests treat a ray starting ON a solid face as an obstruction at t=0,
 * even when the ray travels away from it (e.g. RL-7 fired at a nearby wall).
 * Retreat into the projectile's approach side; don't waive the impacted wall
 * for targets standing BEHIND it, or ignore any intervening cover.
 *
 * Only use this for explosive impact LOS, not bullet penetration or hit detection.
 */
export const LAUNCHER_BLAST_SURFACE_OFFSET = 0.06;
export function launcherBlastVisibilityOrigin(impact: Vec3, shotOrigin: Vec3): Vec3 {
  const dx=shotOrigin[0]-impact[0],dy=shotOrigin[1]-impact[1],dz=shotOrigin[2]-impact[2];
  const len=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(len)||len<1e-6)return [...impact];
  const step=Math.min(LAUNCHER_BLAST_SURFACE_OFFSET,len*.5)/len;
  return [impact[0]+dx*step,impact[1]+dy*step,impact[2]+dz*step];
}
