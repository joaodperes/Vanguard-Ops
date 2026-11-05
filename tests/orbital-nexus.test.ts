import {describe,expect,test} from "bun:test";
import {MAP_BLUEPRINTS,insideRegions,validateBlueprint,featureBoxes} from "../src/lib/map-blueprints";
import {getMap,mapAllowedForMode} from "../src/lib/game-protocol";
import {makeEnvironmentMap} from "../src/lib/dynamic-environment";
import {botPositionEmbedded} from "../src/lib/bot-physics";
import {createCtfFlags,ctfHome,ctfBase,ctfTouch,ctfReturnExpired,ctfStairWaypoint,ctfBotIntent} from "../src/lib/ctf-rules";

describe("Orbital Nexus CTF map",()=>{
  const id="orbital_nexus" as const;
  test("supports CTF and team combat with usable geometry and safe spawns",()=>{
    const map=getMap(id),bp=MAP_BLUEPRINTS.maps[id];
    expect(mapAllowedForMode("ctf",id)).toBe(true);
    expect(mapAllowedForMode("tdm",id)).toBe(true);
    expect(validateBlueprint(bp)).toEqual([]);
    expect(map.name).toBe("Orbital Nexus");
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

import {ORBITAL_REAPER_ID,ORBITAL_KILLS_REQUIRED,ORBITAL_CHARGE_RADIUS,ORBITAL_RULES_VERSION,orbitalChargeLabel,orbitalServerWarning,orbitalRecordKill,orbitalCanClaim,orbitalGravity,orbitalPulseTargets,ORBITAL_PULSE_RADIUS,ORBITAL_PULSE_DAMAGE,ORBITAL_REAPER_STAMINA_DRAIN_MULTIPLIER,ORBITAL_REAPER_SPEED_MULTIPLIER,ORBITAL_REAPER_JUMP_MOMENTUM_MULTIPLIER,orbitalReaperEquipped} from "../src/lib/orbital-reactor";
import {WEAPONS,ACHIEVEMENTS,weaponById} from "../src/lib/game-data";
describe("Orbital Nexus reactor",()=>{
 test("stale multiplayer server protocol is unmistakable, never silently 0/5",()=>{
  expect(ORBITAL_RULES_VERSION).toBeGreaterThan(0);
  expect(orbitalServerWarning("orbital_nexus",true,undefined)).toContain("outdated");
  expect(orbitalServerWarning("orbital_nexus",true,ORBITAL_RULES_VERSION-1)).toContain("outdated");
  expect(orbitalServerWarning("orbital_nexus",true,ORBITAL_RULES_VERSION)).toBeUndefined();
  expect(orbitalServerWarning("orbital_nexus",false,undefined)).toBeUndefined();
  expect(orbitalServerWarning("forest_warfare",true,undefined)).toBeUndefined();
 });

 test("enemy kills charge if either combatant is inside the 38-unit radius",()=>{
  expect(ORBITAL_CHARGE_RADIUS).toBe(38);
  // The victim can be outside the zone as long as the killer is on the deck.
  expect(orbitalRecordKill(0,[-86,0,-24],"orbital_nexus",[0,3.2,0])).toBe(1);
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[1,0,4])).toBe(1);
  // Conversely, distant sniper fire still counts when its victim is inside.
  expect(orbitalRecordKill(0,[4,0,0],"orbital_nexus",[85,0,23])).toBe(1);
  expect(orbitalRecordKill(0,[0,0,30],"orbital_nexus",[-80,0,30])).toBe(1);
  // Both fighters outside the radius: no progress.
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[-86,0,-24])).toBe(0);
  expect(orbitalRecordKill(0,[-50,0,-30],"orbital_nexus",[86,0,24])).toBe(0);
  // Boundaries are inclusive, ground and elevated combat both work.
  expect(orbitalRecordKill(0,[38,0,0],"orbital_nexus",[86,0,24])).toBe(1);
  expect(orbitalRecordKill(0,[38.01,0,0],"orbital_nexus",[86,0,24])).toBe(0);
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[0,3.2,0])).toBe(1);
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[0,30,0])).toBe(1);
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[NaN,0,0])).toBe(0);
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[])).toBe(0);
  expect(orbitalRecordKill(0,[0,0,0],"forest_warfare",[0,0,0])).toBe(0);
  expect(orbitalRecordKill(0,[Infinity,0,0],"orbital_nexus",[0,0,0])).toBe(0);
  expect(orbitalRecordKill(0,[0,0],"orbital_nexus",[0,0,0])).toBe(0);
 });
 test("HUD reactor wording shows fully charged when the kill requirement is met",()=>{
  expect(orbitalChargeLabel(0)).toBe("Reactor 0/10");
  expect(orbitalChargeLabel(9)).toBe("Reactor 9/10");
  expect(orbitalChargeLabel(10)).toBe("Reactor fully charged");
  expect(orbitalChargeLabel(11)).toBe("Reactor fully charged");
  expect(orbitalChargeLabel(3,4)).toBe("Reactor 3/4");
  expect(orbitalChargeLabel(4,4)).toBe("Reactor fully charged");
 });
 test("charge always caps at ten and center-platform claim resets it separately",()=>{
  let n=0;
  for(let i=0;i<24;i++)
    n=orbitalRecordKill(n,[86,0,24],"orbital_nexus",[0,3.2,0]);
  expect(n).toBe(ORBITAL_KILLS_REQUIRED);
  // The center platform checks the pickup, not charging eligibility.
  expect(orbitalCanClaim(n,[0,0,0],"orbital_nexus",true)).toBe(false);
  expect(orbitalCanClaim(n,[-86,3.2,0],"orbital_nexus",true)).toBe(false);
  expect(orbitalCanClaim(n,[0,3.2,0],"orbital_nexus",false)).toBe(false);
  expect(orbitalCanClaim(n,[0,3.2,0],"orbital_nexus",true)).toBe(true);
  expect(orbitalRecordKill(0,[86,0,24],"orbital_nexus",[0,3.2,0])).toBe(1);
 });
 test("purple pulse strikes eligible enemies in every direction and obeys cover/protection",()=>{
  const origin=[0,3.2,0],opponents=[
    {id:"front",pos:[0,3.2,3],alive:true},
    {id:"behind",pos:[0,3.2,-4],alive:true},
    {id:"side",pos:[4,3.2,0],alive:true},
    {id:"shielded",pos:[1,3.2,1],alive:true,protected:true},
    {id:"friend",pos:[1,3.2,-1],alive:true,friendly:true},
    {id:"far",pos:[8,3.2,0],alive:true},
    {id:"vertical",pos:[1,7,0],alive:true},
  ];
  expect(ORBITAL_PULSE_RADIUS).toBeGreaterThan(4);
  expect(ORBITAL_PULSE_DAMAGE).toBeGreaterThan(0);
  expect(orbitalPulseTargets(origin,opponents)).toEqual(["front","behind","side"]);
  expect(orbitalPulseTargets(origin,opponents,pos=>pos[0]===4,["front"]))
    .toEqual(["behind"]);
 });
 test("tiered Nexus Reaper kill achievement has a final title",()=>{
  const series=ACHIEVEMENTS.filter(a=>a.metric==="nexus_reaper_kills")
    .sort((a,b)=>(a.goal-b.goal));
  expect(series.map(a=>a.goal)).toEqual([10,35,100]);
  expect(series[2].rewardTitle).toBe("Nexus Reaper");
  expect(series.every(a=>a.category==="pvp")).toBe(true);
 });
 test("new pads, gravity and transient weapon do not alter other maps or permanent catalog",()=>{
  expect(MAP_BLUEPRINTS.maps.orbital_nexus.hazards?.filter(h=>h.type==="jump_pad")).toHaveLength(10);
  expect(orbitalGravity("orbital_nexus")).toBe(.6);
  expect(orbitalGravity("orbital_nexus",ORBITAL_REAPER_ID)).toBeCloseTo(.42);
  expect(orbitalReaperEquipped("orbital_nexus",ORBITAL_REAPER_ID)).toBe(true);
  expect(orbitalReaperEquipped("orbital_nexus","rifle_ar")).toBe(false);
  expect(ORBITAL_REAPER_SPEED_MULTIPLIER).toBeGreaterThan(1);
  expect(ORBITAL_REAPER_STAMINA_DRAIN_MULTIPLIER).toBeLessThan(1);
  expect(ORBITAL_REAPER_JUMP_MOMENTUM_MULTIPLIER).toBeGreaterThan(1);
  expect(getMap("orbital_nexus").wallHeight).toBeGreaterThan(25);
  expect(orbitalGravity("forest_warfare")).toBe(1);
  expect(weaponById(ORBITAL_REAPER_ID).stats.damage).toBe(120);
  expect(weaponById(ORBITAL_REAPER_ID).stats.range).toBe(3.5);
  expect(ORBITAL_KILLS_REQUIRED).toBe(10);
  expect(WEAPONS.some(w=>w.id===ORBITAL_REAPER_ID)).toBe(false);
 });
});

