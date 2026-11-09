import { describe, expect, test } from "bun:test";
import { blastCanDamage } from "../src/lib/explosion-damage-rules";
import { launcherSplashFactor, launcherBlastVisibilityOrigin } from "../src/lib/launcher-effects";
import { rayBox, type CoverBox, type Vec3 } from "../src/lib/game-protocol";
import { fullThrowingKnives, spendThrowingKnife, tickThrowingKnives, THROWING_KNIFE_MAX_CHARGES, THROWING_KNIFE_RANGE } from "../src/lib/throwing-knives";
import { coverPanels, coverPlacement, coverNextHp, coverExplosionDamage, DEPLOY_COVER_HP } from "../src/lib/deployable-cover";
import { rechargeTactical, spendTactical, TACTICIAN_RECHARGE_MS } from "../src/lib/perks";
import { calculateThrowPath, TACTICAL_KNIFE_RANGE } from "../src/lib/throw-trajectory";
describe("tactical balance",()=>{
 test("RL-7 wall-impact splash can hit its owner without passing through the wall",()=>{
  // Wall's front face is z=1, exactly where the rocket explodes.
  const wall:CoverBox={pos:[0,1.2,1.2],size:[2,1.2,.2],kind:"solid"};
  const impact:Vec3=[0,1.6,1];
  const muzzle:Vec3=[0,1.6,0];
  const owner:Vec3=[0,.9,0];
  const enemyBehindWall:Vec3=[0,.9,1.6];
  const unobstructed=(from:Vec3,to:Vec3,boxes:CoverBox[])=>{
    const diff:Vec3=[to[0]-from[0],to[1]-from[1],to[2]-from[2]];
    const len=Math.hypot(...diff),dir:Vec3=[diff[0]/len,diff[1]/len,diff[2]/len];
    return boxes.every(b=>{
      const t=rayBox(from,dir,b.pos,b.size);
      return t===null || t>=len;
    });
  };
  // Regression: the old unshifted origin was erroneously treated as blocked at t=0.
  expect(unobstructed(impact,owner,[wall])).toBe(false);
  const losOrigin=launcherBlastVisibilityOrigin(impact,muzzle);
  expect(losOrigin[2]).toBeLessThan(impact[2]);
  expect(unobstructed(losOrigin,owner,[wall])).toBe(true);
  // The same collider must still protect a target on the far side.
  expect(unobstructed(losOrigin,enemyBehindWall,[wall])).toBe(false);
  // Other cover between the blast and shooter remains protective.
  const middleWall:CoverBox={pos:[0,1,.45],size:[2,1,.08],kind:"solid"};
  expect(unobstructed(losOrigin,owner,[wall,middleWall])).toBe(false);
  // One metre from the wall is within the RL-7's deliberately tight 1.9m blast.
  const d=Math.hypot(owner[0]-impact[0],owner[1]-impact[1],owner[2]-impact[2]);
  expect(d).toBeLessThan(1.9);
  expect(176*launcherSplashFactor("launcher_rocket",d,1.9)).toBeGreaterThan(0);
  expect(launcherSplashFactor("launcher_rocket",2,1.9)).toBe(0);
 });
 test("throwing melee knife: 1 per life, shorter range, timed Gun Game refill",()=>{
  expect(THROWING_KNIFE_MAX_CHARGES).toBe(1);
  expect(THROWING_KNIFE_RANGE).toBe(5.5);
  const life=spendThrowingKnife(fullThrowingKnives(),1000,false)!;
  expect(life.charges).toBe(0);
  expect(tickThrowingKnives(life,100_000,false).charges).toBe(0);
  const gunGame=spendThrowingKnife(fullThrowingKnives(),1000,true)!;
  expect(tickThrowingKnives(gunGame,gunGame.nextAt,true).charges).toBe(1);
 });
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
