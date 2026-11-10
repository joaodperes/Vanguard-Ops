import {describe,expect,test} from "bun:test";
import {weaponById,computeEffectiveStats,compatibleAttachments,attachmentById} from "../src/lib/game-data";
import {isBastionAkimbo,isFanHammer,akimboHandReady,akimboReloadFraction,akimboCrossDrawAmount,AKIMBO_CYLINDER_CAPACITY} from "../src/lib/weapon-mechanics";

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
    expect(dual.reloadTime).toBeCloseTo(base.reloadTime*1.85);
    expect(dual.spread).toBeGreaterThan(base.spread);
  });
  test("hand cadence and combined cadence both gate shots",()=>{
    expect(akimboHandReady(6,-Infinity,-Infinity,1000,2,3.5)).toBe(true);
    expect(akimboHandReady(0,-Infinity,-Infinity,1000,2,3.5)).toBe(false);
    expect(akimboHandReady(4,900,0,1000,2,3.5)).toBe(false);
    expect(akimboHandReady(4,0,900,1000,2,3.5)).toBe(false);
    expect(akimboHandReady(4,0,0,1000,2,3.5)).toBe(true);
  });
  test("left cylinder reloads before right, with independent cross draws",()=>{
    expect(akimboReloadFraction(0,"left")).toBe(0);
    expect(akimboReloadFraction(.25,"left")).toBe(.5);
    expect(akimboReloadFraction(.25,"right")).toBe(0);
    expect(akimboReloadFraction(.75,"left")).toBe(1);
    expect(akimboReloadFraction(.75,"right")).toBe(.5);
    expect(akimboReloadFraction(1,"right")).toBe(1);
    expect(akimboCrossDrawAmount(0,false)).toBe(0);
    expect(akimboCrossDrawAmount(1,false)).toBe(1);
    expect(akimboCrossDrawAmount(0,true)).toBe(1);
    expect(akimboCrossDrawAmount(1,true)).toBe(0);
  });
});
