import {describe,expect,test} from "bun:test";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";
import {validateBlueprint} from "../src/lib/map-blueprints";
import {compileMapStudioDraft,getMap,mapAllowedForMode} from "../src/lib/game-protocol";
import {importMapDocuments} from "../src/lib/map-document-io";
import {supportsMapMode,validateObjectives,reactorObjective,objectiveDistance,type ObjectiveMap,type MapObjective} from "../src/lib/map-objectives";
import {createCtfFlags,ctfHome,ctfBase,ctfTouch,ctfDrop,ctfReturnExpired,ctfStairWaypoint,ctfBotIntent} from "../src/lib/ctf-rules";
import {orbitalCanClaim,orbitalRecordKill,orbitalBotShouldContest,orbitalBotDeckGoal,orbitalGravity,orbitalReaperEquipped,ORBITAL_REAPER_ID} from "../src/lib/orbital-reactor";

function draft(){
  const doc=structuredClone(MAP_DOCUMENTS.compound);
  doc.id="objective_test";
  doc.blueprint.modes=["ctf","tdm"];
  doc.blueprint.objectives=[
    {id:"red_flag",kind:"flag",team:"red",pos:[-25,.2,5],radius:1,verticalTolerance:1},
    {id:"blue_flag",kind:"flag",team:"blue",pos:[25,.2,-5],radius:1,verticalTolerance:1},
    {id:"red_base",kind:"capture_zone",team:"red",pos:[-30,0,5],radius:2,verticalTolerance:1},
    {id:"blue_base",kind:"capture_zone",team:"blue",pos:[30,0,-5],radius:2,verticalTolerance:1},
    {id:"reactor",kind:"reactor",pos:[15,5,-10],radius:2,verticalTolerance:1,chargeRadius:6,killsRequired:3,approaches:[[15,0,-20],[15,0,0]]},
  ];
  return doc;
}
const compile=(doc= draft())=>compileMapStudioDraft(doc.id,doc.blueprint,doc.theme);

