import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { weaponById, WEAPONS } from "../src/lib/game-data";
import { resolveMaterialPenetrationShot, traceCoverPenetration } from "../src/lib/cover-penetration";
import type { CoverBox } from "../src/lib/game-protocol";
import { rayCombatantHit } from "../src/lib/combat-hitboxes";
import { launcherSplashFactor } from "../src/lib/launcher-effects";
import { automaticBloom } from "../src/lib/automatic-spread";
import { shotSpread } from "../src/lib/weapon-accuracy";
import { meleeStyle, meleeSwingPose } from "../src/lib/melee-styles";
import { buildMeleeWeaponParts } from "../src/lib/melee-model";
import { chooseQuickMeleeTarget, quickMeleeProfile } from "../src/lib/quick-melee";
import { THROWING_KNIFE_RANGE,isThrowingKnife } from "../src/lib/throwing-knives";
describe("secondary balance and projectile identity",()=>{
  test("Sentinel rewards precision more than Machine Pistol",()=>{
    expect(weaponById("pdw_sentinel").stats.headshotMult).toBeGreaterThan(weaponById("pistol_machine").stats.headshotMult);
  });
  test("Magnum one-shot headshots contrast with Bastion penetration and two-hit kills",()=>{
    const magnum=weaponById("pistol_magnum").stats;
    const bastion=weaponById("pistol_bastion").stats;
    for(const s of [magnum,bastion]){
      expect(s.damage).toBeGreaterThanOrEqual(50);
      expect(s.damage).toBeLessThan(100);
    }
    expect(magnum.headshotMult).toBe(1.8);
    expect(magnum.damage*magnum.headshotMult).toBeGreaterThanOrEqual(100);
    expect(bastion.headshotMult).toBe(1.4);
    expect(bastion.damage*bastion.headshotMult).toBeLessThan(100);
    expect(bastion.coverPenetration).toBe(2.2);
    expect(bastion.bodyPenetration?.damageRetention).toBe(0.4);
    expect(bastion.coverPenetration).toBeGreaterThan(magnum.coverPenetration!);
    // Bastion's slower, higher-energy .45 rounds now hit harder than Magnum,
    // rather than being artificially capped below 60 like the old pistol.
    expect(bastion.damage).toBeGreaterThan(magnum.damage);
    expect(bastion.fireRate).toBeLessThan(magnum.fireRate);
    expect(bastion.recoil).toBeGreaterThan(magnum.recoil);
    expect(magnum.range).toBeLessThan(weaponById("pistol_ghost").stats.range);
    expect(bastion.range).toBeLessThanOrEqual(weaponById("pistol_ghost").stats.range);
    expect(weaponById("pistol_ghost").stats.reloadTime).toBeLessThan(1.2);
  });
  test("Bastion crosses thicker sheet metal and retains 40% damage through another body",()=>{
    const magnum=weaponById("pistol_magnum").stats,bastion=weaponById("pistol_bastion").stats;
    const panel:CoverBox={pos:[0,0,4],size:[.5,.8,.7],kind:"cover",material:"sheet_metal"};
    const origin:[number,number,number]=[0,0,0],dir:[number,number,number]=[0,0,1];
    const old=traceCoverPenetration([panel],origin,dir,9,1.8);
    const magnumTrace=traceCoverPenetration([panel],origin,dir,9,magnum.coverPenetration);
    const bastionTrace=traceCoverPenetration([panel],origin,dir,9,bastion.coverPenetration);
    expect(old.blockedAt).toBeLessThan(Infinity);
    expect(magnumTrace.blockedAt).toBeLessThan(Infinity);
    expect(bastionTrace.blockedAt).toBe(Infinity);
    expect(bastionTrace.crossings).toHaveLength(1);
    const aligned=[{target:"front",t:4,head:false},{target:"rear",t:8,head:false}];
    const hits=resolveMaterialPenetrationShot(aligned,[],origin,dir,20,bastion.bodyPenetration,bastion.coverPenetration).hits;
    expect(hits.map(h=>h.target)).toEqual(["front","rear"]);
    expect(hits[0].damageScale).toBe(1);
    expect(hits[1].damageScale).toBeCloseTo(.4,6);
    expect(hits[1].damageScale*bastion.damage).toBeCloseTo(28,6);
    expect(bastion.bodyPenetration!.damageRetention).toBeGreaterThan(magnum.bodyPenetration!.damageRetention);
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
    // Verify the actual shot model, rather than an obsolete spread helper.
    const rifle=weaponById("rifle_ar");
    const dispersion=(b:number)=>shotSpread(rifle.stats,rifle.category,false,0,b,false);
    expect(dispersion(bloom)).toBeGreaterThan(dispersion(.2)*1.5);
    expect(automaticBloom(bloom,14,700)).toBe(0);
  });
});
describe("melee identity and identical F profiles",()=>{
  const ids=["knife_tactical","shiv","machete","baton","axe","hammer"];
  test("point-blank stabs, vertical chops, lateral axe, overhead hammer",()=>{
    expect(ids.map(meleeStyle)).toEqual(["stab","stab","vertical","throw","horizontal","slam"]);
    expect(meleeSwingPose("knife_tactical",.5).z).toBeLessThan(-.3);
    expect(Math.abs(meleeSwingPose("axe",.5).yaw)).toBeGreaterThan(.4);
    expect(Math.abs(meleeSwingPose("axe",.5).yaw)).toBeLessThan(.9);
    expect(meleeSwingPose("hammer",.5).pitch).toBeLessThan(-1.5);
    expect(meleeSwingPose("machete",.5).pitch).toBeLessThan(-1);
  });
  test("range, power and rate form distinct identities",()=>{
    const [knife,shiv,machete,baton,axe,hammer]=ids.map(id=>weaponById(id).stats);
    expect(knife.damage).toBeGreaterThanOrEqual(100);
    expect(shiv.range).toBeLessThan(knife.range);
    expect(shiv.damage).toBeLessThan(knife.damage/2);
    expect(shiv.fireRate).toBeGreaterThan(knife.fireRate);
    expect(machete.range).toBeGreaterThan(knife.range);
    expect(machete.damage*2).toBeGreaterThanOrEqual(100);
    expect(baton.damage).toBeGreaterThanOrEqual(100);
    expect(baton.range).toBe(THROWING_KNIFE_RANGE);
    expect(isThrowingKnife("baton")).toBe(true);
    expect(hammer.range).toBeGreaterThan(axe.range);
    expect(hammer.damage).toBeGreaterThan(axe.damage);
    expect(hammer.fireRate).toBeLessThan(axe.fireRate);
    for(const id of ids.filter(id=>!isThrowingKnife(id)))
      expect(quickMeleeProfile(weaponById(id).stats,id).reach).toBeLessThanOrEqual(1.9);
    const candidates=[{id:"enemy",pos:[0,0,1.3] as const,alive:true}];
    expect(chooseQuickMeleeTarget([0,0,0],0,candidates,()=>true,shiv.range)).toBeNull();
    expect(chooseQuickMeleeTarget([0,0,0],0,candidates,()=>true,machete.range)?.id).toBe("enemy");
    const distant=[{id:"distant",pos:[0,0,2.0] as const,alive:true}];
    for(const id of ids.filter(id=>!isThrowingKnife(id)))
      expect(chooseQuickMeleeTarget([0,0,0],0,distant,()=>true,quickMeleeProfile(weaponById(id).stats).reach)).toBeNull();
    expect(chooseQuickMeleeTarget([0,0,0],0,[{id:"axe-target",pos:[0,0,1.7] as const,alive:true}],()=>true,axe.range)?.id).toBe("axe-target");
    expect(chooseQuickMeleeTarget([0,0,0],0,[{id:"axe-target",pos:[0,0,1.7] as const,alive:true}],()=>true,machete.range)).toBeNull();
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
