/** Deterministic cluster ordnance, shared by offline simulation and server. */
import type { Vec3, CoverBox } from "./game-protocol";
import { weaponById, projectileSplashRadius } from "./game-data";
import { CoverSpatialIndex } from "./cover-spatial-index";
import { MOVEMENT } from "./movement-rules";
import type {ObjectiveSource} from "./map-objectives";
import { orbitalGravity } from "./orbital-reactor";
import { bouncingProjectilePath, type TimedProjectilePath } from "./bouncing-projectile";
export { projectilePositionAt as clusterPositionAt } from "./bouncing-projectile";
export const CLUSTER_ID = "wonder_cluster";
export const CLUSTER_MAX_DAMAGE = 175;
export const CLUSTER_SHELL_FUSE_MS = 1400;
export interface ClusterShot { path: TimedProjectilePath; delayMs: number; damage: number; radius: number }
export interface ClusterVolley { id: string; ownerId: string; ownerTeam: string; launchedAt: number; shots: ClusterShot[] }

/** Ordnance follows the map's gravity, independently of an operator's equipped perk/weapon. */
export function clusterGravity(mapId:ObjectiveSource):number { return MOVEMENT.gravity*orbitalGravity(mapId); }

export function clusterShots(origin:Vec3,direction:Vec3,cover:CoverBox[],mapId:ObjectiveSource="compound"):ClusterShot[] {
  const len=Math.hypot(...direction)||1, dir=direction.map(v=>v/len) as Vec3;
  const weapon=weaponById(CLUSTER_ID), damage=weapon.stats.damage, radius=projectileSplashRadius(weapon);
  const gravity=clusterGravity(mapId);
  // One launch-time broadphase is shared by all seven paths. Never cache moving geometry.
  const index=new CoverSpatialIndex(cover);
  // Trace from the eye; a muzzle offset must never spawn a shell beyond a nearby wall.
  const main=bouncingProjectilePath(origin,[dir[0]*29,dir[1]*29+3,dir[2]*29],cover,
    {gravity,radius:.13,fuseMs:CLUSTER_SHELL_FUSE_MS,restitution:.52,friction:.8},index);
  const result:ClusterShot[]=[{path:main,delayMs:0,damage,radius}];
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    const start:Vec3=[main.impact[0],main.impact[1]+.06,main.impact[2]];
    const path=bouncingProjectilePath(start,[Math.cos(a)*6.2,4.5,Math.sin(a)*6.2],cover,
      {gravity,radius:.09,fuseMs:900+i*50,restitution:.46,friction:.74},index);
    result.push({path,delayMs:main.flightMs,damage:damage*.625,radius:radius*.75});
  }
  return result;
}
export function clusterDamage(distance:number,shot:Pick<ClusterShot,"radius"|"damage">):number {
  return distance>=shot.radius?0:shot.damage*(1-.65*Math.max(0,distance)/shot.radius);
}
export function clusterLifetime(shots:readonly ClusterShot[]):number {
  return Math.max(...shots.map(s=>s.delayMs+s.path.flightMs));
}
