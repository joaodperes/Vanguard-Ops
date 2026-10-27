import {describe,expect,test} from "bun:test";
import {MAP_BLUEPRINTS,insideRegions,validateBlueprint,featureBoxes} from "../src/lib/map-blueprints";
import {getMap,mapAllowedForMode} from "../src/lib/game-protocol";
import {makeEnvironmentMap} from "../src/lib/dynamic-environment";
import {botPositionEmbedded} from "../src/lib/bot-physics";
import {createCtfFlags,ctfHome,ctfBase,ctfTouch,ctfReturnExpired,ctfStairWaypoint,ctfBotIntent} from "../src/lib/ctf-rules";

describe("Orbital Nexus CTF map",()=>{
  const id="orbital_nexus" as const;
  test("is CTF-only, has usable geometry and safe spawns",()=>{
    const map=getMap(id),bp=MAP_BLUEPRINTS.maps[id];
    expect(mapAllowedForMode("ctf",id)).toBe(true);
    expect(mapAllowedForMode("tdm",id)).toBe(false);
    expect(validateBlueprint(bp)).toEqual([]);
    expect(map.name).toBe("ORBITAL NEXUS");
    expect(map.biome).toBe("orbital");
    const collision=makeEnvironmentMap(map).cover;
    for(const spawn of Object.values(map.spawns).flat()){
      expect(insideRegions(spawn[0],spawn[2],map.regions!,1)).toBe(true);
      expect(botPositionEmbedded(collision,spawn)).toBe(false);
    }
    expect(bp.features.filter(f=>f.kind==="platform")).toHaveLength(3);
    expect(bp.features.filter(f=>f.kind==="platform").every(f=>featureBoxes(f).some(c=>c.kind==="stair"))).toBe(true);
    expect(map.environment?.filter(e=>e.type==="jump_pad")).toHaveLength(10);
    expect(map.environment?.filter(e=>e.type==="destructible_wall")).toHaveLength(1);
  });
  test("both ground-level flags can be stolen and delivered at their own bases",()=>{
    const flags=createCtfFlags(id);
    expect(flags.red.pos).toEqual(ctfHome("red",id));
    expect(ctfHome("red",id)[1]).toBeLessThan(1);
    expect(ctfTouch(flags,{id:"b",team:"blue",pos:ctfHome("red",id)},id)).toEqual({kind:"pickup",flag:"red"});
    expect(ctfTouch(flags,{id:"b",team:"blue",pos:ctfBase("blue",id)},id)).toEqual({kind:"capture",flag:"red"});
    expect(flags.red.pos).toEqual(ctfHome("red",id));
    expect(ctfTouch(flags,{id:"r",team:"red",pos:ctfHome("blue",id)},id)).toEqual({kind:"pickup",flag:"blue"});
    expect(ctfTouch(flags,{id:"r",team:"red",pos:ctfBase("red",id)},id)).toEqual({kind:"capture",flag:"blue"});
  });
  test("dropped flags and bots stay on the station, never forest-tree coordinates",()=>{
    const flags=createCtfFlags(id);
    flags.red={team:"red",pos:[0,0,8],carrierId:null,dropped:true,droppedAt:200};
    expect(ctfReturnExpired(flags,31000,30000,id)).toEqual(["red"]);
    expect(flags.red.pos).toEqual(ctfHome("red",id));
    expect(ctfStairWaypoint(ctfHome("blue",id),[-30,0,0],id)).toEqual(ctfHome("blue",id));
    expect(ctfBotIntent(flags,"red","bot1",[-60,0,28],"rifle_ar",[],{},id).goal[1]).toBe(0);
  });
});

import {ORBITAL_REAPER_ID,ORBITAL_KILLS_REQUIRED,orbitalRecordKill,orbitalCanClaim,orbitalGravity} from "../src/lib/orbital-reactor";
import {WEAPONS,weaponById} from "../src/lib/game-data";
describe("Orbital Nexus reactor",()=>{
 test("nearby eliminations charge to five and only a living deck player can claim",()=>{
  let n=0;for(let i=0;i<8;i++)n=orbitalRecordKill(n,[2,0,5],"orbital_nexus");
  expect(n).toBe(ORBITAL_KILLS_REQUIRED);
  expect(orbitalRecordKill(0,[40,0,0],"orbital_nexus")).toBe(0);
  expect(orbitalRecordKill(0,[0,0,0],"forest_warfare")).toBe(0);
  expect(orbitalCanClaim(n,[0,0,0],"orbital_nexus",true)).toBe(false);
  expect(orbitalCanClaim(n,[0,3.2,0],"orbital_nexus",false)).toBe(false);
  expect(orbitalCanClaim(n,[0,3.2,0],"orbital_nexus",true)).toBe(true);
 });
 test("new pads, gravity and transient weapon do not alter other maps or permanent catalog",()=>{
  expect(MAP_BLUEPRINTS.maps.orbital_nexus.hazards?.filter(h=>h.type==="jump_pad")).toHaveLength(10);
  expect(orbitalGravity("orbital_nexus")).toBe(.6);
  expect(orbitalGravity("forest_warfare")).toBe(1);
  expect(weaponById(ORBITAL_REAPER_ID).stats.damage).toBe(120);
  expect(WEAPONS.some(w=>w.id===ORBITAL_REAPER_ID)).toBe(false);
 });
});
