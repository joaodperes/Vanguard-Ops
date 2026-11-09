import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { ATTACHMENTS, WEAPONS, weaponById, compatibleAttachments, computeEffectiveStats, type AttachmentSlot } from "../src/lib/game-data";
import { isFanHammer, FAN_HAMMER_RATE_MULTIPLIER } from "../src/lib/weapon-mechanics";
import { reloadMotionFor, sampleReloadMotion } from "../src/lib/first-person-animation";
import { WEAPON_VISUALS, buildFirstPersonWeapon } from "../src/lib/weapon-models";
import { resolveShotAcoustics } from "../src/lib/weapon-audio";
import { validateGameContent } from "../src/lib/content-validation";

const base:Record<AttachmentSlot,string|null>={sight:null,barrel:null,grip:null,magazine:null};
const bastion=weaponById("pistol_bastion");

describe("Bastion .45 six-shot revolver",()=>{
  test("preserves pistol category, weapon ID, progression and valid catalogs",()=>{
    expect([bastion.id,bastion.category]).toEqual(["pistol_bastion","pistol"]);
    expect([bastion.unlockLevel,bastion.unlockCost]).toEqual([18,1100]);
    expect(bastion.stats.magSize).toBe(6);
    expect(bastion.stats.auto).toBe(false);
    expect(WEAPONS.some(w=>w.id==="pistol_magnum")).toBe(true);
    expect(validateGameContent()).toEqual([]);
  });
  test("six physical chambers, a dedicated reload and speedloader prop",()=>{
    expect(WEAPON_VISUALS.pistol_bastion.magazine).toBe("revolver");
    expect(reloadMotionFor("pistol_bastion","pistol")).toBe("cylinder_speedloader");
    expect(reloadMotionFor("pistol_magnum","pistol")).toBe("cylinder");
    const pose=sampleReloadMotion(.58,"cylinder_speedloader");
    expect(pose.propVisible).toBe(true);
    expect(pose.hideFixedMagazine).toBe(false);
    const parts:THREE.Object3D[]=[];const material=new THREE.MeshBasicMaterial();
    buildFirstPersonWeapon("pistol_bastion",material,material,(part,x,y,z)=>{part.position.set(x,y,z);parts.push(part);});
    const cylinder=parts.find(p=>p.userData.fpRevolverCylinder);
    expect(cylinder).toBeDefined();
    expect(cylinder!.children).toHaveLength(7);
  });
  test("fan attachment enables rapid held hipfire, not for other pistols",()=>{
    expect(isFanHammer("pistol_bastion","grip_fan_hammer")).toBe(true);
    expect(isFanHammer("pistol_magnum","grip_fan_hammer")).toBe(false);
    const normal=computeEffectiveStats(bastion,base);
    const fan=computeEffectiveStats(bastion,{...base,grip:"grip_fan_hammer"});
    expect(normal.auto).toBe(false);
    expect(fan.auto).toBe(true);
    expect(fan.fireRate).toBeCloseTo(normal.fireRate*FAN_HAMMER_RATE_MULTIPLIER);
    expect(fan.spread).toBeGreaterThan(normal.spread*2);
    expect(fan.recoil).toBeGreaterThan(normal.recoil);
    expect(fan.magSize).toBe(6);
    expect(computeEffectiveStats(weaponById("pistol_magnum"),{...base,grip:"grip_fan_hammer"}).auto).toBe(false);
  });
  test("revolver attachments trade speed/accuracy/power without extra chambers",()=>{
    for(const slot of ["sight","barrel","grip","magazine"] as AttachmentSlot[])
      expect(compatibleAttachments(bastion.id,slot)).toHaveLength(4);
    const ids=compatibleAttachments(bastion.id,"magazine");
    expect(ids).not.toContain("mag_extended");
    expect(ids).not.toContain("mag_drum");
    for(const id of ids){
      expect(ATTACHMENTS.find(a=>a.id===id)?.exclusiveWeaponIds).toContain(bastion.id);
      expect(computeEffectiveStats(bastion,{...base,magazine:id}).magSize).toBe(6);
    }
    expect(computeEffectiveStats(bastion,{...base,magazine:"mag_rev_speedloader"}).reloadTime)
      .toBeLessThan(computeEffectiveStats(bastion,base).reloadTime);
    expect(computeEffectiveStats(bastion,{...base,magazine:"mag_rev_hollow"}).range)
      .toBeLessThan(computeEffectiveStats(bastion,base).range);
  });
  test("unique unsuppressed gunshot has deeper pressure pulse and bright crack",()=>{
    const shot=resolveShotAcoustics("pistol",{weaponId:"pistol_bastion"});
    const regular=resolveShotAcoustics("pistol",{weaponId:"pistol_side"});
    const quiet=resolveShotAcoustics("pistol",{weaponId:"pistol_bastion",suppressed:true});
    expect(shot.punchHz).toBeLessThan(regular.punchHz);
    expect(shot.punchLevel).toBeGreaterThan(regular.punchLevel);
    expect(shot.crackLevel).toBeGreaterThan(regular.crackLevel);
    expect(quiet.crackLevel).toBeLessThan(shot.crackLevel*.05);
  });
});