describe("map-defined objective contracts",()=>{
  test("a new map ID compiles CTF and reactor data without map-name rules or catalog mutations",()=>{
    const original=JSON.stringify(getMap("compound")),doc=draft(),map=compile(doc);
    expect(validateMapDocument(doc)).toEqual([]);
    expect(validateBlueprint(doc.blueprint)).toEqual([]);
    expect(map.objectives).toEqual(doc.blueprint.objectives);
    expect(map.objectives).not.toBe(doc.blueprint.objectives);
    expect(supportsMapMode(map,"ctf")).toBe(true);
    expect(supportsMapMode(map,"ffa")).toBe(false);
    expect(supportsMapMode(map,"future_mode" as never)).toBe(false);
    expect(mapAllowedForMode("ctf","unknown_map")).toBe(false);
    expect(JSON.stringify(getMap("compound"))).toBe(original);
  });
  test("CTF pickup, capture and vertical checks use authored zones",()=>{
    const map=compile(),flags=createCtfFlags(map);
    expect(ctfHome("blue",map)).toEqual([25,.2,-5]);
    expect(ctfBase("red",map)).toEqual([-30,0,5]);
    expect(ctfTouch(flags,{id:"r",team:"red",pos:[26.1,.2,-5]},map)).toBeNull();
    expect(ctfTouch(flags,{id:"r",team:"red",pos:[25,1.3,-5]},map)).toBeNull();
    expect(ctfTouch(flags,{id:"r",team:"red",pos:[25,.2,-5]},map)?.kind).toBe("pickup");
    expect(ctfTouch(flags,{id:"r",team:"red",pos:[-32.1,0,5]},map)).toBeNull();
    expect(ctfTouch(flags,{id:"r",team:"red",pos:[-30,1.1,5]},map)).toBeNull();
    expect(ctfTouch(flags,{id:"r",team:"red",pos:[-31.9,0,5]},map)?.kind).toBe("capture");
    expect(flags.blue.pos).toEqual([25,.2,-5]);
  });
  test("dropped flag contact and timeout both return to the authored home",()=>{
    const map=compile(),flags=createCtfFlags(map);
    ctfTouch(flags,{id:"r",team:"red",pos:ctfHome("blue",map)},map);
    ctfDrop(flags,"r",[2,0,2],100);
    expect(ctfTouch(flags,{id:"b",team:"blue",pos:[3.1,0,2]},map)).toBeNull();
    expect(ctfTouch(flags,{id:"b",team:"blue",pos:[2,0,2]},map)?.kind).toBe("return");
    ctfTouch(flags,{id:"r",team:"red",pos:ctfHome("blue",map)},map);
    ctfDrop(flags,"r",[2,0,2],100);
    expect(ctfReturnExpired(flags,1100,1000,map)).toEqual(["blue"]);
    expect(flags.blue.pos).toEqual(ctfHome("blue",map));
  });
  test("reactor charges near its relocated center, caps at configured kills and claims at configured height",()=>{
    const map=compile();
    expect(orbitalRecordKill(0,[0,0,0],map)).toBe(0);
    expect(orbitalRecordKill(0,[15,100,-10],map)).toBe(1);
    expect(orbitalRecordKill(2,[90,0,90],map,[15,0,-10])).toBe(3);
    expect(orbitalRecordKill(3,[15,0,-10],map)).toBe(3);
    expect(orbitalRecordKill(0,[NaN,0,0],map)).toBe(0);
    expect(orbitalCanClaim(2,[15,5,-10],map,true)).toBe(false);
    expect(orbitalCanClaim(3,[15,5,-10],map,false)).toBe(false);
    expect(orbitalCanClaim(3,[17.1,5,-10],map,true)).toBe(false);
    expect(orbitalCanClaim(3,[15,6.1,-10],map,true)).toBe(false);
    expect(orbitalCanClaim(3,[15,4.3,-10],map,true)).toBe(false);
    expect(orbitalCanClaim(3,[15,5,-10],map,true)).toBe(true);
    expect(orbitalReaperEquipped(map,ORBITAL_REAPER_ID)).toBe(true);
  });
  test("bot arbitration and stair entrances use relocated objective data",()=>{
    const map=compile();
    const near={id:"near",team:"red",pos:[16,0,-10] as [number,number,number],alive:true};
    const origin={id:"origin",team:"red",pos:[0,0,0] as [number,number,number],alive:true};
    expect(orbitalBotShouldContest(map,3,near,[near,origin],100)).toBe(true);
    expect(orbitalBotShouldContest(map,3,origin,[near,origin],100)).toBe(false);
    expect(orbitalBotShouldContest(map,3,{...near,carryingFlag:true},[near,origin],100)).toBe(false);
    expect(orbitalBotDeckGoal([15,0,-30],"red",map)).toEqual([15,0,-20]);
    expect(orbitalBotDeckGoal([15,0,-20],"red",map)).toEqual([15,5,-10]);
    expect(objectiveDistance(map,near.pos)).toBe(1);
    const blue=map.objectives!.find(o=>o.id==="blue_flag")!;
    blue.pos=[25,5,-5];blue.approaches=[[25,0,-15]];
    const flags=createCtfFlags(map);
    expect(ctfStairWaypoint(ctfBotIntent(flags,"red","attacker",[-20,0,0],"rifle_ar",[],{},map).goal,[-20,0,0],map)).toEqual([25,0,-15]);
  });
  test("removing objectives explicitly disables mechanics and does not restore legacy orbital defaults",()=>{
    const doc=structuredClone(MAP_DOCUMENTS.orbital_nexus);
    doc.blueprint.objectives=[];doc.blueprint.modes=["ffa"];
    const map=compile(doc);
    expect(reactorObjective(map)).toBeUndefined();
    expect(supportsMapMode(map,"ctf")).toBe(false);
    expect(orbitalRecordKill(0,[0,0,0],map)).toBe(0);
    expect(orbitalCanClaim(10,[0,3.2,0],map,true)).toBe(false);
    expect(orbitalReaperEquipped(map,ORBITAL_REAPER_ID)).toBe(false);
  });
  test("gravity is an independent map setting, with reward effects only while equipped",()=>{
    const map=compile();map.gravityScale=.8;
    expect(orbitalGravity(map)).toBe(.8);
    expect(orbitalGravity(map,ORBITAL_REAPER_ID)).toBeCloseTo(.56);
    map.objectives=[];
    expect(orbitalGravity(map,ORBITAL_REAPER_ID)).toBe(.8);
  });
  test("roundtrips objectives and mode settings, upgrades old saves without overwriting explicit removals",()=>{
    const doc=draft();
    const imported=importMapDocuments(JSON.parse(JSON.stringify(doc)),MAP_DOCUMENTS,"compound").documents[doc.id];
    expect(imported.blueprint.objectives).toEqual(doc.blueprint.objectives);
    expect(imported.blueprint.modes).toEqual(["ctf","tdm"]);
    const old=structuredClone(MAP_DOCUMENTS.orbital_nexus);delete old.blueprint.objectives;delete old.blueprint.modes;
    const migrated=importMapDocuments(old,MAP_DOCUMENTS,old.id).documents[old.id];
    expect(migrated.blueprint.objectives).toHaveLength(5);
    old.blueprint.objectives=[];old.blueprint.modes=["ffa"];
    expect(importMapDocuments(old,MAP_DOCUMENTS,old.id).documents[old.id].blueprint.objectives).toEqual([]);
  });
  test("rejects duplicate roles, missing mode requirements and unknown executable kinds",()=>{
    const doc=draft();doc.blueprint.objectives!.push({...doc.blueprint.objectives![0],id:"other_flag"});
    expect(validateBlueprint(doc.blueprint).some(e=>e.includes("duplicates an objective role"))).toBe(true);
    doc.blueprint.objectives=doc.blueprint.objectives!.filter(o=>o.kind!=="flag");
    expect(validateBlueprint(doc.blueprint).some(e=>e.includes("ctf requires red flag"))).toBe(true);
    doc.blueprint.objectives=[{id:"script",kind:"eval",pos:[0,0,0]} as unknown as MapObjective];
    expect(()=>importMapDocuments(doc,MAP_DOCUMENTS,"compound")).toThrow("unsupported kind");
  });
  test("malformed JSON returns errors instead of crashing; out-of-region points and unsafe tuning fail",()=>{
    for(const invalid of [null,{},[1,2],{kind:"flag",pos:[1,2]},{kind:"reactor",id:"r",pos:[0,0,0],radius:-1,killsRequired:1.5,chargeRadius:Infinity}]){
      expect(validateObjectives({objectives:invalid===null?null:[invalid]} as unknown as ObjectiveMap).length).toBeGreaterThan(0);
    }
    const doc=draft();doc.blueprint.objectives![0].pos=[99999,0,0];
    doc.blueprint.gravityScale=0;
    expect(validateBlueprint(doc.blueprint).some(e=>e.includes("inside walkable"))).toBe(true);
    expect(validateBlueprint(doc.blueprint).some(e=>e.includes("Gravity"))).toBe(true);
  });
  test("published and offline map compilation agree, including native forest and orbital defaults",()=>{
    for(const id of ["orbital_nexus","compound"]){
      const doc=MAP_DOCUMENTS[id],map=compile(doc),published=getMap(id);
      expect(map.objectives).toEqual(published.objectives);
      expect(map.modes).toEqual(published.modes);
    }
    const forest=getMap("forest_warfare");
    expect(validateObjectives(forest)).toEqual([]);
    expect(createCtfFlags(forest)).toEqual(createCtfFlags("forest_warfare"));
    expect(ctfBase("red",forest)).toEqual([-107,0,0]);
  });
});

