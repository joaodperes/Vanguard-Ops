import {describe,expect,test} from "bun:test";
import {createCtfFlags,ctfBotIntent,ctfDefenderScanYaw,ctfHome} from "../src/lib/ctf-rules";
const squad=Array.from({length:16},(_,i)=>"red-"+String(i).padStart(2,"0"));
const intent=(id:string,now:number)=>ctfBotIntent(createCtfFlags("compound"),"red",id,
  ctfHome("red","compound"),"rifle_ar",squad,{},"compound",now);
describe("CTF active perimeter defense",()=>{
 test("defenders are spread in front of their own flag",()=>{
   const home=ctfHome("red","compound");
   const defenders=[0,4,8,12].map(i=>intent(squad[i],0));
   expect(defenders.every(d=>d.role==="defend_flag")).toBe(true);
   for(const d of defenders){
     expect(Math.hypot(d.goal[0]-home[0],d.goal[2]-home[2])).toBeGreaterThan(7);
     expect(d.goal[0]).toBeGreaterThan(home[0]);
   }
   expect(new Set(defenders.map(d=>d.goal.join(","))).size).toBe(4);
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
 test("forest elevated sentries retain valid deck height",()=>{
   const flags=createCtfFlags("forest_warfare");
   const assigned=ctfBotIntent(flags,"red","guard",ctfHome("red","forest_warfare"),
     "sniper_lr",[],{},"forest_warfare",0);
   expect(assigned.role).toBe("defend_flag");
   expect(assigned.goal[1]).toBeGreaterThan(10);
 });
});