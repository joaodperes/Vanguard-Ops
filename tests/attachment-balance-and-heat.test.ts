import { describe, expect, test } from "bun:test";
import {
  ATTACHMENTS, WEAPONS, weaponById, compatibleAttachments,
  computeEffectiveStats, attachmentEffectsForWeapon, effectiveHeatConfig,
  type AttachmentSlot,
} from "../src/lib/game-data";
import { addHeat, coolHeat, freshHeat } from "../src/lib/weapon-mechanics";

const empty: Record<AttachmentSlot,string|null> = { sight:null, barrel:null, grip:null, magazine:null };
const withAttachment = (slot:AttachmentSlot,id:string) => ({ ...empty, [slot]:id });

describe("class-sensitive magazine tuning",()=>{
  test("assault, LMG and pistol extended magazines have different capacity and movement tradeoffs",()=>{
    const rifle=weaponById("rifle_ar"),lmg=weaponById("lmg_heavy"),pistol=weaponById("pistol_side");
    const base=ATTACHMENTS.find(a=>a.id==="mag_extended")!;
    expect(attachmentEffectsForWeapon(base,rifle).magSize).toBe(30);
    expect(attachmentEffectsForWeapon(base,lmg).magSize).toBe(20);
    expect(attachmentEffectsForWeapon(base,pistol).magSize).toBe(25);
    expect(computeEffectiveStats(rifle,withAttachment("magazine","mag_extended")).magSize).toBe(39);
    expect(computeEffectiveStats(lmg,withAttachment("magazine","mag_extended")).magSize).toBe(120);
    expect(computeEffectiveStats(pistol,withAttachment("magazine","mag_extended")).magSize).toBe(15);
    expect(computeEffectiveStats(lmg,withAttachment("magazine","mag_extended")).moveSpeed)
      .toBeLessThan(lmg.stats.moveSpeed);
  });
  test("balanced, quickdraw, drum and lightweight give distinct tradeoffs",()=>{
    const w=weaponById("smg_kp"),base=computeEffectiveStats(w,empty);
    const ext=computeEffectiveStats(w,withAttachment("magazine","mag_extended"));
    const quick=computeEffectiveStats(w,withAttachment("magazine","mag_quickdraw"));
    const balanced=computeEffectiveStats(w,withAttachment("magazine","mag_balanced"));
    const drum=computeEffectiveStats(w,withAttachment("magazine","mag_drum"));
    expect(ext.magSize).toBeGreaterThan(balanced.magSize);
    expect(balanced.magSize).toBeGreaterThan(base.magSize);
    expect(quick.magSize).toBeLessThan(base.magSize);
    expect(quick.reloadTime).toBeLessThan(balanced.reloadTime);
    expect(drum.magSize).toBeGreaterThan(ext.magSize);
    expect(drum.reloadTime).toBeGreaterThan(base.reloadTime);
    expect(drum.moveSpeed).toBeLessThan(ext.moveSpeed);
    const sniper=weaponById("sniper_lr");
    const light=computeEffectiveStats(sniper,withAttachment("magazine","mag_lightweight"));
    expect(light.magSize).toBeLessThan(sniper.stats.magSize);
    expect(light.moveSpeed).toBeGreaterThan(sniper.stats.moveSpeed);
  });
  test("shotgun Shell Carrier is compatible and speeds insertion, not capacity",()=>{
    const w=weaponById("shotgun_br");
    expect(compatibleAttachments(w.id,"magazine")).toContain("mag_shell_carrier");
    const s=computeEffectiveStats(w,withAttachment("magazine","mag_shell_carrier"));
    expect(s.magSize).toBe(w.stats.magSize);
    expect(s.reloadTime).toBeLessThan(w.stats.reloadTime);
  });
  test("launchers cannot use generic extended or balanced magazine",()=>{
    for(const w of WEAPONS.filter(w=>w.category==="launcher"&&!w.wonder)){
      const ids=compatibleAttachments(w.id,"magazine");
      expect(ids).toContain("mag_launcher_quickload");
      expect(ids).not.toContain("mag_extended");
      expect(ids).not.toContain("mag_balanced");
      const s=computeEffectiveStats(w,withAttachment("magazine","mag_extended"));
      expect(s.magSize).toBe(w.stats.magSize);
    }
  });
});

