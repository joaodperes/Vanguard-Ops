/** Deterministic ballistic paths, shared by offline simulation and server. */
import type { Vec3, CoverBox } from "./game-protocol";
import { rayBox } from "./game-protocol";
import type { ThrowPath } from "./throw-trajectory";
export const CLUSTER_ID = "wonder_cluster";
export const CLUSTER_MAX_DAMAGE = 135;
export interface ClusterShot { path: ThrowPath; delayMs: number; damage: number; radius: number }
export interface ClusterVolley { id: string; ownerId: string; ownerTeam: string; launchedAt: number; shots: ClusterShot[] }
function arc(origin: Vec3, velocity: Vec3, cover: CoverBox[], seconds: number): ThrowPath {
  const points: Vec3[] = [[...origin]];
  const dt=.025;
  for(let t=dt;t<=seconds+dt/2;t+=dt){
    const prev=points[points.length-1];
    const next:Vec3=[origin[0]+velocity[0]*t,origin[1]+velocity[1]*t-7*t*t,origin[2]+velocity[2]*t];
    const v:Vec3=[next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]], len=Math.hypot(...v);
    const dir:Vec3=[v[0]/len,v[1]/len,v[2]/len];
    let hit=len+1;
    for(const box of cover){if(box.kind==="accent")continue;const d=rayBox(prev,dir,box.pos,box.size);if(d!==null&&d>=0)hit=Math.min(hit,d);}
    if(next[1]<.12 && prev[1]>=.12)hit=Math.min(hit,len*(prev[1]-.12)/(prev[1]-next[1]));
    if(hit<=len){
      const d=Math.max(0,hit-.045),impact:Vec3=[prev[0]+dir[0]*d,Math.max(.12,prev[1]+dir[1]*d),prev[2]+dir[2]*d];
      points.push(impact);return {points,impact,flightMs:Math.max(25,Math.round((t-dt+dt*d/len)*1000))};
    }
    points.push(next);
  }
  return {points,impact:points[points.length-1],flightMs:Math.round(seconds*1000)};
}
export function clusterShots(origin: Vec3, direction: Vec3, cover: CoverBox[]): ClusterShot[] {
  const len=Math.hypot(...direction)||1, dir=direction.map(v=>v/len) as Vec3;
  // Trace from the eye; spawning beyond a nearby wall must never bypass it.
  const main=arc(origin,[dir[0]*29,dir[1]*29+3,dir[2]*29],cover,3);
  const result:ClusterShot[]=[{path:main,delayMs:0,damage:60,radius:3.4}];
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    const start:Vec3=[...main.impact];start[1]+=.06;
    result.push({path:arc(start,[Math.cos(a)*5.2,4.1,Math.sin(a)*5.2],cover,.8),
      delayMs:main.flightMs,damage:42,radius:2.6});
  }
  return result;
}
export function clusterDamage(distance: number, shot: Pick<ClusterShot,"radius"|"damage">): number {
  return distance>=shot.radius ? 0 : shot.damage*(1-.8*Math.max(0,distance)/shot.radius);
}
export function clusterLifetime(shots: readonly ClusterShot[]): number {
  return Math.max(...shots.map(s=>s.delayMs+s.path.flightMs));
}
