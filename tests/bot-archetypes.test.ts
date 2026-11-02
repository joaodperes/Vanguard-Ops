import {describe,expect,test} from "bun:test";
import {WEAPONS} from "../src/lib/game-data";
import {botCombatDecision,botPatrolSprint} from "../src/lib/bot-combat-posture";
import {botArchetypeForSlot,botArchetypeForCategory,botArchetypeWeapon,botArchetypeWeapons,BOT_ELIGIBLE_WEAPONS,botArchetypeDistanceScale,botPersonality} from "../src/lib/bot-archetypes";

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
 test("all and only supported conventional ranged weapons have bot access",()=>{
   const allowed=WEAPONS.filter(w=>!w.disabled&&!w.wonder&&!w.special&&w.category!=="launcher"&&w.category!=="melee");
   expect(BOT_ELIGIBLE_WEAPONS.map(w=>w.id).sort()).toEqual(allowed.map(w=>w.id).sort());
   expect(allowed.length).toBe(30);
   const used=new Set(["rusher","rifleman","marksman","support"].flatMap(
     role=>botArchetypeWeapons(role as "rusher"|"rifleman"|"marksman"|"support")));
   expect([...used].sort()).toEqual(allowed.map(w=>w.id).sort());
   for(const id of ["rifle_electron","pistol_arc","crossbow_reclaimer","launcher_rocket","wonder_turret"]){
     expect(used.has(id)).toBe(false);
   }
 });
 test("each archetype can reach every weapon in its weighted pool",()=>{
   for(const role of ["rusher","rifleman","marksman","support"] as const){
     const pool=botArchetypeWeapons(role);
     expect(pool.length).toBeGreaterThan(2);
     expect(Array.from({length:pool.length},(_,i)=>botArchetypeWeapon(role,i))).toEqual(pool);
   }
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