import {orbitalBotShouldContest,orbitalBotDeckGoal} from "../src/lib/orbital-reactor";
describe("Orbital Nexus bot reactor contest arbitration",()=>{
 const bot=(id:string,team:string,x:number,z:number,options:{alive?:boolean;carryingFlag?:boolean;hasReward?:boolean}={})=>({
  id,team,pos:[x,0,z] as [number,number,number],alive:options.alive??true,
  carryingFlag:options.carryingFlag??false,hasReward:options.hasReward??false,
 });
 test("only closest eligible teammate pursues, alongside a rival-team contender",()=>{
  const contenders=[
    bot("red-far","red",-72,25),bot("red-runner","red",-23,-18),
    bot("red-carrier","red",-4,0,{carryingFlag:true}),
    bot("blue-runner","blue",21,18),bot("blue-dead","blue",1,0,{alive:false}),
  ];
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,contenders[1],contenders,25)).toBe(true);
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,contenders[0],contenders,25)).toBe(false);
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,contenders[3],contenders,25)).toBe(true);
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,contenders[2],contenders,25)).toBe(false);
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,contenders[1],contenders,9)).toBe(false);
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED-1,contenders[1],contenders,25)).toBe(false);
  expect(orbitalBotShouldContest("forest_warfare",ORBITAL_KILLS_REQUIRED,contenders[1],contenders,25)).toBe(false);
 });
 test("previous holder can never monopolize a new charge cycle",()=>{
  const bots=[bot("claimed","red",-2,0,{hasReward:true}),bot("new-runner","red",-17,2)];
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,bots[0],bots,Infinity)).toBe(false);
  expect(orbitalBotShouldContest("orbital_nexus",ORBITAL_KILLS_REQUIRED,bots[1],bots,Infinity)).toBe(true);
 });
 test("center approach guides both teams up real stairs, not under the deck",()=>{
  expect(orbitalBotDeckGoal([-70,0,-27],"red")).toEqual([0,0,-13]);
  expect(orbitalBotDeckGoal([60,0,30],"blue")).toEqual([0,0,13]);
  expect(orbitalBotDeckGoal([0,0,-13],"red")).toEqual([0,3.2,0]);
  expect(orbitalBotDeckGoal([.2,3.2,4],"blue")).toEqual([0,3.2,0]);
 });
});
