/** Shared deterministic balancing and geometry for the Harbinger reconnaissance drone.
 * The authoritative server applies health, targeting, fire, and team validation;
 * offline gameplay uses these same pure rules.
 */
export type DroneVec3=readonly [number,number,number];
export const HARBINGER_DRONE_HP=90;
export const HARBINGER_DURATION_MS=18000;
export const HARBINGER_INTERVAL_MS=1000/3;
export const HARBINGER_SCAN_INTERVAL_MS=900;
export const HARBINGER_RADIUS=20;
export const HARBINGER_DAMAGE=12;
export const HARBINGER_HIT_RADIUS=.58;
export interface HarbingerTarget {id:string;pos:DroneVec3;team:string;alive:boolean;protected?:boolean;}
export function harbingerTuning(moduleId?:string){
  return {range:HARBINGER_RADIUS*(moduleId==="silent_survey"?1.25:moduleId==="hunter_killer"?.75:1),
    damage:HARBINGER_DAMAGE*(moduleId==="silent_survey"?.65:moduleId==="hunter_killer"?1.4:1),
    durationMs:HARBINGER_DURATION_MS,health:HARBINGER_DRONE_HP};
}
export function harbingerTargets(pos:DroneVec3,ownerId:string,ownerTeam:string,mode:string,candidates:readonly HarbingerTarget[],range:number,canSee:(to:DroneVec3)=>boolean,priorityId?:string){
 return candidates.filter(t=>t.alive&&!t.protected&&t.id!==ownerId&&
  ((mode==="ffa"||mode==="gungame")||t.team!==ownerTeam)&&
  Math.hypot(t.pos[0]-pos[0],t.pos[1]+1-pos[1],t.pos[2]-pos[2])<=range&&
  canSee([t.pos[0],t.pos[1]+1,t.pos[2]]))
  .sort((a,b)=>(a.id===priorityId?-10000:0)-(b.id===priorityId?-10000:0)+
  Math.hypot(a.pos[0]-pos[0],a.pos[2]-pos[2])-Math.hypot(b.pos[0]-pos[0],b.pos[2]-pos[2]));
}
/** Sphere hit against a normalized ray, never through nearer hard cover. */
export function harbingerRayHit(origin:DroneVec3,dir:DroneVec3,center:DroneVec3,maxDistance:number):number|null {
 const d=[center[0]-origin[0],center[1]-origin[1],center[2]-origin[2]];
 const projection=d[0]*dir[0]+d[1]*dir[1]+d[2]*dir[2];
 if(projection<0||projection>maxDistance)return null;
 const dist2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2]-projection*projection;
 if(dist2>HARBINGER_HIT_RADIUS**2)return null;
 return Math.max(0,projection-Math.sqrt(Math.max(0,HARBINGER_HIT_RADIUS**2-dist2)));
}
export function harbingerPlacement(origin:DroneVec3,dir:DroneVec3,distance:number,mapSize:number):[number,number,number] {
 const t=Math.max(2,Math.min(14,distance-0.6));
 return [Math.max(2-mapSize,Math.min(mapSize-2,origin[0]+dir[0]*t)),
  Math.max(.9,origin[1]+dir[1]*t+.8),
  Math.max(2-mapSize,Math.min(mapSize-2,origin[2]+dir[2]*t))];
}
