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
 test("aim error is applied after planning, with larger errors for lower tiers",()=>{
  const owner:[number,number,number]=[0,0,0];
  const target:[number,number,number]=[0,0,12];
  const centered=planBotTacticalThrow(owner,target,"knives",[],"compound","normal",()=>.5);
  expect(centered).not.toBeNull();
  const tiers=["easy","normal","hard","veteran"] as const;
  const plans=tiers.map(tier=>planBotTacticalThrow(owner,target,"knives",[],"compound",tier,()=>.95));
  for(const plan of plans)expect(plan).not.toBeNull();
  const angleError=plans.map(plan=>Math.abs(plan!.yaw-centered!.yaw)+Math.abs(plan!.pitch-centered!.pitch));
  expect(angleError[0]).toBeGreaterThan(angleError[1]);
  expect(angleError[1]).toBeGreaterThan(angleError[2]);
  expect(angleError[2]).toBeGreaterThan(angleError[3]);

  // The same real projectile simulation now misses when an easy bot's
  // inaccurate throw veers off target. A veteran stays close to the target.
  const distanceToTarget=(points:[number,number,number][])=>{
    const targetCenter:[number,number,number]=[0,1,12];
    let distance=Infinity;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const v:[number,number,number]=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
      const length=v[0]*v[0]+v[1]*v[1]+v[2]*v[2]||1;
      const t=Math.max(0,Math.min(1,(
        (targetCenter[0]-a[0])*v[0]+(targetCenter[1]-a[1])*v[1]+
        (targetCenter[2]-a[2])*v[2])/length));
      distance=Math.min(distance,Math.hypot(
        targetCenter[0]-a[0]-v[0]*t,targetCenter[1]-a[1]-v[1]*t,
        targetCenter[2]-a[2]-v[2]*t));
    }
    return distance;
  };
  expect(distanceToTarget(plans[0]!.path.points)).toBeGreaterThan(.82);
  expect(distanceToTarget(plans[3]!.path.points)).toBeLessThan(.82);
 });
 test("grenade spread also scales by tier and uses the scattered physical landing",()=>{
  const owner:[number,number,number]=[0,0,0],target:[number,number,number]=[0,0,20];
  const centered=planBotTacticalThrow(owner,target,"frag",[],"compound","normal",()=>.5);
  const easy=planBotTacticalThrow(owner,target,"frag",[],"compound","easy",()=>.8);
  const veteran=planBotTacticalThrow(owner,target,"frag",[],"compound","veteran",()=>.8);
  expect(centered).not.toBeNull();
  expect(easy).not.toBeNull();
  expect(veteran).not.toBeNull();
  expect(Math.abs(easy!.yaw-centered!.yaw)).toBeGreaterThan(Math.abs(veteran!.yaw-centered!.yaw));
  expect(Math.abs(easy!.path.impact[0]-centered!.path.impact[0])).toBeGreaterThan(
    Math.abs(veteran!.path.impact[0]-centered!.path.impact[0]));
  expect(easy!.path.flightMs).toBe(1700);
  expect(Math.hypot(easy!.path.impact[0]-owner[0],easy!.path.impact[2]-owner[2]))
    .toBeGreaterThanOrEqual(13); // actual scattered grenade must remain safe for its thrower
 });
 test("mine placement is independent of marksmanship",()=>{
  const owner:[number,number,number]=[0,0,0],target:[number,number,number]=[0,0,8];
  const easy=planBotTacticalThrow(owner,target,"mine",[],"compound","easy",()=>0);
  const veteran=planBotTacticalThrow(owner,target,"mine",[],"compound","veteran",()=>1);
  expect(easy).not.toBeNull();
  expect(veteran).toEqual(easy);
 });
});
