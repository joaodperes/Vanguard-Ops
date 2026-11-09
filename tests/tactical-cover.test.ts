import { describe, expect, test } from "bun:test";
import { blastCanDamage } from "../src/lib/explosion-damage-rules";
import { coverPanels, coverPlacement, coverNextHp, coverExplosionDamage, DEPLOY_COVER_HP } from "../src/lib/deployable-cover";
import { rechargeTactical, spendTactical, TACTICIAN_RECHARGE_MS } from "../src/lib/perks";
import { calculateThrowPath, TACTICAL_KNIFE_RANGE } from "../src/lib/throw-trajectory";
describe("tactical balance",()=>{
 test("self-explosions damage their owner but never teammates",()=>{
  for(const mode of ["tdm","killconfirmed","ctf","survival"]){
   expect(blastCanDamage("owner","red","owner","red",mode)).toBe(true);
   expect(blastCanDamage("owner","red","ally","red",mode)).toBe(false);
   expect(blastCanDamage("owner","red","opponent","blue",mode)).toBe(true);
  }
  expect(blastCanDamage("owner","ffa","other","ffa","ffa")).toBe(true);
 });
 test("shield is fixed, broader than Bulwark and has a real eye-height firing slot",()=>{
  const location=coverPlacement([0,0,0],0,[],50);
  expect(location?.pos).toEqual([0,0,2.9]);
  const box={id:"a",ownerId:"p",ownerTeam:"red",...location!,hp:DEPLOY_COVER_HP,expiresAt:50000};
  const panels=coverPanels(box);
  expect(panels).toHaveLength(4);
  expect(panels.some(p=>p.pos[1]-p.size[1]<=1.6&&p.pos[1]+p.size[1]>=1.6&&
    Math.abs(p.pos[0])<=p.size[0])).toBe(false);
  expect(coverPlacement([0,0,0],0,panels,50)).toBeNull();
  expect(coverNextHp(160,170)).toBe(0);
  expect(coverExplosionDamage(box,box.pos,5,100)).toBe(100);
 });
 test("Tactician regenerates one tactical charge at a time, not other perks",()=>{
  const empty=spendTactical({charges:2,nextAt:0},100,"tactician",2);
  expect(empty).toEqual({charges:1,nextAt:100+TACTICIAN_RECHARGE_MS});
  expect(rechargeTactical(empty,100+TACTICIAN_RECHARGE_MS-1,"tactician",2).charges).toBe(1);
  expect(rechargeTactical(empty,100+TACTICIAN_RECHARGE_MS,"tactician",2).charges).toBe(2);
  expect(rechargeTactical({charges:0,nextAt:100},100+TACTICIAN_RECHARGE_MS,"quickdraw",2).charges).toBe(0);
 });
 test("tactical throwing knife path stops at configured range even with no obstacles",()=>{
  const origin:[number,number,number]=[0,1.6,0];
  const result=calculateThrowPath(origin,[0,0,1],"knives",()=>null);
  expect(TACTICAL_KNIFE_RANGE).toBe(16);
  expect(Math.hypot(result.impact[0]-origin[0],result.impact[1]-origin[1],result.impact[2]-origin[2])).toBeLessThanOrEqual(16.01);
  expect(result.flightMs).toBeLessThan(1000);
 });
});
