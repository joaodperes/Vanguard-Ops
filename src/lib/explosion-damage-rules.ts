import { rayBox, type CoverBox, type Vec3 } from "./game-protocol";

/** Friendly fire is disabled for explosives, but owners are never immune to their own blasts.
 * Shared by the authoritative server, offline simulation and tests.
 */
export function blastCanDamage(
  ownerId:string,ownerTeam:string,targetId:string,targetTeam:string,mode:string,
):boolean {
  return ownerId===targetId || mode==="ffa" || mode==="gungame" || ownerTeam!==targetTeam;
}

/** Spherical distance in world units, including vertical separation. */
export function blastDistance(a:Vec3,b:Vec3):number {
  return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
}
/** Null for out-of-range or obstructed victims. Resolve before breaking cover. */
export function blastExposureDistance(from:Vec3,to:Vec3,radius:number,visible:(from:Vec3,to:Vec3)=>boolean):number|null {
  if(!(radius>0)||!Number.isFinite(radius))return null;
  const d=blastDistance(from,to);
  return Number.isFinite(d)&&d<=radius&&visible(from,to)?d:null;
}
/** Shared geometry test for splash against deployed panels.
 * Ignore the impacted panel itself, but not other barriers or floors.
 * Spatially indexed callers pass only boxes along this segment.
 */
export function blastUnobstructed(from:Vec3,to:Vec3,cover:readonly CoverBox[],ignoredEnvironmentId?:string):boolean {
  const delta:Vec3=[to[0]-from[0],to[1]-from[1],to[2]-from[2]];
  const len=Math.hypot(...delta);
  if(len<.01)return true;
  const dir:Vec3=[delta[0]/len,delta[1]/len,delta[2]/len];
  for(const box of cover){
    if(box.kind==="accent"||box.kind==="stair"||
      ignoredEnvironmentId&&box.environmentId===ignoredEnvironmentId)continue;
    const t=rayBox(from,dir,box.pos,box.size);
    if(t!==null&&t<len-1e-4)return false;
  }
  return true;
}
