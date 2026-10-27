/** Rooftop and bandstand patrol anchors backed by actual, generated stair
 * collision. Bots navigate to the lowest tread, then climb physically.
 * No teleportation or imaginary ladders. */
import type {Vec3} from "./game-protocol";
import {cityBandstandBoxes,cityBuildingBoxes,type MapProp} from "./map-visuals";

export interface HighGroundGoal{roof:Vec3;entry:Vec3;kind:"roof"|"bandstand"}

export function cityHighGroundGoals(props:readonly MapProp[]):HighGroundGoal[]{
  const goals:HighGroundGoal[]=[];
  for(const p of props){
    if(p.kind!=="bandstand"&&(p.kind!=="building"||p.roofAccess===false))continue;
    const cover=p.kind==="bandstand"?cityBandstandBoxes(p):cityBuildingBoxes(p);
    // Entry must be at a physical ground-access staircase, NOT on an
    // interior tread that is unreachable from the street.
    const stairs=cover.filter(c=>c.kind==="stair"&&
      (p.kind==="bandstand"||
      Math.abs(c.pos[0]-p.x)>(p.w??20)/2+.1||
      Math.abs(c.pos[2]-p.z)>(p.d??20)/2+.1));
    if(stairs.length<3)continue;
    const bottom=stairs.reduce((a,b)=>
      a.pos[1]+a.size[1]<b.pos[1]+b.size[1]?a:b);
    const top=p.h??(p.kind==="bandstand"?5:6.4);
    goals.push({
      roof:[p.x,(p.y??0)+top+.42,p.z],
      entry:[bottom.pos[0],bottom.pos[1]+bottom.size[1],bottom.pos[2]],
      kind:p.kind==="bandstand"?"bandstand":"roof",
    });
  }
  return goals;
}

export function chooseCityHighGroundGoal(
  from:readonly number[],goals:readonly HighGroundGoal[],variation=0,
):HighGroundGoal|null{
  const options=goals.filter(g=>{
    const distance=Math.hypot(g.entry[0]-from[0],g.entry[2]-from[2]);
    return g.roof[1]>from[1]+1.5&&distance<70&&distance>2;
  }).sort((a,b)=>{
    const da=Math.hypot(a.entry[0]-from[0],a.entry[2]-from[2]);
    const db=Math.hypot(b.entry[0]-from[0],b.entry[2]-from[2]);
    return da-db;
  });
  if(!options.length)return null;
  // Different bots get a chance to explore more than the same closest roof.
  return options[Math.abs(Math.floor(variation))%Math.min(options.length,3)];
}

/** Next physically staged climbing target. The bot still runs ordinary
 * collision and gravity after selecting the waypoint. */
export function cityHighGroundStep(
  from:Vec3,goal:HighGroundGoal,cover:readonly import("./game-protocol").CoverBox[],
):Vec3{
  const dist=Math.hypot(from[0]-goal.entry[0],from[2]-goal.entry[2]);
  if(dist>3.2&&from[1]<goal.entry[1]+.6)return goal.entry;
  if(from[1]>=goal.roof[1]-.8)return goal.roof;
  const steps=cover.filter(c=>c.kind==="stair"&&
    c.pos[1]+c.size[1]>from[1]+.1&&
    c.pos[1]+c.size[1]<=from[1]+.7&&
    Math.hypot(c.pos[0]-goal.entry[0],c.pos[2]-goal.entry[2])<29&&
    Math.hypot(c.pos[0]-from[0],c.pos[2]-from[2])<5);
  if(!steps.length)return goal.entry;
  const chosen=steps.reduce((a,b)=>{
    const cost=(c:typeof a)=>
      Math.hypot(c.pos[0]-from[0],c.pos[2]-from[2])+
      Math.hypot(c.pos[0]-goal.roof[0],c.pos[2]-goal.roof[2])*.02;
    return cost(a)<cost(b)?a:b;
  });
  return [chosen.pos[0],chosen.pos[1]+chosen.size[1],chosen.pos[2]];
}
