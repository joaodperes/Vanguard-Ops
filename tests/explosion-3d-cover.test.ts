import { describe, expect, test } from "bun:test";
import { blastDistance, blastExposureDistance, blastUnobstructed } from "../src/lib/explosion-damage-rules";
import { launcherSplashContact } from "../src/lib/launcher-effects";
import { coverBlastContact, coverExplosionDamage, coverPanels, type DeployedCover } from "../src/lib/deployable-cover";
import { fragDamage, flashDurationMs, mineSplashDamage, MINE_SPLASH_RADIUS } from "../src/lib/tactical-balance";
import { explonandoDamage, EXPLO_RADIUS } from "../src/lib/explonando";
import type { CoverBox, Vec3 } from "../src/lib/game-protocol";
const unobstructed=(boxes:CoverBox[])=>(from:Vec3,to:Vec3)=>blastUnobstructed(from,to,boxes);
const wall:CoverBox={kind:"solid",material:"concrete",pos:[0,1.6,2],size:[3,2,.3]};
const ceiling:CoverBox={kind:"platform",material:"concrete",pos:[0,3,0],size:[5,.2,5]};
const glass:CoverBox={kind:"cover",material:"glass",ballisticId:"pane",pos:[0,1.6,2],size:[3,2,.1]};
describe("spherical explosives and blast obstruction",()=>{
 test("frag, flash, mines, and death charges taper vertically and stop at their radius",()=>{
   const origin:Vec3=[0,0,0];
   expect(blastDistance(origin,[0,5,0])).toBe(5);
   const frag=blastExposureDistance(origin,[0,5,0],12,unobstructed([]));
   expect(frag).toBe(5);
   expect(fragDamage(frag!)).toBeLessThan(fragDamage(0));
   expect(blastExposureDistance(origin,[0,13,0],12,unobstructed([]))).toBeNull();
   expect(blastExposureDistance(origin,[0,13,0],14,unobstructed([]))).toBe(13);
   expect(flashDurationMs(13)).toBeLessThan(flashDurationMs(5));
   expect(blastExposureDistance(origin,[0,15,0],14,unobstructed([]))).toBeNull();
   expect(blastExposureDistance(origin,[0,3,0],MINE_SPLASH_RADIUS,unobstructed([]))).toBeNull();
   expect(mineSplashDamage(3)).toBe(0);
   expect(blastExposureDistance(origin,[0,7,0],EXPLO_RADIUS,unobstructed([]))).toBeNull();
   expect(explonandoDamage(3)).toBeLessThan(explonandoDamage(0));
 });
 test("solid walls, ceilings and floors protect targets despite horizontal proximity",()=>{
   const from:Vec3=[0,1,0],behind:Vec3=[0,1,4];
   expect(blastExposureDistance(from,behind,10,unobstructed([]))).not.toBeNull();
   expect(blastExposureDistance(from,behind,10,unobstructed([wall]))).toBeNull();
   expect(blastExposureDistance(from,[0,5,0],10,unobstructed([ceiling]))).toBeNull();
   expect(blastExposureDistance([0,5,0],from,10,unobstructed([ceiling]))).toBeNull();
 });
 test("fragile panels absorb the current blast even if that detonation shatters them",()=>{
   const from:Vec3=[0,1.5,0],target:Vec3=[0,1.5,4];
   expect(blastExposureDistance(from,target,10,unobstructed([glass]))).toBeNull();
   expect(blastExposureDistance(from,target,10,unobstructed([]))).not.toBeNull();
   expect(blastUnobstructed(from,target,[{...glass,kind:"accent"}])).toBe(true);
 });
 test("rocket trajectory near misses remain, but impact walls cannot be bypassed",()=>{
   const start:Vec3=[0,1.5,0],impact:Vec3=[0,1.5,6],near:Vec3=[1,1.5,4],high:Vec3=[0,9,4];
   const exposed=launcherSplashContact(start,impact,near);
   expect(exposed.distance).toBeCloseTo(1);
   expect(blastUnobstructed(exposed.visibilityOrigin,near,[])).toBe(true);
   expect(launcherSplashContact(start,impact,high).distance).toBeGreaterThan(4);
   const stopped=launcherSplashContact(start,[0,1.5,1.7],[0,1.5,2.6]);
   expect(stopped.visibilityOrigin[2]).toBeLessThan(1.7);
   expect(blastUnobstructed(stopped.visibilityOrigin,[0,1.5,2.6],[wall])).toBe(false);
 });
 test("Plagueheart can only poison near the actual impact, not along its flight path",()=>{
   const start:Vec3=[0,1.5,0],impact:Vec3=[0,1.5,20],target:Vec3=[0,1.5,4];
   expect(launcherSplashContact(start,impact,target,false).distance).toBe(0);
   expect(launcherSplashContact(start,impact,target,true).distance).toBe(16);
 });
 test("deployable cover uses panel geometry and protects through other hard walls",()=>{
   const barrier:DeployedCover={id:"shield",ownerId:"a",ownerTeam:"red",yaw:0,pos:[0,0,4],hp:160,expiresAt:1000};
   const close:Vec3=[0,1,3],high:Vec3=[0,14,4];
   expect(coverExplosionDamage(barrier,close,5,100)).toBeGreaterThan(0);
   expect(coverExplosionDamage(barrier,high,5,100)).toBe(0);
   const contact=coverBlastContact(barrier,close);
   expect(blastUnobstructed(close,contact,coverPanels(barrier),"tactical_cover:shield")).toBe(true);
   const between:CoverBox={kind:"solid",pos:[0,1,3.5],size:[2,2,.1]};
   expect(blastUnobstructed(close,contact,[between,...coverPanels(barrier)],"tactical_cover:shield")).toBe(false);
 });
});
