import {describe,expect,test} from "bun:test";
import {weaponById,computeEffectiveStats,compatibleAttachments,attachmentById} from "../src/lib/game-data";
import {isBastionAkimbo,isFanHammer,akimboVolleyReady,akimboVolleyIntervalMs,akimboReloadDip,akimboCrossDrawAmount,AKIMBO_CYLINDER_CAPACITY} from "../src/lib/weapon-mechanics";

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
  test("each accepted trigger fires two cylinders at one combined-rate interval",()=>{
    const rate=3.5;
    expect(akimboVolleyIntervalMs(rate)).toBeCloseTo(2000/3.5);
    expect(akimboVolleyReady(6,6,-Infinity,1000,rate)).toBe(true);
    expect(akimboVolleyReady(0,6,-Infinity,1000,rate)).toBe(false);
    expect(akimboVolleyReady(6,0,-Infinity,1000,rate)).toBe(false);
    expect(akimboVolleyReady(6,6,900,1000,rate)).toBe(false);
    expect(akimboVolleyReady(4,4,0,1000,rate)).toBe(true);
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
