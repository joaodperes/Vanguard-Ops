import {describe,expect,test} from "bun:test";
import {attachmentById,attachmentEffectsForWeapon,compatibleAttachments,computeEffectiveStats,weaponById} from "../src/lib/game-data";
import {
  AKIMBO_WEAPON_IDS,PDW_AKIMBO_WEAPON_IDS,PDW_AKIMBO_GRIP_ID,
  PDW_AKIMBO_MAX_COMBINED_RATE,PDW_AKIMBO_RATE_MULTIPLIER,
  isAkimboWeapon,isPdwAkimboWeapon,isAkimboCapableWeapon,
  cappedPdwAkimboFireRate,authorizedAkimboHand,
  akimboHandCapacity,akimboHandIntervalMs,akimboHandReady,akimboTriggerReady,
} from "../src/lib/weapon-mechanics";
import {attachmentChallenge} from "../src/lib/armory-challenges";

const empty={sight:null,barrel:null,grip:null,magazine:null};
const withPdwAkimbo={...empty,grip:PDW_AKIMBO_GRIP_ID};

describe("PDW Akimbo compatibility and economics",()=>{
  test("is its own exclusive grip for precisely the three fully automatic PDWs",()=>{
    const grip=attachmentById(PDW_AKIMBO_GRIP_ID);
    expect(grip?.slot).toBe("grip");
    expect(grip?.weaponCategories).toEqual(["pdw"]);
    expect(grip?.exclusiveWeaponIds).toEqual([...PDW_AKIMBO_WEAPON_IDS]);
    for(const id of PDW_AKIMBO_WEAPON_IDS){
      const w=weaponById(id);
      expect(w.category).toBe("pdw");
      expect(w.stats.auto).toBe(true);
      expect(isPdwAkimboWeapon(id,PDW_AKIMBO_GRIP_ID)).toBe(true);
      expect(isAkimboWeapon(id,PDW_AKIMBO_GRIP_ID)).toBe(true);
      expect(isAkimboCapableWeapon(id)).toBe(true);
      expect(compatibleAttachments(id,"grip")).toContain(PDW_AKIMBO_GRIP_ID);
      expect(attachmentChallenge(id,PDW_AKIMBO_GRIP_ID)).not.toBeNull();
    }
    for(const id of [...AKIMBO_WEAPON_IDS,"pistol_arc","shotgun_auto","rifle_ar","smg_kp"]){
      expect(isPdwAkimboWeapon(id,PDW_AKIMBO_GRIP_ID)).toBe(false);
      expect(isAkimboWeapon(id,PDW_AKIMBO_GRIP_ID)).toBe(false);
      expect(compatibleAttachments(id,"grip")).not.toContain(PDW_AKIMBO_GRIP_ID);
    }
    // The original semi-auto Akimbo does not silently unlock automatic PDWs.
    for(const id of PDW_AKIMBO_WEAPON_IDS)
      expect(isAkimboWeapon(id,"grip_akimbo")).toBe(false);
  });

  test("per-hand magazines, deliberate handicaps, and a strict combined rate cap",()=>{
    for(const id of PDW_AKIMBO_WEAPON_IDS){
      const w=weaponById(id);
      const base=computeEffectiveStats(w,empty);
      const dual=computeEffectiveStats(w,withPdwAkimbo);
      expect(dual.auto).toBe(true);
      expect(dual.magSize).toBe(base.magSize*2);
      expect(akimboHandCapacity(dual.magSize)).toBe(base.magSize);
      expect(dual.fireRate).toBeCloseTo(Math.min(16,base.fireRate*1.1));
      expect(dual.fireRate).toBeLessThanOrEqual(PDW_AKIMBO_MAX_COMBINED_RATE);
      expect(dual.damage).toBeLessThan(base.damage);
      expect(dual.spread).toBeGreaterThan(base.spread*2.5);
      expect(dual.recoil).toBeGreaterThan(base.recoil*2);
      expect(dual.moveSpeed).toBeLessThan(base.moveSpeed);
      expect(dual.reloadTime).toBeGreaterThan(base.reloadTime);
      expect(dual.range).toBeLessThan(base.range);
      const tuning=attachmentEffectsForWeapon(attachmentById(PDW_AKIMBO_GRIP_ID)!,w);
      expect(tuning.magSize).toBe(100);
    }
  });
  test("combined rate never doubles simply by holding both triggers",()=>{
    expect(PDW_AKIMBO_RATE_MULTIPLIER).toBe(1.10);
    expect(cappedPdwAkimboFireRate(14,15.4)).toBeCloseTo(15.4);
    expect(cappedPdwAkimboFireRate(18,25)).toBe(16);
    for(const rate of [8.25,14.3,15.4,16]){
      const interval=akimboHandIntervalMs(rate);
      // There are two guns, each at half the advertised aggregate rate.
      expect(2*1000/interval).toBeCloseTo(rate);
      expect(akimboHandReady(12,1000,1000+interval-1,rate,1)).toBe(false);
      expect(akimboHandReady(12,1000,1000+interval,rate,1)).toBe(true);
    }
  });
});

describe("PDW Akimbo firing input and server authorization",()=>{
  const rate=15.4, interval=akimboHandIntervalMs(rate);
  test("held left and right mouse/touch triggers continuously fire independently",()=>{
    expect(akimboTriggerReady(true,true,-Infinity,1000,24,-Infinity,rate)).toBe(true);
    expect(akimboTriggerReady(true,false,-Infinity,1000,24,-Infinity,rate)).toBe(false);
    expect(akimboTriggerReady(true,true,-Infinity,1000+interval*.8,23,1000,rate)).toBe(false);
    expect(akimboTriggerReady(true,true,-Infinity,1000+interval,23,1000,rate)).toBe(true);
    expect(akimboTriggerReady(true,false,-Infinity,1000+interval,23,1000,rate)).toBe(false);
    expect(akimboTriggerReady(true,true,-Infinity,1000,0,-Infinity,rate)).toBe(false);
    const last={left:1000,right:1000+interval};
    expect(akimboTriggerReady(true,true,-Infinity,1000+interval,12,last.left,rate)).toBe(true);
    expect(akimboTriggerReady(true,true,-Infinity,1000+interval,12,last.right,rate)).toBe(false);
  });
  test("ordinary semi-auto Akimbo still needs a fresh trigger press",()=>{
    expect(akimboTriggerReady(false,true,-Infinity,1000,6,-Infinity,3.5)).toBe(false);
    expect(akimboTriggerReady(false,false,990,1000,6,-Infinity,3.5)).toBe(true);
    expect(akimboTriggerReady(false,true,100,1000,6,-Infinity,3.5)).toBe(false);
  });
  test("only server-verified Akimbo can accept independent left/right packets",()=>{
    for(const hand of ["left","right"] as const)
      expect(authorizedAkimboHand(isAkimboWeapon("pdw_mamba",PDW_AKIMBO_GRIP_ID),hand)).toBe(hand);
    expect(authorizedAkimboHand(isAkimboWeapon("pdw_mamba","grip_vertical"),"left")).toBeUndefined();
  });
});
