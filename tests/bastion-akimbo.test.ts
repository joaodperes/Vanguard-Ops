import {describe,expect,test} from "bun:test";
import {weaponById,computeEffectiveStats,compatibleAttachments,attachmentById} from "../src/lib/game-data";
import {isBastionAkimbo,isFanHammer,akimboHandReady,akimboHandIntervalMs,akimboReloadDip,akimboCrossDrawAmount,isAkimboWeapon,akimboHandCapacity,akimboPumpStroke,AKIMBO_WEAPON_IDS,AKIMBO_CYLINDER_CAPACITY} from "../src/lib/weapon-mechanics";

const empty={sight:null,barrel:null,grip:null,magazine:null};
describe("Bastion .45 Akimbo",()=>{
  test("Bastion's Akimbo grip remains incompatible with Fan the Hammer",()=>{
    expect(isBastionAkimbo("pistol_bastion","grip_akimbo")).toBe(true);
    expect(isBastionAkimbo("pistol_side","grip_akimbo")).toBe(false);
    expect(isBastionAkimbo("pistol_bastion","grip_fan_hammer")).toBe(false);
    expect(isFanHammer("pistol_bastion","grip_akimbo")).toBe(false);
    expect(compatibleAttachments("pistol_bastion","grip")).toContain("grip_akimbo");
    expect(compatibleAttachments("pistol_side","grip")).toContain("grip_akimbo");
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
    expect(dual.reloadTime).toBeCloseTo(base.reloadTime*1.25);
    expect(dual.spread).toBeCloseTo(base.spread*2.6);
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

describe("Akimbo eligible standard pistols and shotguns",()=>{
  const included=[
    "pistol_side","pistol_ghost","pistol_magnum","pistol_bastion",
    "shotgun_br","shotgun_combat",
  ];
  test("eligibility is explicit; excludes Burst, Arc, automatic and other shotgun types",()=>{
    expect([...AKIMBO_WEAPON_IDS]).toEqual(included);
    for(const id of included){
      expect(isAkimboWeapon(id,"grip_akimbo")).toBe(true);
      expect(compatibleAttachments(id,"grip")).toContain("grip_akimbo");
    }
    for(const id of ["pistol_burst","pistol_arc","pistol_machine","pdw_mamba","shotgun_auto","rifle_ar"]){
      expect(isAkimboWeapon(id,"grip_akimbo")).toBe(false);
      expect(compatibleAttachments(id,"grip")).not.toContain("grip_akimbo");
      const base=computeEffectiveStats(weaponById(id),empty);
      const forged=computeEffectiveStats(weaponById(id),{...empty,grip:"grip_akimbo"});
      expect(forged.spread).toBe(base.spread);
      expect(forged.magSize).toBe(base.magSize);
    }
  });
  test("all permitted weapons have two real magazines and much worse hipfire",()=>{
    for(const id of included){
      const weapon=weaponById(id);
      const base=computeEffectiveStats(weapon,empty);
      const dual=computeEffectiveStats(weapon,{...empty,grip:"grip_akimbo"});
      const shotgun=weapon.category==="shotgun";
      const heavy=id==="pistol_magnum"||id==="pistol_bastion";
      expect(dual.magSize).toBe(2*base.magSize);
      expect(akimboHandCapacity(dual.magSize)).toBe(base.magSize);
      expect(dual.magSize%2).toBe(0);
      expect(dual.damage).toBe(base.damage);
      expect(dual.pellets).toBe(base.pellets);
      expect(dual.auto).toBe(false);
      expect(dual.spread/base.spread).toBeCloseTo(shotgun?3.1:heavy?2.6:2.35);
      expect(dual.recoil).toBeGreaterThan(base.recoil);
      expect(dual.reloadTime).toBeGreaterThan(base.reloadTime);
      expect(dual.moveSpeed).toBeLessThan(base.moveSpeed);
      expect(dual.fireRate/base.fireRate).toBeCloseTo(shotgun?1.35:1.75);
    }
  });
  test("two attached extended magazines preserve the per-hand rounded capacity",()=>{
    const pistol=weaponById("pistol_side");
    const single=computeEffectiveStats(pistol,{...empty,magazine:"mag_extended"});
    const dual=computeEffectiveStats(pistol,{...empty,grip:"grip_akimbo",magazine:"mag_extended"});
    expect(single.magSize).toBe(15);
    expect(dual.magSize).toBe(30);
    expect(akimboHandCapacity(dual.magSize)).toBe(single.magSize);
  });
  test("pump action is per hand, visibly cycles and finishes before follow-up",()=>{
    expect(akimboPumpStroke(-Infinity)).toBe(0);
    expect(akimboPumpStroke(0)).toBe(0);
    expect(akimboPumpStroke(200)).toBeGreaterThan(0);
    expect(akimboPumpStroke(300)).toBeGreaterThan(0);
    expect(akimboPumpStroke(500)).toBe(0);
    const rate=computeEffectiveStats(weaponById("shotgun_br"),{...empty,grip:"grip_akimbo"}).fireRate;
    expect(akimboHandIntervalMs(rate)).toBeGreaterThan(485);
    // Other hand can fire during one hand's pump/cooldown.
    expect(akimboHandReady(7,-Infinity,200,rate)).toBe(true);
    expect(akimboHandReady(6,0,200,rate)).toBe(false);
  });
});
