/** Shared offline/server bot roaming among real map spawns. */
import type { Vec3 } from "./game-protocol";

/** Vertical separation matters: a dungeon destination cannot be reached from its roof. */
export function botPatrolDistance(from:readonly number[],to:readonly number[]):number{
  return Math.hypot(to[0]-from[0],to[2]-from[2],(to[1]-from[1])*2);
}

/** Distant enemy spawns make sensible patrol objectives in TDM.
 * Emberhold's three levels receive deliberate visitation in FFA/Gun Game/PvE.
 * Underground patrols favour returning to the courtyard to avoid camping. */
export function chooseBotPatrolPoint(
  team:string,mode:string,position:readonly number[],
  red:readonly (readonly number[])[],blue:readonly (readonly number[])[],
  ffa:readonly (readonly number[])[],random:()=>number=Math.random,mapId?:string,
):Vec3{
  const candidates=mode==="tdm"?(team==="red"?blue:red):ffa;
  let pool=candidates.filter(p=>botPatrolDistance(position,p)>9);
  if(!pool.length)pool=candidates.length?[...candidates]:[...ffa];
  if(!pool.length)return [position[0]+12,position[1],position[2]+8];
  if(mapId==="emberhold"&&mode!=="tdm"){
    const dungeon=pool.filter(p=>p[1]<2);
    const roof=pool.filter(p=>p[1]>8);
    const surface=pool.filter(p=>p[1]>=2&&p[1]<=8);
    const r=random();
    const preferred=position[1]<2
      ? (r<.64?surface:r<.84?dungeon:roof)
      : position[1]>8
        ? (r<.38?dungeon:r<.90?surface:roof)
        : (r<.37?dungeon:r<.52?roof:surface);
    if(preferred.length)pool=preferred;
  }
  const point=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  return [point[0],point[1],point[2]];
}