import * as THREE from "three";
import {FPSEngine} from "../src/lib/fps-engine";
/** Exercise real engine methods without constructing WebGL/audio/network surfaces. */
function engineHarness(){
  const engine=Object.create(FPSEngine.prototype) as {
    map:ReturnType<typeof compile>;opts:{mode:string;online:boolean};scene:THREE.Scene;
    ctfMarkers:Record<string,THREE.Mesh>;orbitalRings:THREE.Mesh[];orbitalCore:THREE.Mesh;
    orbitalCharge:number;preMatchCountdown:number;orbitalWeaponActive:boolean;alive:boolean;
    selfId:string;pos:THREE.Vector3;combatants:Map<string,unknown>;orbitalBotHolders:Map<string,string>;
    buildObjectiveMarkers:()=>void;buildOrbitalScenery:()=>void;tickOrbitalPickup:()=>void;
    grantOrbitalReaper:(active:boolean)=>void;
  };
  Object.assign(engine,{map:compile(),opts:{mode:"ctf",online:false},scene:new THREE.Scene(),ctfMarkers:{},orbitalRings:[]});
  return engine;
}
describe("objective rendering and offline engine integration",()=>{
  test("visible capture rings match authored positions, heights and trigger radii",()=>{
    const engine=engineHarness();
    engine.map.objectives![2].pos=[-30,4,5];
    engine.buildObjectiveMarkers();
    const red=engine.ctfMarkers.red;
    expect(red.position.toArray()).toEqual([-30,4.07,5]);
    expect((red.geometry as THREE.RingGeometry).parameters.outerRadius).toBe(2);
    expect(engine.ctfMarkers.blue.position.toArray()).toEqual([30,.07,-5]);
    expect(engine.scene.children).toHaveLength(2);
  });
  test("reactor core and containment rings move with authored objective, without importing orbital sky",()=>{
    const engine=engineHarness();engine.buildOrbitalScenery();
    expect(engine.orbitalCore.position.toArray()).toEqual([15,12.8,-10]);
    expect(engine.orbitalRings).toHaveLength(3);
    for(const ring of engine.orbitalRings){expect(ring.position.x).toBe(15);expect(ring.position.z).toBe(-10);}
    // Core, three containment rings and beam; no planet or stars on other maps.
    expect(engine.scene.children).toHaveLength(5);
  });
  test("offline pickup resolves at custom position/threshold once, with no reward at world origin",()=>{
    const engine=engineHarness();let grants=0;
    Object.assign(engine,{orbitalCharge:3,preMatchCountdown:0,orbitalWeaponActive:false,alive:true,
      selfId:"creator",pos:new THREE.Vector3(0,5,0),combatants:new Map(),orbitalBotHolders:new Map(),
      grantOrbitalReaper:(active:boolean)=>{if(active)grants++;}});
    engine.tickOrbitalPickup();expect(grants).toBe(0);
    engine.pos.set(15,5,-10);engine.tickOrbitalPickup();
    expect(grants).toBe(1);expect(engine.orbitalCharge).toBe(0);
    engine.tickOrbitalPickup();expect(grants).toBe(1);
  });
});

