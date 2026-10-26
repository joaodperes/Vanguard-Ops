import {describe,expect,test} from "bun:test";
import {WEAPONS} from "../src/lib/game-data";
import {WEAPON_VISUALS} from "../src/lib/weapon-models";
import {selectSmartTarget,selectSmartTargets,SMART_MAX_TAGS,HELLFIRE_BURST_MS,inFlameCone,nearStormLink,sludgeMovementFactor} from "../src/lib/wonder-tech";
const ids=["wonder_deadlock","wonder_hellfire","wonder_stormweaver","wonder_bogfather"];
describe("Novel Wonder families",()=>{
 test("four genuinely distinct kinds with token-only ownership and their own first-person silhouettes",()=>{
  const kinds=new Set<string>();
  for(const id of ids){const w=WEAPONS.find(x=>x.id===id)!;expect(w).toBeDefined();expect(w.wonder).toBeDefined();kinds.add(w.wonder!.kind);expect(w.stats.magSize).toBe(w.wonder!.maxCharges);expect(w.attachments).toEqual([]);expect(w.unlockCost).toBe(0);expect(WEAPON_VISUALS[id]).toBeDefined();}
  expect(kinds.size).toBe(4);
 });
 test("smart-lock respects cover, aim cone, and teams",()=>{
  const enemy={id:"enemy",pos:[1,0,20] as const,alive:true,team:"blue"};
  expect(selectSmartTarget([0,1.6,0],[0,0,1],[enemy],"red",false,60,()=>true)?.id).toBe("enemy");
  expect(selectSmartTarget([0,1.6,0],[0,0,1],[enemy],"red",false,60,()=>false)).toBe(null);
  expect(selectSmartTarget([0,1.6,0],[0,0,1],[enemy],"blue",false,60,()=>true)).toBe(null);
  expect(selectSmartTarget([0,1.6,0],[0,0,-1],[enemy],"red",false,60,()=>true)).toBe(null);
 });
 test("flame cone spreads but does not hit targets behind the shooter",()=>{
  expect(inFlameCone([0,1,0],[0,0,1],[2,1,11])).toBe(true);
  expect(inFlameCone([0,1,0],[0,0,1],[8,1,11])).toBe(false);
  expect(inFlameCone([0,1,0],[0,0,1],[0,1,-3])).toBe(false);
 });
 test("storm link uses finite-width, clamped segment",()=>{
  expect(nearStormLink([0,0,0],[10,0,0],[5,0,1])).toBe(true);
  expect(nearStormLink([0,0,0],[10,0,0],[5,0,5])).toBe(false);
 });
 test("sludge slows only hostile players in unexpired puddles",()=>{
  const pools=[{kind:"sludge",pos:[0,0,0] as const,radius:4,ownerTeam:"red",expiresAt:1000}];
  expect(sludgeMovementFactor([1,0,1],"blue",500,pools)).toBe(.46);
  expect(sludgeMovementFactor([1,0,1],"red",500,pools)).toBe(1);
  expect(sludgeMovementFactor([1,0,1],"blue",1100,pools)).toBe(1);
 });
});

describe("persistent smart tags and full fuel bursts",()=>{
 test("Deadlock acquires at most three visible hostiles with no friendly or wall hacks",()=>{
  const candidates=Array.from({length:6},(_,i)=>({id:"e"+i,pos:[i-2,0,20] as const,alive:true,team:"blue"}));
  const tags=selectSmartTargets([0,1.6,0],[0,0,1],candidates,"red",false,75,()=>true);
  expect(tags).toHaveLength(SMART_MAX_TAGS);
  expect(new Set(tags.map(x=>x.id)).size).toBe(SMART_MAX_TAGS);
  expect(selectSmartTargets([0,1.6,0],[0,0,1],candidates,"red",false,75,()=>false)).toEqual([]);
 });
 test("Hellfire consumes three seconds per ignition, never permits a partial burst",()=>{
  expect(HELLFIRE_BURST_MS).toBe(3000);
  const fuel=WEAPONS.find(w=>w.id==="wonder_hellfire")!;
  expect(fuel.wonder?.maxCharges).toBe(3);
  expect(fuel.stats.magSize).toBe(3);
  expect(fuel.stats.range).toBe(11);
 });
 test("Bogfather remains in historical IDs but is unavailable",()=>{
  expect(WEAPONS.find(w=>w.id==="wonder_bogfather")?.disabled).toBe(true);
 });
});

import { fullWonderCharges, spendFullWonderCharge, tickWonderCharges } from "../src/lib/wonder-charge";
import { SIGHT_DEFS, hasMountedSight, weaponById } from "../src/lib/game-data";
describe("three-second fuel consumption and sight defaults",()=>{
 test("flame ignition spends all three seconds; partial fuel cannot restart",()=>{
  const rules=weaponById("wonder_hellfire").wonder!;
  const empty=spendFullWonderCharge(fullWonderCharges(rules),rules,1000)!;
  expect(empty.charges).toBe(0);
  expect(spendFullWonderCharge(tickWonderCharges(empty,rules,10000),rules,10000)).toBeNull();
  expect(tickWonderCharges(empty,rules,28000).charges).toBe(3);
  expect(spendFullWonderCharge(empty,rules,28000)?.charges).toBe(0);
 });
 test("regular rifles and SMGs have unmagnified iron sight defaults",()=>{
  for(const id of ["rifle_ar","smg_kp","dmr_scout","lmg_light"]){
    const w=weaponById(id);
    expect(w.baseSightType??"iron").toBe("iron");
    expect(SIGHT_DEFS.iron.zoom).toBe(1);
    expect(hasMountedSight(w,{sight:null})).toBe(false);
  }
 });
 test("wonder descriptions avoid redundant prefix and storm is longer ranged",()=>{
  for(const w of WEAPONS.filter(w=>w.wonder))expect(w.description.startsWith("Wonder Weapon:")).toBe(false);
  const storm=weaponById("wonder_stormweaver");
  expect(storm.stats.range).toBe(82);
  expect(storm.wonder!.radius).toBe(19);
 });
});

import { resolveLoadout } from "../src/lib/game-data";
test("retired Wonder IDs fall back to valid profile weapons without erasing IDs",()=>{
  const kit=resolveLoadout({primaryWeapon:"wonder_bogfather",secondaryWeapon:"pistol_side",
    meleeWeapon:"knife_tactical",weaponSkin:"default",playerSkin:"default",
    attachments:{sight:null,barrel:null,grip:null,magazine:null}});
  expect(kit.weapon.id).toBe("rifle_ar");
  expect(WEAPONS.some(w=>w.id==="wonder_bogfather")).toBe(true);
});
