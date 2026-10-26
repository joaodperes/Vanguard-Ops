import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { weaponById, WEAPONS } from "../src/lib/game-data";
import { rayCombatantHit } from "../src/lib/combat-hitboxes";
import { launcherSplashFactor } from "../src/lib/launcher-effects";
import { automaticBloom, autoSpreadRadians } from "../src/lib/automatic-spread";
import { meleeStyle, meleeSwingPose } from "../src/lib/melee-styles";
import { buildMeleeWeaponParts } from "../src/lib/melee-model";
import { chooseQuickMeleeTarget, quickMeleeProfile } from "../src/lib/quick-melee";
describe("secondary balance and projectile identity",()=>{
  test("Sentinel rewards precision more than Machine Pistol",()=>{
    expect(weaponById("pdw_sentinel").stats.headshotMult).toBeGreaterThan(weaponById("pistol_machine").stats.headshotMult);
  });
  test("Magnum and Bastion no longer one-shot full-health opponents",()=>{
    for(const id of ["pistol_magnum","pistol_bastion"]){
      const s=weaponById(id).stats;
      expect(s.damage).toBeLessThan(60);
      expect(s.damage*s.headshotMult).toBeLessThan(100);
      expect(s.range).toBeLessThan(weaponById("pistol_ghost").stats.range);
    }
    expect(weaponById("pistol_ghost").stats.reloadTime).toBeLessThan(1.2);
  });
  test("Swarm has larger group-control footprint and weaker focused impact than RL-7",()=>{
    const swarm=weaponById("launcher_swarm"),rl=weaponById("launcher_rocket");
    expect(swarm.explosive!.radius).toBeGreaterThan(rl.explosive!.radius);
    expect(swarm.stats.damage).toBeLessThan(rl.stats.damage/2);
    expect(launcherSplashFactor(swarm.id,swarm.explosive!.radius*.9,swarm.explosive!.radius)).toBeGreaterThan(.5);
    expect(launcherSplashFactor(rl.id,rl.explosive!.radius*.9,rl.explosive!.radius)).toBeLessThan(.4);
    expect(launcherSplashFactor("launcher_swarm",10,swarm.explosive!.radius)).toBe(0);
  });
});
describe("limb-inclusive combat hit tests (bots and players)",()=>{
  const feet:[number,number,number]=[0,0,0],dir:[number,number,number]=[0,0,1];
  test("head remains a genuine headshot",()=>{
    expect(rayCombatantHit([0,1.62,-3],dir,feet)?.head).toBe(true);
  });
  test("both arms and legs register non-headshot body damage",()=>{
    for(const x of [-.5,.5]){
      const hit=rayCombatantHit([x,1.1,-3],dir,feet);
      expect(hit).not.toBeNull();
      expect(hit?.head).toBe(false);
    }
    for(const x of [-.13,.13]){
      const hit=rayCombatantHit([x,.28,-3],dir,feet);
      expect(hit).not.toBeNull();
      expect(hit?.head).toBe(false);
    }
    expect(rayCombatantHit([1,.9,-3],dir,feet)).toBeNull();
    expect(rayCombatantHit([0,2.2,-3],dir,feet)).toBeNull();
  });
});
describe("sustained automatic fire",()=>{
  test("bursts progressively enlarge spread, with recovery after release",()=>{
    let bloom=automaticBloom(0,14,1000);
    expect(bloom).toBe(0); // releasing the trigger restores first-shot accuracy
    for(let i=0;i<5;i++){
      const next=automaticBloom(bloom,14,70);
      expect(next).toBeGreaterThan(bloom);
      bloom=next;
    }
    expect(autoSpreadRadians(.03,bloom)).toBeGreaterThan(autoSpreadRadians(.03,.2)*3);
    expect(automaticBloom(bloom,14,700)).toBe(0);
  });
});
describe("melee identity and identical F profiles",()=>{
  const ids=["knife_tactical","shiv","machete","baton","axe","hammer"];
  test("point-blank stabs, vertical chops, lateral axe, overhead hammer",()=>{
    expect(ids.map(meleeStyle)).toEqual(["stab","stab","vertical","vertical","horizontal","slam"]);
    expect(meleeSwingPose("knife_tactical",.5).z).toBeLessThan(-.3);
    expect(Math.abs(meleeSwingPose("axe",.5).yaw)).toBeGreaterThan(.4);
    expect(Math.abs(meleeSwingPose("axe",.5).yaw)).toBeLessThan(.9);
    expect(meleeSwingPose("hammer",.5).pitch).toBeLessThan(-1.5);
    expect(meleeSwingPose("machete",.5).pitch).toBeLessThan(-1);
  });
  test("range, power and rate form distinct identities",()=>{
    const [knife,shiv,machete,baton,axe,hammer]=ids.map(id=>weaponById(id).stats);
    expect(knife.damage).toBeGreaterThanOrEqual(100);
    expect(shiv.range).toBe(knife.range);
    expect(shiv.damage).toBeLessThan(knife.damage/2);
    expect(shiv.fireRate).toBeGreaterThan(knife.fireRate);
    expect(machete.range).toBeGreaterThan(knife.range);
    expect(machete.damage*2).toBeGreaterThanOrEqual(100);
    expect(baton.damage).toBeLessThan(machete.damage);
    expect(baton.fireRate).toBeLessThan(machete.fireRate);
    expect(hammer.range).toBeGreaterThan(axe.range);
    expect(hammer.damage).toBeGreaterThan(axe.damage);
    expect(hammer.fireRate).toBeLessThan(axe.fireRate);
    for(const id of ids)expect(quickMeleeProfile(weaponById(id).stats).reach).toBeLessThanOrEqual(1.03);
    const candidates=[{id:"enemy",pos:[0,0,.94] as const,alive:true}];
    expect(chooseQuickMeleeTarget([0,0,0],0,candidates,()=>true,knife.range)).toBeNull();
    expect(chooseQuickMeleeTarget([0,0,0],0,candidates,()=>true,machete.range)?.id).toBe("enemy");
    const distant=[{id:"distant",pos:[0,0,1.2] as const,alive:true}];
    for(const id of ids)
      expect(chooseQuickMeleeTarget([0,0,0],0,distant,()=>true,quickMeleeProfile(weaponById(id).stats).reach)).toBeNull();
  });
  test("axe has curved cutting geometry that hammer does not",()=>{
    const build=(id:string)=>{
      const parts:THREE.Mesh[]=[];
      const metal=new THREE.MeshBasicMaterial(),grip=new THREE.MeshBasicMaterial();
      buildMeleeWeaponParts(id,metal,grip,(part)=>parts.push(part));
      return parts;
    };
    const axe=build("axe"),hammer=build("hammer");
    expect(axe.some(p=>p.geometry instanceof THREE.ExtrudeGeometry)).toBe(true);
    expect(hammer.every(p=>!(p.geometry instanceof THREE.ExtrudeGeometry))).toBe(true);
    for(const part of [...axe,...hammer])part.geometry.dispose();
  });
});
