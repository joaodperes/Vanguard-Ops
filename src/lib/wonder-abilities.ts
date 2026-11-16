/** Pure gameplay rules shared by offline and authoritative Wonder implementations. */
export type Point3=[number,number,number];
export interface WonderBox{pos:Point3;size:Point3;kind?:string;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const CHRONO_ANCHOR_MS=12000;
export const PHANTOM_DURATION_MS=13500;
/** Place decoys in front of the pilot and laterally stagger double decoys. */
export function phantomSpawnPosition(feet:Point3,yaw:number,lateral=0):Point3{
 return [feet[0]+Math.sin(yaw)*1.8+Math.cos(yaw)*lateral,feet[1],
         feet[2]+Math.cos(yaw)*1.8-Math.sin(yaw)*lateral];
}
/** Movement originates at deployment rather than tracking the owner's position. */
export function phantomTravelPosition(spawn:Point3,yaw:number,elapsedMs:number):Point3{
 const distance=Math.min(12,Math.max(0,elapsedMs)*.00145);
 return [spawn[0]+Math.sin(yaw)*distance,spawn[1],spawn[2]+Math.cos(yaw)*distance];
}
export const CRYO_SLOW_MS=1800;
export const CRYO_SLOW_FACTOR=.58;
export const JUGGERNAUT_DROP_MS=2750;
export const JUGGERNAUT_CRUSH_RADIUS=2.4;
export const JUGGERNAUT_ACTIVE_MS=90000;
export const JUGGERNAUT_MINIGUN_RATE=12;
export const JUGGERNAUT_SHOTGUN_RATE=1.05;
export const JUGGERNAUT_SWARM_RATE=.8;
export interface MechTuning {
 armor:number;movement:number;minigunAmmo:number;secondaryAmmo:number;minigunDamage:number;
 shotgunDamage:number;shotgunPellets:number;minigunSpinupMs:number;secondary:"shotgun"|"swarm";
}
export function mechTuning(moduleId?:string):MechTuning{
 const r:MechTuning={armor:450,movement:.60,minigunAmmo:500,secondaryAmmo:24,
  minigunDamage:17,shotgunDamage:15,shotgunPellets:7,minigunSpinupMs:550,secondary:"shotgun"};
 if(moduleId==="siegebreaker"){r.armor=600;r.movement=.48;r.minigunSpinupMs=950;}
 if(moduleId==="raider_configuration"){r.armor=290;r.movement=.74;r.minigunSpinupMs=400;r.secondaryAmmo=30;}
 if(moduleId==="guardian_protocol"){r.armor=500;r.movement=.54;r.minigunAmmo=330;r.secondaryAmmo=14;}
 if(moduleId==="swarm_pod"){r.secondary="swarm";r.secondaryAmmo=9;}
 if(moduleId==="munitions_mule"){r.minigunAmmo=800;r.secondaryAmmo=36;r.movement=.54;}
 return r;
}
/** A landing needs 2.5m of horizontal clearance and an open path from the sky.
 * Box coordinates are center/half-extent; a roof or elevated bridge vetoes it.
 * Also rule out upper indoor floors; don't allow a pod to materialize through a ceiling. */
export function juggernautDropPoint(
 feet:Point3,yaw:number,cover:readonly WonderBox[],mapSize:number,
):Point3|null{
 const x=feet[0]-Math.sin(yaw)*5.2,z=feet[2]-Math.cos(yaw)*5.2,y=feet[1];
 if(Math.abs(x)>mapSize-4||Math.abs(z)>mapSize-4)return null;
 for(const box of cover){
  if(box.kind==="accent")continue;
  if(Math.abs(box.pos[0]-x)>box.size[0]+2.5||Math.abs(box.pos[2]-z)>box.size[2]+2.5)continue;
  const low=box.pos[1]-box.size[1],high=box.pos[1]+box.size[1];
  // Ground-height floor slab directly beneath a standing player is fine.
  if(high<=y+.15)continue;
  // Any obstruction above the drop site prevents the aircraft drop.
  if(low>y-1||high>y+1)return null;
 }
 return [x,y,z];
}
export function crushesAtLanding(victim:Point3,landing:Point3):boolean{
 return Math.abs(victim[1]-landing[1])<2.4&&Math.hypot(victim[0]-landing[0],victim[2]-landing[2])<=JUGGERNAUT_CRUSH_RADIUS;
}
/** Ground slam strikes in every direction at comparable elevation. */
export function seismicPulseHit(origin:Point3,target:Point3,radius:number):boolean{
 return Math.abs(origin[1]-target[1])<=2.6&&
   Math.hypot(target[0]-origin[0],target[2]-origin[2])<=radius;
}
/** Radial push rather than the player's aiming direction. */
export function seismicPushPosition(origin:Point3,target:Point3,meters=4.5):Point3{
 const dx=target[0]-origin[0],dz=target[2]-origin[2],len=Math.hypot(dx,dz);
 return [target[0]+(len>.001?dx/len:0)*meters,target[1],
         target[2]+(len>.001?dz/len:1)*meters];
}
export function wonderConeHit(origin:Point3,dir:Point3,target:Point3,range:number,cosine:number):boolean{
 const diff:Point3=[target[0]-origin[0],target[1]-origin[1],target[2]-origin[2]];
 const distance=Math.hypot(...diff);
 return distance<=range&&distance>.01&&(diff[0]*dir[0]+diff[1]*dir[1]+diff[2]*dir[2])/distance>=cosine;
}
function boxRay(origin:Point3,dir:Point3,box:WonderBox):{t:number;axis:0|1|2}|null{
 let lo=0,hi=Infinity,hitAxis:0|1|2=0;
 for(const a of [0,1,2] as const){
  const min=box.pos[a]-box.size[a],max=box.pos[a]+box.size[a];
  if(Math.abs(dir[a])<1e-8){if(origin[a]<min||origin[a]>max)return null;continue;}
  const t1=(min-origin[a])/dir[a],t2=(max-origin[a])/dir[a];
  const enter=Math.min(t1,t2),leave=Math.max(t1,t2);
  if(enter>lo){lo=enter;hitAxis=a;}
  hi=Math.min(hi,leave);
  if(lo>hi)return null;
 }
 return hi>=0?{t:Math.max(0,lo),axis:hitAxis}:null;
}
export interface RipperSegment{from:Point3;to:Point3;damageScale:number;}
/** Reflect off solid AABB walls; never go through the same face on the next bounce. */
export function ripperSegments(origin:Point3,direction:Point3,cover:readonly WonderBox[],
 maxDistance:number,maxBounces=4):RipperSegment[]{
 const out:RipperSegment[]=[];
 const len=Math.hypot(...direction)||1;
 let dir:Point3=[direction[0]/len,direction[1]/len,direction[2]/len];
 let pos:Point3=[...origin],remaining=maxDistance;
 for(let bounce=0;bounce<=maxBounces&&remaining>.2;bounce++){
  let best:ReturnType<typeof boxRay>=null;
  for(const box of cover){
   if(box.kind==="accent"||box.kind==="stair")continue;
   const hit=boxRay(pos,dir,box);
   if(hit&&hit.t>.025&&hit.t<remaining&&(!best||hit.t<best.t))best=hit;
  }
  const distance=best?best.t:remaining;
  const to:Point3=[pos[0]+dir[0]*distance,pos[1]+dir[1]*distance,pos[2]+dir[2]*distance];
  out.push({from:[...pos],to,damageScale:Math.pow(.72,bounce)});
  remaining-=distance;
  if(!best)break;
  // Each ricochet adds to the disc's total flight budget. A bounce no
  // longer consumes the same fixed 55m range as an unbounced throw.
  remaining+=Math.max(12,maxDistance*.35);
  dir=[...dir];dir[best.axis]*=-1;
  pos=[to[0]+dir[0]*.045,to[1]+dir[1]*.045,to[2]+dir[2]*.045];
  remaining-=.045;
 }
 return out;
}
export function clampedMechSpeed(delta:number,tuning:MechTuning,walkSpeed:number){
 return clamp(delta,-walkSpeed*tuning.movement,walkSpeed*tuning.movement);
}
