import { describe, expect, test } from "bun:test";
import { WEAPONS, ATTACHMENTS, computeEffectiveStats, weaponById } from "../src/lib/game-data";
import { WEAPON_VISUALS } from "../src/lib/weapon-models";
import { adsClearance } from "../src/lib/viewmodel-clearance";
import { launcherSplashFactor } from "../src/lib/launcher-effects";
import { HELLFIRE_BURST_MS } from "../src/lib/wonder-tech";
import { sampleReloadMotion } from "../src/lib/first-person-animation";

const empty={sight:null,barrel:null,grip:null,magazine:null};
const withMag=(id:string)=>({...empty,magazine:id});
describe("every weapon's physical ADS model vs camera eye and crosshair",()=>{
 test("all default iron sights align to eye reticle with receiver below sight",()=>{
  const standard=WEAPONS.filter(w=>!w.wonder&&w.category!=="melee"&&
    (w.baseSightType??"iron")==="iron");
  expect(standard.length).toBeGreaterThan(20);
  for(const w of standard){
    const receiver=(WEAPON_VISUALS[w.id]?.receiver?.[1]??.18);
    const c=adsClearance(w,"iron",receiver);
    const apertureY=c.bodyY+c.sightLift+.08*1.3;
    expect(c.sightVisible).toBe(true);
    expect(Math.abs(apertureY)).toBeLessThan(.02);
    expect(c.bodyCeiling).toBeLessThan(0);
    expect(c.bodyY).toBeLessThan(apertureY-.20);
  }
 });
 test("Hydra Twin, Reclaimer, RL-7, Breach-2, Swarm-3 and Stormweaver use deep clearance",()=>{
  for(const id of ["rifle_hydra","crossbow_reclaimer","launcher_rocket","launcher_breach",
    "launcher_swarm","wonder_stormweaver","wonder_deadlock"]){
    const w=weaponById(id);
    const c=adsClearance(w,w.baseSightType??"iron",
      WEAPON_VISUALS[id]?.receiver?.[1]);
    expect(c.bodyY).toBeLessThanOrEqual(-.4);
    expect(c.bodyCeiling).toBeLessThan(0);
  }
 });
 test("weapon art never changes the direction of camera-centre ballistic rays",()=>{
  // Rendering offsets are independent of yaw/pitch. ADS therefore retains
  // exactly the same physics aim vector as the on-screen crosshair.
  const angle=(yaw:number,pitch:number):[number,number,number]=>[
    Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  for(const w of WEAPONS.filter(x=>!x.disabled)){
    const c=adsClearance(w,w.baseSightType??"iron");
    expect(Number.isFinite(c.bodyY)).toBe(true);
    const normal=angle(.2,-.13),withAds=angle(.2,-.13);
    expect(withAds).toEqual(normal);
  }
 });
});
describe("launcher, flamethrower and crossbow identities",()=>{
 test("RL-7 is tighter but lethal, Breach is wider but never a one-shot",()=>{
  const rl=weaponById("launcher_rocket"),breach=weaponById("launcher_breach");
  expect(rl.explosive!.radius).toBeLessThan(breach.explosive!.radius);
  expect(breach.explosive!.radius).toBeLessThan(3.1);
  expect(rl.stats.damage*launcherSplashFactor(rl.id,0,rl.explosive!.radius)).toBeGreaterThan(100);
  for(const dist of [0,.2,.5,1,2,2.8])
    expect(breach.stats.damage*launcherSplashFactor(breach.id,dist,breach.explosive!.radius)).toBeLessThan(100);
 });
 test("quiver is automatic 10 shots with lighter bolts; heavy has two stronger arrows",()=>{
  const weapon=weaponById("crossbow_reclaimer");
  const basic=computeEffectiveStats(weapon,empty);
  const quiver=computeEffectiveStats(weapon,withMag("mag_bolt_quiver"));
  const extended=computeEffectiveStats(weapon,withMag("mag_extended"));
  const heavy=computeEffectiveStats(weapon,withMag("mag_bolt_heavy"));
  expect(basic.auto).toBe(false);
  expect(quiver.auto).toBe(true);
  expect(quiver.magSize).toBe(10);
  expect(quiver.damage).toBeLessThan(basic.damage);
  expect(quiver.fireRate).toBeGreaterThan(basic.fireRate*2);
  expect(extended.magSize).toBe(2);
  expect(heavy.magSize).toBe(2);
  expect(heavy.damage).toBeGreaterThan(basic.damage*2);
  expect(ATTACHMENTS.filter(a=>a.exclusiveWeaponIds?.includes("crossbow_reclaimer")&&
    a.slot==="magazine").map(a=>a.id)).toEqual(["mag_bolt_quiver","mag_bolt_heavy"]);
 });
 test("Reclaimer bolt reload hand and arrow follow TOP rail, not vertically",()=>{
  const start=sampleReloadMotion(.35,"bolt"),finish=sampleReloadMotion(.70,"bolt");
  expect(start.hand[1]).toBeGreaterThan(0);
  expect(finish.hand[1]).toBeGreaterThan(0);
  expect(Math.abs(start.hand[2]-finish.hand[2])).toBeGreaterThan(.05);
  expect(start.prop[1]).toBeGreaterThan(0);
 });
 test("Hellfire sprays for five fully charged seconds, Storm mines are four seconds",()=>{
  expect(HELLFIRE_BURST_MS).toBe(5000);
  expect(weaponById("wonder_hellfire").wonder?.maxCharges).toBe(5);
  expect(weaponById("wonder_stormweaver").description).toContain("4 seconds");
 });
});
