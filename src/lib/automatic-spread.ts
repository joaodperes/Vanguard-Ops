/** Burst accumulation shared across offline shot rendering and server hit logic.
 * Long trigger holds rise to a hard cap; stopping for ~0.6s resets accuracy.
 */
export function automaticBloom(previous:number,fireRate:number,elapsedMs:number):number{
  if(elapsedMs>=620)return 0;
  const recovered=Math.max(0,previous-Math.max(0,elapsedMs)*.0013);
  return Math.min(1.45,recovered+.15+Math.max(0,fireRate)*.012);
}
