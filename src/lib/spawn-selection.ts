/** Identical spawn scoring for offline play and authoritative rooms. */
import {PLAYER_HEIGHT,PLAYER_RADIUS,rayBox,type MapDef,type Vec3} from "./game-protocol";
import {botGroundHeight} from "./bot-physics";
import {lavaAt, withinEnvironment} from "./dynamic-environment";

export function spawnClear(map:MapDef,sp:Vec3):boolean {
  return !map.cover.some(c=>Math.abs(sp[0]-c.pos[0])<c.size[0]+PLAYER_RADIUS &&
    Math.abs(sp[2]-c.pos[2])<c.size[2]+PLAYER_RADIUS &&
    c.pos[1]+c.size[1]>sp[1]+.5 && c.pos[1]-c.size[1]<sp[1]+PLAYER_HEIGHT) &&
    !(map.environment??[]).some(o=>(o.type==="fire"||o.type==="spikes")&&withinEnvironment(o,sp,1)) &&
    !lavaAt(map.environment,sp);
}
const histories=new WeakMap<object,Map<string,number>>();
export function chooseSpawn(owner:object,map:MapDef,team:string,
  occupants:readonly {pos:Vec3;team:string}[],now=Date.now(),random=Math.random):Vec3 {
  const pool=team==="red"?map.spawns.red:team==="blue"?map.spawns.blue:map.spawns.ffa;
  const safe=pool.filter(p=>spawnClear(map,p));
  const history=histories.get(owner)??new Map<string,number>();histories.set(owner,history);
  const candidates=(safe.length?safe:pool).map(sp=>{
    const separation=Math.min(...occupants.map(p=>Math.hypot(p.pos[0]-sp[0],p.pos[2]-sp[2])),120);
    let exposed=0;
    const eye:Vec3=[sp[0],sp[1]+1.6,sp[2]];
    for(const p of occupants){
      if(team!=="ffa"&&p.team===team)continue;
      const delta:Vec3=[p.pos[0]-eye[0],p.pos[1]+1.6-eye[1],p.pos[2]-eye[2]];
      const distance=Math.hypot(...delta);if(distance>90||distance<.01)continue;
      const direction=delta.map(v=>v/distance) as Vec3;
      if(!map.cover.some(c=>{if(c.kind==="accent")return false;const hit=rayBox(eye,direction,c.pos,c.size);return hit!==null&&hit>=0&&hit<distance;}))exposed++;
    }
    const recent=now-(history.get(sp.join(","))??-Infinity)<8000;
    return {sp,separation,exposed,score:separation-(recent?18:0)+random()*.5};
  });
  // Actual distance determines the safe tier; random tie-breaking cannot turn
  // a 7m spawn into an 8m spawn. Congested rooms retain a farthest fallback.
  candidates.sort((a,b)=>Number(b.separation>=8)-Number(a.separation>=8)||
    (a.separation>=8&&b.separation>=8?a.exposed-b.exposed:b.separation-a.separation)||b.score-a.score);
  const chosen=candidates[0].sp;history.set(chosen.join(","),now);
  return [chosen[0],Math.max(chosen[1],botGroundHeight(map.cover,chosen[0],chosen[2],chosen[1])),chosen[2]];
}
