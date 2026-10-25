import {describe,expect,test} from "bun:test";
import {WEAPONS} from "../src/lib/game-data";
import {WEAPON_VISUALS} from "../src/lib/weapon-models";
import {selectSmartTarget,inFlameCone,nearStormLink,sludgeMovementFactor} from "../src/lib/wonder-tech";
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