describe("dev synchronization and Floodgate editor support",()=>{
  test("Floodgate draft preserves geometry, purge hazards and mode availability",()=>{
    const doc=MAP_DOCUMENTS.floodgate;
    expect(validateMapDocument(doc)).toEqual([]);
    expect(validateBlueprint(doc.blueprint)).toEqual([]);
    const draft=compileMapStudioDraft(doc.id,doc.blueprint,doc.theme,"ctf"),live=getMap("floodgate","ctf");
    expect(draft.cover).toEqual(live.cover);expect(draft.environment).toEqual(live.environment);
    expect(draft.spawns).toEqual(live.spawns);expect(draft.objectives).toEqual(live.objectives);
    expect(draft.environment!.filter(o=>o.type==="spikes"&&o.visual==="steam")).toHaveLength(4);
    for(const m of ["ctf","tdm","killconfirmed"] as const)expect(supportsMapMode(draft,m)).toBe(true);
    expect(supportsMapMode(draft,"ffa")).toBe(false);
    expect(createCtfFlags(draft)).toEqual(createCtfFlags("floodgate"));
    const imported=importMapDocuments(JSON.parse(JSON.stringify(doc)),MAP_DOCUMENTS,doc.id).documents[doc.id];
    expect(imported).toEqual(doc);
  });
  test("CTF trial draft edits its own spawn pools and flags without affecting TDM or published data",()=>{
    for(const id of ["compound","skybridge"]){
      const doc=structuredClone(MAP_DOCUMENTS[id]);
      const pool=doc.blueprint.modeSpawns!.ctf!;pool.red[0]=[-20,0,30];
      doc.blueprint.objectives!.find(o=>o.kind==="flag"&&"team" in o&&o.team==="blue")!.pos=[25,0,25];
      const preview=compileMapStudioDraft(id,doc.blueprint,doc.theme,"ctf");
      expect(preview.spawns.red[0]).toEqual([-20,0,30]);
      expect(ctfHome("blue",preview)).toEqual([25,0,25]);
      expect(getMap(id,"ctf").spawns.red[0]).not.toEqual([-20,0,30]);
      const normal=compileMapStudioDraft(id,doc.blueprint,doc.theme,"tdm");
      expect(normal.spawns).toEqual(getMap(id,"tdm").spawns);
    }
  });
  test("legacy trial imports retain mode-specific spawn defaults",()=>{
    const doc=structuredClone(MAP_DOCUMENTS.compound);delete doc.blueprint.objectives;delete doc.blueprint.modeSpawns;
    const restored=importMapDocuments(doc,MAP_DOCUMENTS,doc.id).documents[doc.id];
    expect(restored.blueprint.modeSpawns).toEqual(MAP_DOCUMENTS.compound.blueprint.modeSpawns);
  });
});

import {clusterGravity} from "../src/lib/cluster-grenades";
import {MOVEMENT} from "../src/lib/movement-rules";
test("new dev cluster ordnance respects unsaved map gravity independently of the reactor",()=>{
  const map=compile();map.gravityScale=.4;map.objectives=[];
  expect(clusterGravity(map)).toBeCloseTo(MOVEMENT.gravity*.4);
});
