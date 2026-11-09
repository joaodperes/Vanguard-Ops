import { describe, expect, test } from "bun:test";
import { coverPanels, coverPlacement, coverNextHp, coverExplosionDamage, DEPLOY_COVER_HP } from "../src/lib/deployable-cover";
import { rechargeTactical, spendTactical, TACTICIAN_RECHARGE_MS } from "../src/lib/perks";
import { fullThrowingKnives, spendThrowingKnife, tickThrowingKnives, THROWING_KNIFE_MAX_CHARGES, THROWING_KNIFE_RANGE } from "../src/lib/throwing-knives";
describe("tactical balance",()=>{
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
 test("throwing melee knives: one per life, 5.5-unit reach, Gun Game reload only",()=>{
  expect(THROWING_KNIFE_MAX_CHARGES).toBe(1);
  expect(THROWING_KNIFE_RANGE).toBe(5.5);
  const spent=spendThrowingKnife(fullThrowingKnives(),1000,false)!;
  expect(spent.charges).toBe(0);
  expect(tickThrowingKnives(spent,100000,false).charges).toBe(0);
  const gg=spendThrowingKnife(fullThrowingKnives(),1000,true)!;
  expect(tickThrowingKnives(gg,gg.nextAt,true).charges).toBe(1);
 });
});
