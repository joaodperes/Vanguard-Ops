import {describe,expect,test} from "bun:test";
import {WEAPONS} from "../src/lib/game-data";
import {botCombatDecision,botPatrolSprint} from "../src/lib/bot-combat-posture";
import {botArchetypeForSlot,botArchetypeForCategory,botArchetypeWeapon,botArchetypeDistanceScale,botPersonality} from "../src/lib/bot-archetypes";

describe("bot archetypes",()=>{
 test("balanced full squad",()=>{
   const roles=Array.from({length:16},(_,i)=>botArchetypeForSlot(i));
   for(const role of ["rusher","rifleman","marksman","support"])
     expect(roles.filter(r=>r===role)).toHaveLength(4);
 });
 test("archetype weapon pools contain real equipment",()=>{
   for(const role of ["rusher","rifleman","marksman","support"] as const)
     for(let i=0;i<8;i++)
       expect(WEAPONS.some(w=>w.id===botArchetypeWeapon(role,i))).toBe(true);
 });
 test("random survival weapons derive suitable personality",()=>{
   expect(botArchetypeForCategory("smg")).toBe("rusher");
   expect(botArchetypeForCategory("dmr")).toBe("marksman");
   expect(botArchetypeForCategory("lmg")).toBe("support");
 });
 test("forced Gun Game weapon overrides mismatched distance style",()=>{
   expect(botArchetypeDistanceScale("rusher","sniper")).toBe(1);
   expect(botArchetypeDistanceScale("marksman","shotgun")).toBe(1);
 });
 test("positioning and patrol sprint reflect personalities without changing difficulty",()=>{
   const rush=botCombatDecision("smg",25,true,true,true,true,false,"normal","rusher");
   const normal=botCombatDecision("smg",25,true,true,true,true,false,"normal","rifleman");
   expect(rush.idealDistance).toBeLessThan(normal.idealDistance);
   expect(botPatrolSprint(7,"normal","rusher")).toBe(true);
   expect(botPatrolSprint(7,"normal","marksman")).toBe(false);
   expect(botPatrolSprint(40,"easy","rusher")).toBe(false);
   expect(botPersonality("marksman").idleAds).toBe(true);
 });
});