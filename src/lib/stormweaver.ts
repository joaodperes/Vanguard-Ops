/** Stormweaver's scattershot and energy-mine rules.
 * Deterministic geometry is shared by offline combat and the match server.
 * No target/damage/mine coordinates are ever accepted from clients.
 */
import { rayBox, type CoverBox, type Vec3 } from "./game-protocol";
import { rayCombatantHit } from "./combat-hitboxes";

export const STORM_PELLETS = 7;
export const STORM_SPREAD = .065;
export const STORM_CHAIN_JUMPS = 2;
export const STORM_MINE_JUMPS = 2;
export const STORM_MINE_ARM_MS = 450;
export const STORM_MINE_LIFETIME_MS = 4000;
export const STORM_MINE_TRIGGER_RADIUS = 2.65;
export const STORM_MINE_CHAIN_RADIUS = 9;
export const STORM_MAX_MINES_PER_OWNER = 12;
export const STORM_MINE_TARGET_COOLDOWN_MS = 1200;
export const STORM_DIRECT_DAMAGE = 22;
export const STORM_MINE_DAMAGE = 24;
export const STORM_MAX_DIRECT_HITS_PER_TARGET = 3;
export const STORM_CHAIN_DECAY = .63;

export interface StormVictim {
  id:string; pos:Vec3; alive:boolean; team:string; protected?:boolean;
}

/** Stable and symmetric pellet fan, perpendicular to arbitrary camera pitch. */
export function stormPelletDirections(direction:Vec3):Vec3[] {
  const norm=(v:Vec3):Vec3=>{
    const len=Math.hypot(...v)||1;
    return [v[0]/len,v[1]/len,v[2]/len];
  };
  const d=norm(direction);
  const axis=Math.abs(d[1])>.98?[1,0,0] as Vec3:[0,1,0] as Vec3;
  const right=norm([axis[1]*d[2]-axis[2]*d[1],
    axis[2]*d[0]-axis[0]*d[2],axis[0]*d[1]-axis[1]*d[0]]);
  const up=norm([d[1]*right[2]-d[2]*right[1],
    d[2]*right[0]-d[0]*right[2],d[0]*right[1]-d[1]*right[0]]);
  const out:Vec3[]=[d];
  for(let i=0;i<STORM_PELLETS-1;i++){
    const theta=2*Math.PI*i/(STORM_PELLETS-1);
    const radius=STORM_SPREAD*(i%2===0?1:.85);
    out.push(norm([d[0]+radius*(Math.cos(theta)*right[0]+Math.sin(theta)*up[0]),
      d[1]+radius*(Math.cos(theta)*right[1]+Math.sin(theta)*up[1]),
      d[2]+radius*(Math.cos(theta)*right[2]+Math.sin(theta)*up[2])]));
  }
  return out;
}

export function stormTargetPoint(victim:StormVictim):Vec3{
  return [victim.pos[0],victim.pos[1]+1.05,victim.pos[2]];
}
export function stormEnemy(v:StormVictim,ownerId:string,team:string,allowFriendly:boolean):boolean{
  return v.id!==ownerId&&v.alive&&!v.protected&&(allowFriendly||v.team!==team);
}
export interface StormPelletImpact { point:Vec3; victim:StormVictim|null; distance:number }
/** First real enemy or cover collision, respecting solid cover and limb hitboxes. */
export function traceStormPellet(origin:Vec3,dir:Vec3,range:number,
  cover:readonly CoverBox[],victims:readonly StormVictim[]):StormPelletImpact{
  const len=Math.hypot(...dir)||1,d:Vec3=[dir[0]/len,dir[1]/len,dir[2]/len];
  let distance=range,victim:StormVictim|null=null;
  for(const box of cover){
    if(box.kind==="accent"||box.kind==="stair")continue;
    const t=rayBox(origin,d,box.pos,box.size);
    if(t!==null&&t>=0&&t<distance)distance=t;
  }
  for(const c of victims){
    const hit=rayCombatantHit(origin,d,c.pos);
    if(hit&&hit.t>=0&&hit.t<distance){distance=hit.t;victim=c;}
  }
  return {point:[origin[0]+d[0]*distance,origin[1]+d[1]*distance,
    origin[2]+d[2]*distance],victim,distance};
}
/** A miss becomes a floor-mounted mine, never a hovering aerial trap. */
export function stormMinePosition(impact:Vec3,cover:readonly CoverBox[]):Vec3{
  let floor=0;
  for(const box of cover){
    if(box.kind==="accent"||box.kind==="stair")continue;
    const top=box.pos[1]+box.size[1];
    if(top>floor&&top<=impact[1]+.3 &&
      Math.abs(impact[0]-box.pos[0])<box.size[0]-.08 &&
      Math.abs(impact[2]-box.pos[2])<box.size[2]-.08)floor=top;
  }
  return [impact[0],floor+.11,impact[2]];
}
export function stormMineInReach(mine:Vec3,feet:Vec3):boolean{
  return Math.abs(feet[1]-(mine[1]-.11))<=2.4 &&
    Math.hypot(feet[0]-mine[0],feet[2]-mine[2])<=STORM_MINE_TRIGGER_RADIUS;
}
export function nextStormChainTarget(from:Vec3,targets:readonly StormVictim[],
  excluded:ReadonlySet<string>,ownerId:string,team:string,allowFriendly:boolean,
  radius:number,canSee:(from:Vec3,to:Vec3)=>boolean):StormVictim|null{
  return targets.filter(v=>!excluded.has(v.id)&&stormEnemy(v,ownerId,team,allowFriendly))
    .filter(v=>Math.hypot(v.pos[0]-from[0],v.pos[1]+1.05-from[1],v.pos[2]-from[2])<=radius&&
      canSee(from,stormTargetPoint(v)))
    .sort((a,b)=>{
      const ap=stormTargetPoint(a),bp=stormTargetPoint(b);
      return Math.hypot(ap[0]-from[0],ap[1]-from[1],ap[2]-from[2])-
        Math.hypot(bp[0]-from[0],bp[1]-from[1],bp[2]-from[2]);
    })[0]??null;
}
