import {describe,test,expect} from "bun:test";
import {MAP_LIST,getMap,mapAllowedForMode,teamSizesForMap,teamSizeAllowed,roomCapacity,type Vec3} from "../src/lib/game-protocol";
import {CTF_LAYOUTS} from "../src/lib/ctf-layouts";
import {createCtfFlags,ctfHome,ctfBase,ctfTouch,ctfBotIntent,ctfStairWaypoint,CTF_PICKUP_RADIUS,CTF_CAPTURE_RADIUS} from "../src/lib/ctf-rules";
import {spawnClear,chooseSpawn} from "../src/lib/spawn-selection";
import {makeEnvironmentMap,withinEnvironment} from "../src/lib/dynamic-environment";
import {insideRegions} from "../src/lib/map-blueprints";
import {botTraversableEdge,botNextWaypoint} from "../src/lib/bot-routing";
import {CoverSpatialIndex} from "../src/lib/cover-spatial-index";
import {useGame} from "../src/lib/game-store";

describe("mode availability and spawn capacity",()=>{
 test("TDM and Kill Confirmed each have nine maps, with opposite Afterlight variants removed",()=>{
  expect(MAP_LIST).toHaveLength(10);
  expect(MAP_LIST.filter(m=>mapAllowedForMode("tdm",m.id))).toHaveLength(9);
  expect(MAP_LIST.filter(m=>mapAllowedForMode("killconfirmed",m.id))).toHaveLength(9);
  expect(mapAllowedForMode("tdm","arena_neon")).toBe(false); // Afterlight City (night)
  expect(mapAllowedForMode("tdm","terminal")).toBe(true);    // Afterlight City (Day)
  expect(mapAllowedForMode("killconfirmed","terminal")).toBe(false);
  expect(mapAllowedForMode("killconfirmed","arena_neon")).toBe(true);
  for(const map of MAP_LIST){
   if(map.id!=="arena_neon")expect(mapAllowedForMode("tdm",map.id)).toBe(true);
   if(map.id!=="terminal")expect(mapAllowedForMode("killconfirmed",map.id)).toBe(true);
  }
  for(const id of ["forest_warfare","orbital_nexus","floodgate","whiteout_depot"]){expect(mapAllowedForMode("ffa",id)).toBe(false);expect(mapAllowedForMode("survival",id)).toBe(false);}
  expect(MAP_LIST.filter(m=>mapAllowedForMode("ctf",m.id))).toHaveLength(6);
 });
 test("Blacksite mode caps and UI transitions agree",()=>{
  expect(teamSizesForMap("bunker","tdm")).toEqual([3,5]);expect(teamSizesForMap("bunker","ffa")).toEqual([3,4]);
  expect(roomCapacity("ffa",4)).toBe(8);expect(teamSizeAllowed("bunker",7,"tdm")).toBe(false);
  const store=useGame.getState();store.setRoomConfig({mapId:"floodgate",mode:"tdm",teamSize:16});
  expect(useGame.getState().roomConfig.teamSize).toBe(16);
  store.setRoomConfig({mapId:"bunker"});expect(useGame.getState().roomConfig.teamSize).toBe(3);
  store.setRoomConfig({teamSize:5});store.setRoomConfig({mode:"ffa"});expect(useGame.getState().roomConfig.teamSize).toBe(4);
  store.setRoomConfig({mapId:"shipyard",mode:"tdm"});expect(useGame.getState().roomConfig.teamSize).toBe(5);
 });
 test("per-map recommended and expanded player counts are consistent",()=>{
  const {recommendedTeamSize}=require("../src/lib/game-protocol") as typeof import("../src/lib/game-protocol");
  for(const id of ["terminal","arena_neon"]){
    expect(teamSizesForMap(id,"tdm")).toEqual([5,7,9,16]);
    expect(teamSizesForMap(id,"ffa")).toEqual([5,7,9,16]);
    expect(recommendedTeamSize(id,"tdm")).toBe(9);
    expect(recommendedTeamSize(id,"ffa")).toBe(7);
  }
  expect(teamSizesForMap("floodgate","tdm")).toEqual([5,7,9,16]);
  expect(recommendedTeamSize("floodgate")).toBe(7);
  for(const id of ["compound","skybridge"]){
    expect(teamSizesForMap(id,"ctf")).toEqual([3,5,7,9]);
    expect(recommendedTeamSize(id)).toBe(7);
  }
 });
 test("every enabled PvP map/mode has enough unique collision-safe spawn points",()=>{
  for(const base of MAP_LIST)for(const mode of ["tdm","killconfirmed","ctf","ffa","gungame"] as const){
   if(!mapAllowedForMode(mode,base.id))continue;
   const map=makeEnvironmentMap(getMap(base.id,mode)),max=teamSizesForMap(map.id,mode).at(-1)!;
   for(const team of mode==="ffa"||mode==="gungame"?["ffa"] as const:["red","blue"] as const){
    const safe=map.spawns[team].filter(p=>spawnClear(map,p)),count=new Set(safe.map(p=>p.join(","))).size;
    if(count<(team==="ffa"?max*2:max))throw Error(`${map.id}/${mode}/${team}: only ${count} safe spawns`);
   }
  }
 });
});

