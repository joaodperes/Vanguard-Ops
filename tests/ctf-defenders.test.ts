import {describe,expect,test} from "bun:test";
import {createCtfFlags,ctfBotIntent,ctfDefenderScanYaw,ctfHome} from "../src/lib/ctf-rules";
const squad=Array.from({length:16},(_,i)=>"red-"+String(i).padStart(2,"0"));
const intent=(id:string,now:number)=>ctfBotIntent(createCtfFlags("compound"),"red",id,
  ctfHome("red","compound"),"rifle_ar",squad,{},"compound",now);
describe("CTF active perimeter defense",()=>{
 test("defenders are spread in front of their own flag",()=>{
   const home=ctfHome("red","compound");
   const intents=squad.map(id=>intent(id,0));
   const defenders=intents.filter(d=>d.role==="defend_flag");
   // Test coverage and distinct safe positions, not particular roster indices
   // or a fixed number of defenders: the AI can tune the split over time.
   expect(defenders.length).toBeGreaterThan(0);
   expect(defenders.length).toBeLessThan(squad.length);
   for(const d of defenders){
     expect(Math.hypot(d.goal[0]-home[0],d.goal[2]-home[2])).toBeGreaterThan(7);
     expect(d.goal[0]).toBeGreaterThan(home[0]);
   }
   expect(new Set(defenders.map(d=>d.goal.join(","))).size).toBe(defenders.length);
 });
 test("perimeter stations change with time",()=>{
   expect(intent(squad[0],0).goal).not.toEqual(intent(squad[0],19000).goal);
 });
 test("idle guard scanning faces the incoming approach",()=>{
   const red=ctfHome("red","compound"),blue=ctfHome("blue","compound");
   const yaw=ctfDefenderScanYaw("red",red,"guard","compound",12345);
   const direct=Math.atan2(blue[0]-red[0],blue[2]-red[2]);
   expect(Math.abs(Math.atan2(Math.sin(yaw-direct),Math.cos(yaw-direct)))).toBeLessThan(.44);
 });
 test("stolen flag overrides defender's fixed role",()=>{
   const flags=createCtfFlags("compound");
   flags.red.carrierId="enemy";
   expect(ctfBotIntent(flags,"red",squad[0],ctfHome("red","compound"),"rifle_ar",squad,
     {enemy:[12,0,5]},"compound",0).role).toBe("recover");
 });
 test("forest defenders use reachable approach points rather than requiring a fixed sniper perch",()=>{
   const flags=createCtfFlags("forest_warfare");
   const intents=squad.map(id=>ctfBotIntent(flags,"red",id,ctfHome("red","forest_warfare"),
     "sniper_lr",squad,{},"forest_warfare",0));
   const guards=intents.filter(d=>d.role==="defend_stairs"||d.role==="defend_flag");
   expect(guards.length).toBeGreaterThan(0);
   expect(guards.length).toBeLessThan(squad.length);
   expect(guards.every(d=>d.goal.every(Number.isFinite))).toBe(true);
   // The forest's stair guards take ground-level approach positions.
   for(const guard of guards.filter(d=>d.role==="defend_stairs"))expect(guard.goal[1]).toBe(0);
 });
});