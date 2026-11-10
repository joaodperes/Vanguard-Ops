import {describe,expect,test} from "bun:test";
import {weaponById,computeEffectiveStats,compatibleAttachments,attachmentById} from "../src/lib/game-data";
import {isBastionAkimbo,isFanHammer,akimboHandReady,akimboHandIntervalMs,akimboReloadDip,akimboCrossDrawAmount,AKIMBO_CYLINDER_CAPACITY} from "../src/lib/weapon-mechanics";

const empty={sight:null,barrel:null,grip:null,magazine:null};
describe("Bastion .45 Akimbo",()=>{
  test("is exclusive to the Bastion and replaces Fan the Hammer",()=>{
    expect(isBastionAkimbo("pistol_bastion","grip_akimbo")).toBe(true);
    expect(isBastionAkimbo("pistol_side","grip_akimbo")).toBe(false);
    expect(isBastionAkimbo("pistol_bastion","grip_fan_hammer")).toBe(false);
    expect(isFanHammer("pistol_bastion","grip_akimbo")).toBe(false);
    expect(compatibleAttachments("pistol_bastion","grip")).toContain("grip_akimbo");
    expect(compatibleAttachments("pistol_side","grip")).not.toContain("grip_akimbo");
    expect(attachmentById("grip_akimbo")?.slot).toBe("grip");
  });
  test("doubles capacity without increasing damage or enabling automatic fire",()=>{
    const w=weaponById("pistol_bastion");
    const base=computeEffectiveStats(w,empty);
    const dual=computeEffectiveStats(w,{...empty,grip:"grip_akimbo"});
    expect(base.magSize).toBe(AKIMBO_CYLINDER_CAPACITY);
    expect(dual.magSize).toBe(AKIMBO_CYLINDER_CAPACITY*2);
    expect(dual.damage).toBe(base.damage);
    expect(dual.auto).toBe(false);
    expect(dual.fireRate).toBeCloseTo(base.fireRate*1.75);
    expect(dual.reloadTime).toBeCloseTo(base.reloadTime*1.15);
    expect(dual.spread).toBeGreaterThan(base.spread);
  });
  test("each trigger is independent: both hands can shoot on the same frame",()=>{
    const rate=3.5, now=1000;
    expect(akimboHandIntervalMs(rate)).toBeCloseTo(2000/3.5);
    const left={ammo:6,lastShot:-Infinity};
    const right={ammo:6,lastShot:-Infinity};
    expect(akimboHandReady(left.ammo,left.lastShot,now,rate)).toBe(true);
    expect(akimboHandReady(right.ammo,right.lastShot,now,rate)).toBe(true);
    left.ammo--;left.lastShot=now;
    // Even after the left shot is recorded, the right shot is still ready now.
    expect(akimboHandReady(right.ammo,right.lastShot,now,rate)).toBe(true);
    expect(akimboHandReady(left.ammo,left.lastShot,now,rate)).toBe(false);
    right.ammo--;right.lastShot=now;
    expect(akimboHandReady(right.ammo,right.lastShot,now,rate)).toBe(false);
    expect(akimboHandReady(left.ammo,left.lastShot,1600,rate)).toBe(true);
    expect(akimboHandReady(right.ammo,right.lastShot,1600,rate)).toBe(true);
  });
  test("an empty left cylinder does not prevent the right revolver firing",()=>{
    expect(akimboHandReady(0,-Infinity,1000,3.5)).toBe(false);
    expect(akimboHandReady(4,-Infinity,1000,3.5)).toBe(true);
    expect(akimboHandReady(4,900,1000,3.5)).toBe(false);
  });
  test("both barrels dip and return together without a staggered cylinder phase",()=>{
    expect(akimboReloadDip(0)).toBe(0);
    expect(akimboReloadDip(.1)).toBeGreaterThan(0);
    expect(akimboReloadDip(.25)).toBe(1);
    expect(akimboReloadDip(.6)).toBe(1);
    expect(akimboReloadDip(.9)).toBeLessThan(1);
    expect(akimboReloadDip(1)).toBe(0);
    expect(akimboCrossDrawAmount(0,false)).toBe(0);
    expect(akimboCrossDrawAmount(1,false)).toBe(1);
    expect(akimboCrossDrawAmount(0,true)).toBe(1);
    expect(akimboCrossDrawAmount(1,true)).toBe(0);
  });
});
