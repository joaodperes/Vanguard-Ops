import {describe,test,expect} from 'bun:test';
import {MAP_LIST,CTF_MAP_IDS,getMap,mapAllowedForMode,teamSizesForMap,type Vec3} from '../src/lib/game-protocol';
import {MAP_BLUEPRINTS,validateBlueprint,insideRegions,featureBoxes,regionBoundary} from '../src/lib/map-blueprints';
import {makeEnvironmentMap,breakEnvironmentWall} from '../src/lib/dynamic-environment';
import {createCtfFlags,ctfHome,ctfBase,ctfTouch,ctfBotIntent,CTF_PICKUP_RADIUS,CTF_CAPTURE_RADIUS} from '../src/lib/ctf-rules';
import {spawnClear,chooseSpawn} from '../src/lib/spawn-selection';
import {CoverSpatialIndex} from '../src/lib/cover-spatial-index';
import {botTraversableEdge,botNextWaypoint} from '../src/lib/bot-routing';
import {propColliders} from '../src/lib/map-visuals';
const id='whiteout_depot',map=makeEnvironmentMap(getMap(id,'ctf')),plan=MAP_BLUEPRINTS.maps[id],index=new CoverSpatialIndex(map.cover);
function route(start:Vec3,goal:Vec3,minZ:number,maxZ:number){
 const queue=[start],seen=new Set([start.join(',')]);
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(Math.hypot(p[0]-goal[0],p[2]-goal[2])<4.1)return true;
  for(const [dx,dz] of [[4,0],[-4,0],[0,4],[0,-4]]){
   const x=p[0]+dx,z=p[2]+dz,key=x+','+z;
   if(seen.has(key)||Math.abs(x)>96||z<minZ||z>maxZ||!insideRegions(x,z,map.regions!,1))continue;
   const y=botTraversableEdge(p,x,z,map.cover,map.environment,index);if(y===null||y>.5)continue;
   seen.add(key);queue.push([x,y,z]);
  }
 }
 return false;
}
describe('Whiteout Depot CTF',()=>{
 test('six CTF choices, ten total maps, shared team-mode availability and 7v7 limit',()=>{
  expect(MAP_LIST).toHaveLength(10);expect(CTF_MAP_IDS).toHaveLength(6);
  for(const mode of ['ctf','tdm','killconfirmed'] as const)expect(mapAllowedForMode(mode,id)).toBe(true);
  for(const mode of ['ffa','gungame','survival'] as const)expect(mapAllowedForMode(mode,id)).toBe(false);
  expect(teamSizesForMap(id,'ctf')).toEqual([3,5,7]);expect(map.name).toBe('Whiteout Depot');
 });
 test('JSON owns the complete physical layout without inherited or suppressed objects',()=>{
  expect(validateBlueprint(plan)).toEqual([]);expect(map.editorLegacyCoverCount).toBe(0);
  const count=plan.features.flatMap(featureBoxes).length+propColliders(map.props!,Object.values(plan.spawns).flat()).length+regionBoundary(plan.regions).length+1;
  expect(map.cover).toHaveLength(count);expect(map.cover.length).toBeLessThan(250);
  expect(map.biome).toBe('snow_rail');expect(map.surfaces!.floor.pattern).toBe('snow');
 });
 test('twelve unique, mirrored spawns per team remain clear, including full initial batches',()=>{
  expect(map.spawns.red).toHaveLength(12);expect(map.spawns.red.map(p=>[-p[0],p[1],p[2]])).toEqual(map.spawns.blue);
  const occupants:{pos:Vec3;team:string}[]=[],room={};
  for(const team of ['red','blue'] as const){
   expect(new Set(map.spawns[team].map(p=>p.join(','))).size).toBe(12);
   for(const p of map.spawns[team]){expect(spawnClear(map,p)).toBe(true);expect(insideRegions(p[0],p[2],map.regions!,1.1)).toBe(true);}
   for(let i=0;i<7;i++)occupants.push({pos:chooseSpawn(room,map,team,occupants,1000,()=>0),team});
  }
  expect(new Set(occupants.map(p=>p.pos.join(','))).size).toBe(14);
 });
 test('all three ground lanes remain open with the service hatch intact',()=>{
  expect(route([-92,0,-46],[92,0,-46],-72,-22)).toBe(true);
  expect(route([-92,0,0],[92,0,0],-22,28)).toBe(true);
  expect(route([-92,0,44],[92,0,44],28,72)).toBe(true);
 });
 test('horizontal rail and gallery sightlines are interrupted',()=>{
  for(let z=-72;z<=72;z+=2){let run=0,longest=0;
   for(let x=-88;x<=88;x+=2){const blocked=map.cover.some(c=>c.kind!=='accent'&&c.pos[1]-c.size[1]<1.6&&c.pos[1]+c.size[1]>1.6&&Math.abs(x-c.pos[0])<=c.size[0]&&Math.abs(z-c.pos[2])<=c.size[2]);run=blocked?0:run+2;longest=Math.max(longest,run);}
   if(longest>100)throw Error(`Open ${longest}m horizontal sightline at z=${z}`);
  }
 });
 test('both carrier directions physically reach pickup and delivery radii',()=>{
  for(const team of ['red','blue'] as const){let pos:Vec3=[...map.spawns[team][3]];const flags=createCtfFlags(id),enemy=team==='red'?'blue':'red';
   for(const [goal,radius,kind] of [[ctfHome(enemy,id),CTF_PICKUP_RADIUS,'pickup'],[ctfBase(team,id),CTF_CAPTURE_RADIUS,'capture']] as const){
    const seen=new Set<string>();for(let n=0;n<500&&Math.hypot(pos[0]-goal[0],pos[2]-goal[2])>=radius;n++){
     const next=botNextWaypoint(pos,goal,map.cover,map.size,3,map.environment,map.regions,index);
     if(!next||seen.has(next.join(',')))throw Error(`Stalled ${team}/${kind} at ${pos}`);
     expect(botTraversableEdge(pos,next[0],next[2],map.cover,map.environment,index)).not.toBeNull();seen.add(next.join(','));pos=next;
    }
    expect(ctfTouch(flags,{id:'carrier',team,pos},id)?.kind).toBe(kind);
   }
   const base=ctfBase(team,id);for(let a=0;a<Math.PI*2;a+=Math.PI/8)expect(spawnClear(map,[base[0]+Math.cos(a)*4.25,0,base[2]+Math.sin(a)*4.25])).toBe(true);
   expect(ctfBotIntent(createCtfFlags(id),team,'raider',pos,'rifle_ar',['a','raider'],{},id).goal[1]).toBe(0);
  }
 },30000);
 test('breaching the hatch changes only the current room',()=>{
  const second=makeEnvironmentMap(getMap(id,'ctf'));breakEnvironmentWall(map,'whiteout-service-hatch');
  expect(map.cover.some(c=>c.environmentId==='whiteout-service-hatch')).toBe(false);
  expect(second.cover.some(c=>c.environmentId==='whiteout-service-hatch')).toBe(true);
 });
});
