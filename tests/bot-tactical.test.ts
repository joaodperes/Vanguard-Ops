import {describe,expect,test} from "bun:test";
import {EQUIPMENT} from "../src/lib/equipment";
import {botTacticalForArchetype,survivalBotTactical,botTacticalCanUse,planBotTacticalThrow} from "../src/lib/bot-tactical";
import type {BotArchetype} from "../src/lib/bot-archetypes";
describe("bot tactical equipment",()=>{
 test("bot equipment is valid and excludes player-only deployable cover",()=>{
  const known=new Set(EQUIPMENT.map(e=>e.id));
  for(const role of ["rusher","rifleman","marksman","support"] as BotArchetype[]){
    for(let n=0;n<8;n++){
      const selected=botTacticalForArchetype(role,n);
      expect(known.has(selected)).toBe(true);
      expect(selected).not.toBe("cover");
    }
  }
  expect(botTacticalCanUse({
    equipmentId:"cover",distance:8,visible:true,targetProtected:false,
    friendlyAtImpact:false,charges:1,now:10000,readyAt:0,targetAgeMs:1500,
  })).toBe(false);
  expect(planBotTacticalThrow([0,0,0],[0,0,8],"cover",[],"compound")).toBeNull();
 });
 test("Survival bots only roll nonlethal tasers or flashbangs",()=>{
  for(let n=0;n<60;n++)expect(["flashbang","taser"]).toContain(survivalBotTactical(n));
  expect(survivalBotTactical(0)).toBe("flashbang");
  expect(survivalBotTactical(1)).toBe("taser");
 });
 test("no spamming, spawn ambushes, friendly grenades or magic through cover",()=>{
  const baseline={equipmentId:"frag" as const,distance:16,visible:true,targetProtected:false,
    friendlyAtImpact:false,charges:2,now:10000,readyAt:4000,targetAgeMs:1500};
  expect(botTacticalCanUse(baseline)).toBe(true);
  for(const patch of [{charges:0},{visible:false},{targetProtected:true},
    {friendlyAtImpact:true},{now:3000},{targetAgeMs:200},{distance:4}])
   expect(botTacticalCanUse({...baseline,...patch})).toBe(false);
  expect(botTacticalCanUse({...baseline,equipmentId:"mine"})).toBe(false);
  expect(botTacticalCanUse({...baseline,equipmentId:"mine",distance:8,guarding:true})).toBe(true);
 });
 test("grenades are genuine fuse-based throws and respect close self-safety",()=>{
  const a=planBotTacticalThrow([0,0,0],[0,0,20],"frag",[],"compound");
  expect(a).not.toBeNull();
  expect(a!.path.flightMs).toBe(1700);
  expect(a!.path.impact[1]).toBeLessThan(4);
  expect(Math.hypot(a!.path.impact[0],a!.path.impact[2]-20)).toBeLessThan(4.4);
  expect(planBotTacticalThrow([0,0,0],[0,0,2],"frag",[],"compound")).toBeNull();
 });
 test("precision shots cannot be planned through a blocking wall",()=>{
  const wall={pos:[0,1.5,6] as [number,number,number],size:[6,4,.5] as [number,number,number]};
  expect(planBotTacticalThrow([0,0,0],[0,0,12],"knives",[wall],"compound")).toBeNull();
  expect(planBotTacticalThrow([0,0,0],[0,0,12],"knives",[],"compound")).not.toBeNull();
 });
});
