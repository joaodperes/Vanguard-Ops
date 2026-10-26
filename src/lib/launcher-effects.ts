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