describe("physical plausibility and stat accuracy",()=>{
  test("a hipfire laser never changes ADS spread, even with other grips",()=>{
    const w=weaponById("smg_kp");
    const base=computeEffectiveStats(w,empty);
    const laser=computeEffectiveStats(w,withAttachment("sight","sight_laser"));
    expect(laser.spread).toBeLessThan(base.spread);
    expect(laser.adsSpread).toBe(base.adsSpread);
    const grip=computeEffectiveStats(w,{...withAttachment("sight","sight_laser"),grip:"grip_angled"});
    expect(grip.adsSpread).toBe(base.adsSpread);
    const red=computeEffectiveStats(w,withAttachment("sight","sight_red_dot"));
    expect(red.adsSpread).toBeLessThan(base.adsSpread);
  });
  test("magnified optics don't alter ballistic range",()=>{
    const w=weaponById("rifle_ar");
    const optical=computeEffectiveStats(w,withAttachment("sight","sight_acog"));
    expect(optical.range).toBe(w.stats.range);
    expect(optical.adsSpread).toBeLessThan(w.stats.adsSpread);
  });
  test("heavy barrel never gives free body-shot kill breakpoint",()=>{
    for(const id of ["rifle_ar","rifle_heavy","sniper_lr","sniper_scout"]){
      const w=weaponById(id),s=computeEffectiveStats(w,withAttachment("barrel","barrel_heavy"));
      expect(s.damage).toBe(w.stats.damage);
      expect(s.adsTime).toBeGreaterThan(w.stats.adsTime);
      expect(s.moveSpeed).toBeLessThan(w.stats.moveSpeed);
    }
  });
  test("piercing bolts penetrate bodies; heavy crossbow arrows remain below 100 body damage",()=>{
    const crossbow=weaponById("crossbow_reclaimer");
    const pierced=computeEffectiveStats(crossbow,withAttachment("barrel","barrel_bolt_piercing"));
    expect(pierced.bodyPenetration?.maxTargets).toBe(2);
    const heavy=computeEffectiveStats(crossbow,withAttachment("magazine","mag_bolt_heavy"));
    expect(heavy.damage).toBeLessThan(100);
    expect(heavy.magSize).toBe(2);
  });
});

describe("shared heat-based weapon customization",()=>{
  const electron=weaponById("rifle_electron");
  test("conventional magazine upgrades never modify heat weapons",()=>{
    expect(compatibleAttachments(electron.id,"magazine")).not.toContain("mag_extended");
    expect(compatibleAttachments(electron.id,"magazine")).toContain("mag_heat_reservoir");
    const base=computeEffectiveStats(electron,empty);
    expect(computeEffectiveStats(electron,withAttachment("magazine","mag_extended")).magSize).toBe(base.magSize);
  });
  test("heat reservoir extends a firing string and slows passive cooling",()=>{
    const a=effectiveHeatConfig(electron,empty)!,b=effectiveHeatConfig(electron,withAttachment("magazine","mag_heat_reservoir"))!;
    expect(b.heatPerShot).toBeLessThan(a.heatPerShot);
    expect(b.coolPerSecond).toBeLessThan(a.coolPerSecond);
    const fromCold=(cfg:typeof a)=>{
      let s=freshHeat(),count=0;
      while(count<200){const next=addHeat(s,cfg,1000+count*5);if(!next)break;s=next;count++}
      return count;
    };
    expect(fromCold(b)).toBeGreaterThan(fromCold(a));
  });
  test("cooling and vent modules alter actual heat config used by shared mechanic",()=>{
    const base=effectiveHeatConfig(electron,empty)!;
    const cooling=effectiveHeatConfig(electron,withAttachment("magazine","mag_heat_coolant"))!;
    const vent=effectiveHeatConfig(electron,withAttachment("magazine","mag_heat_quickvent"))!;
    expect(cooling.coolPerSecond).toBeGreaterThan(base.coolPerSecond);
    expect(vent.ventSeconds).toBeLessThan(base.ventSeconds);
    expect(vent.heatPerShot).toBeGreaterThan(base.heatPerShot);
    const old={heat:70,lastShotAt:0,locked:false};
    expect(coolHeat(old,cooling,1,1500).heat).toBeLessThan(coolHeat(old,base,1,1500).heat);
  });
  test("heat-only modules are never offered on ordinary guns",()=>{
    const rifle=weaponById("rifle_ar");
    for(const att of ATTACHMENTS.filter(a=>a.heatOnly)){
      expect(compatibleAttachments(rifle.id,att.slot)).not.toContain(att.id);
      const s=computeEffectiveStats(rifle,withAttachment(att.slot,att.id));
      expect(s.damage).toBe(rifle.stats.damage);
    }
  });
});