describe("Verdant Ruins and Ridgefall CTF",()=>{
 for(const id of ["compound","skybridge"] as const){
  const map=makeEnvironmentMap(getMap(id,"ctf")),index=new CoverSpatialIndex(map.cover);
  test(`${id}: objectives and rear spawn pools are clear without mutating other modes`,()=>{
   expect(getMap(id).spawns).not.toEqual(map.spawns);
   expect(Object.keys(CTF_LAYOUTS)).toContain(id);
   for(const team of ["red","blue"] as const){
    expect(map.spawns[team]).toHaveLength(10);
    for(const p of [...map.spawns[team],ctfHome(team,id),ctfBase(team,id)]){
     expect(spawnClear(map,p)).toBe(true);expect(insideRegions(p[0],p[2],map.regions!,1.1)).toBe(true);
     expect(map.environment!.some(o=>withinEnvironment(o,p,1))).toBe(false);
    }
    const base=ctfBase(team,id);
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
     expect(spawnClear(map,[base[0]+Math.cos(angle)*4.25,base[1],base[2]+Math.sin(angle)*4.25])).toBe(true);
    }
    expect(ctfStairWaypoint(ctfHome(team,id),[0,0,0],id)).toEqual(ctfHome(team,id));
    const intent=ctfBotIntent(createCtfFlags(id),team,"raider",map.spawns[team][0],"ar_m4",["a","raider"],{},id);
    expect(intent.goal[1]).toBe(0);
   }
  });
  test(`${id}: both teams complete physical pickup and capture routes`,()=>{
   for(const team of ["red","blue"] as const){
    let pos:Vec3=[...map.spawns[team][0]];const flags=createCtfFlags(id),enemy=team==="red"?"blue":"red";
    for(const [goal,radius,kind] of [[ctfHome(enemy,id),CTF_PICKUP_RADIUS,"pickup"],[ctfBase(team,id),CTF_CAPTURE_RADIUS,"capture"]] as const){
     const seen=new Set<string>();
     for(let step=0;step<600&&Math.hypot(pos[0]-goal[0],pos[2]-goal[2])>=radius;step++){
      const waypoint=botNextWaypoint(pos,goal,map.cover,map.size,3,map.environment,map.regions,index);
      if(!waypoint||seen.has(waypoint.join(",")))throw Error(`${id}/${team}/${kind}: stalled at ${pos}, next ${waypoint}`);
      expect(botTraversableEdge(pos,waypoint[0],waypoint[2],map.cover,map.environment,index)).not.toBeNull();
      seen.add(waypoint.join(","));pos=waypoint;
     }
     expect(ctfTouch(flags,{id:"carrier",team,pos},id)?.kind).toBe(kind);
    }
   }
  },30000);
 }
});

describe("shared respawn safety",()=>{
 const base=getMap("bunker");
 const make=(pool:Vec3[])=>({...base,cover:[],environment:[],spawns:{red:pool,blue:pool,ffa:pool}});
 test("jitter cannot defeat eight-unit separation",()=>{
  const map=make([[7.9,0,0],[8.1,0,0]]);
  expect(chooseSpawn({},map,"red",[{pos:[0,0,0],team:"red"}],0,()=>1)[0]).toBe(8.1);
 });
 test("blocked sightlines outrank an exposed spawn",()=>{
  const map=make([[0,0,0],[0,0,20]]);map.cover=[{pos:[10,2,0],size:[1,2,4],kind:"cover"}];
  expect(chooseSpawn({},map,"red",[{pos:[20,0,0],team:"blue"}],0,()=>0)).toEqual([0,0,0]);
 });
 test("allies reserve initial space and congested fallback chooses actual distance",()=>{
  const map=make([[0,0,0],[7,0,0],[15,0,0]]),room={};
  chooseSpawn(room,map,"red",[],0,()=>0);
  expect(chooseSpawn(room,map,"red",[{pos:[0,0,0],team:"red"}],1,()=>0)[0]).toBe(15);
  expect(chooseSpawn(room,make([[0,0,0],[7,0,0]]),"red",[{pos:[0,0,0],team:"red"}],2,()=>0)[0]).toBe(7);
 });
 test("recent spawns rotate even with an empty lobby; histories belong to each room",()=>{
  const map=make([[0,0,0],[20,0,0]]),room={};
  expect(chooseSpawn(room,map,"red",[],100,()=>0)[0]).toBe(0);
  expect(chooseSpawn(room,map,"red",[],101,()=>0)[0]).toBe(20);
  expect(chooseSpawn({},map,"red",[],101,()=>0)[0]).toBe(0);
 });
});
