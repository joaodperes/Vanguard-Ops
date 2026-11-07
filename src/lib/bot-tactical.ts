/** Shared tactical equipment selection, situational use and trajectory planning.
 * Bots never conjure hits: candidate throws are simulated against real cover.
 * The server remains the source of truth for damage, charges and FX.
 */
import { equipmentById, type EquipmentId } from "./equipment";
import type { BotArchetype } from "./bot-archetypes";
import { rayBox, EYE_HEIGHT, type CoverBox, type Vec3, type MapId } from "./game-protocol";
import { closestCoverHit } from "./dynamic-environment";
import { calculateThrowPath } from "./throw-trajectory";
import { tacticalGrenadePath } from "./tactical-grenades";
import type { TimedProjectilePath } from "./bouncing-projectile";

const POOLS: Record<BotArchetype,readonly EquipmentId[]> = {
  rusher: ["flashbang","knives"],
  rifleman: ["frag","taser"],
  marksman: ["poison_dart","knives"],
  support: ["mine","frag"],
};
export function botTacticalForArchetype(archetype:BotArchetype,variant=0):EquipmentId {
  const pool=POOLS[archetype];
  return pool[Math.abs(Math.floor(variant))%pool.length];
}
export function botTacticalCanUse(args:{
  equipmentId:EquipmentId; distance:number; visible:boolean; targetProtected:boolean;
  friendlyAtImpact:boolean; charges:number; now:number; readyAt:number; targetAgeMs:number;
  guarding?:boolean; lowHealth?:boolean;
}):boolean {
  if (!args.charges || !args.visible || args.targetProtected || args.friendlyAtImpact ||
      args.now < args.readyAt || args.targetAgeMs < 650) return false;
  const d=args.distance;
  switch(args.equipmentId) {
    case "frag": return d>=8 && d<=27;
    case "flashbang": return d>=8 && d<=24;
    case "mine": return d>=4 && d<=13 && (!!args.guarding || !!args.lowHealth);
    case "knives": return d>=3 && d<=23;
    case "taser": return d>=2 && d<=15;
    case "poison_dart": return d>=5 && d<=24;
  }
}
export interface BotTacticalThrow { yaw:number; pitch:number; path:TimedProjectilePath }
function segmentDistanceToPoint(points:Vec3[],point:Vec3):number {
  let best=Infinity;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
    const l2=dx*dx+dy*dy+dz*dz||1;
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy+(point[2]-a[2])*dz)/l2));
    best=Math.min(best,Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t,point[2]-a[2]-dz*t));
  }
  return best;
}
/** Pick a physical trajectory that lands near a visible opponent. No omniscient
 * shots through cover, no teleporting grenades, and no automatic guaranteed hits.
 */
export function planBotTacticalThrow(owner:Vec3,target:Vec3,id:EquipmentId,cover:CoverBox[],mapId:MapId):BotTacticalThrow|null {
  const dx=target[0]-owner[0],dz=target[2]-owner[2],distance=Math.hypot(dx,dz);
  if(distance<.1)return null;
  const yaw=Math.atan2(dx,dz);
  const origin:Vec3=[owner[0],owner[1]+EYE_HEIGHT*.86,owner[2]];
  const eye:Vec3=[target[0],target[1]+1,target[2]];
  const idealPitch=Math.atan2(eye[1]-origin[1],distance);
  const def=equipmentById(id);
  const grenade=def.type==="blast"||def.type==="flash";
  const angles=grenade ? [-.35,-.16,0,.17,.33,.5,.66,.83,1,1.16,1.30] :
    id==="mine" ? [-.25] : [idealPitch-.08,idealPitch,idealPitch+.06,idealPitch+.13,idealPitch+.20];
  let best:BotTacticalThrow|null=null,bestError=Infinity;
  for(const pitch of angles) {
    const cp=Math.cos(pitch),dir:Vec3=[Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp];
    const path:TimedProjectilePath = grenade
      ? tacticalGrenadePath(origin,dir,cover,mapId)
      : calculateThrowPath(origin,dir,id,(at,v,d)=>closestCoverHit(cover,at,v,d,rayBox)?.distance??null,owner[1]+.12);
    const impact=path.impact;
    const score = grenade ? Math.hypot(target[0]-impact[0],target[2]-impact[2]) :
      id==="mine" ? Math.hypot(impact[0]-owner[0],impact[2]-owner[2]) :
      segmentDistanceToPoint(path.points,eye);
    if(score<bestError){best={yaw,pitch,path};bestError=score;}
  }
  if(!best)return null;
  if(grenade){
    // Both friend and foe can see the blast, and bots must avoid self-flashing.
    const r=def.radius;
    const distanceFromBot=Math.hypot(best.path.impact[0]-owner[0],best.path.impact[2]-owner[2]);
    if(bestError>r*.72 || distanceFromBot<r+1) return null;
  }else if(id==="mine"){
    if(bestError>2.5)return null;
  }else if(bestError>.78)return null;
  return best;
}
