import {describe,expect,test} from "bun:test";
import {ATTACHMENTS,WEAPONS,attachmentById,compatibleAttachments,computeEffectiveStats,weaponById} from "../src/lib/game-data";
import {
  QUICK_READY_GRIP_ID,SPRINT_RECOVERY_STANDARD_MS,SPRINT_RECOVERY_QUICK_MS,
  isQuickReadyGrip,sprintRecoveryAdsRate,sprintRecoverySpreadMultiplier,
} from "../src/lib/movement-rules";
import {AKIMBO_WEAPON_IDS,isAkimboWeapon} from "../src/lib/weapon-mechanics";

const empty={sight:null,barrel:null,grip:null,magazine:null};

describe("Sprint ADS replacement: Quick-Ready Grip",()=>{
  test("retains the old ID so purchased or equipped grips remain valid",()=>{
    expect(QUICK_READY_GRIP_ID).toBe("grip_runner_ads");
    const grip=attachmentById(QUICK_READY_GRIP_ID)!;
    expect(grip.name).toBe("Quick-Ready Grip");
    expect(grip.description).toMatch(/sprint/i);
    expect(grip.description).not.toMatch(/allows ADS during a sprint/i);
    expect(grip.effects?.adsTime).toBeLessThan(0);
    expect(grip.effects?.recoil).toBeGreaterThan(0);
    expect(isQuickReadyGrip(grip.id)).toBe(true);
    expect(isQuickReadyGrip("grip_vertical")).toBe(false);
    expect(ATTACHMENTS.some(a=>a.id==="grip_akimbo_pdw")).toBe(false);
  });
  test("keeps at least four grips for every previously affected conventional weapon",()=>{
    const affected=[
      "rifle_electron","crossbow_reclaimer","pistol_arc","sniper_lr",
      "pistol_burst","pistol_machine","launcher_rocket","sniper_scout",
      "sniper_heavy","pdw_mamba","pdw_sentinel","launcher_breach","launcher_swarm",
    ];
    for(const id of affected){
      const list=compatibleAttachments(id,"grip");
      expect(list).toContain(QUICK_READY_GRIP_ID);
      expect(list.length).toBeGreaterThanOrEqual(4);
      const weapon=weaponById(id);
      const base=computeEffectiveStats(weapon,empty);
      const tuned=computeEffectiveStats(weapon,{...empty,grip:QUICK_READY_GRIP_ID});
      expect(tuned.adsTime).toBeLessThan(base.adsTime);
      expect(tuned.recoil).toBeGreaterThan(base.recoil);
    }
  });
  test("removes accidental PDW Akimbo availability without changing original Akimbo",()=>{
    for(const w of WEAPONS.filter(x=>x.category==="pdw"&&!x.wonder)){
      expect(compatibleAttachments(w.id,"grip")).not.toContain("grip_akimbo_pdw");
      expect(isAkimboWeapon(w.id,"grip_akimbo")).toBe(false);
    }
    for(const id of AKIMBO_WEAPON_IDS){
      expect(isAkimboWeapon(id,"grip_akimbo")).toBe(true);
    }
  });
  test("recovery makes shots more accurate sooner but never disables a shot",()=>{
    expect(SPRINT_RECOVERY_STANDARD_MS).toBe(300);
    expect(SPRINT_RECOVERY_QUICK_MS).toBe(95);
    for(const dt of [0,20,50,90]){
      const standard=sprintRecoverySpreadMultiplier(1000+dt,1000,null);
      const quick=sprintRecoverySpreadMultiplier(1000+dt,1000,QUICK_READY_GRIP_ID);
      expect(standard).toBeGreaterThanOrEqual(quick);
      expect(quick).toBeGreaterThanOrEqual(1);
    }
    expect(sprintRecoverySpreadMultiplier(1100,1000,QUICK_READY_GRIP_ID)).toBe(1);
    expect(sprintRecoverySpreadMultiplier(1100,1000,null)).toBeGreaterThan(1);
    expect(sprintRecoverySpreadMultiplier(1300,1000,null)).toBe(1);
    expect(sprintRecoveryAdsRate(1100,1000,QUICK_READY_GRIP_ID)).toBeGreaterThan(12);
    expect(sprintRecoveryAdsRate(1400,1000,QUICK_READY_GRIP_ID)).toBe(12);
  });
});
