import { describe, expect, test } from "bun:test";
import {
  WEAPONS, weaponById, compatibleAttachments, computeEffectiveStats,
  type AttachmentSlot,
} from "../src/lib/game-data";
import { burstShotIntervalMs } from "../src/lib/weapon-mechanics";
import { maxWeaponHitRange } from "../src/lib/game-data";
import { hitsToEliminate, idealTimeToKillMs } from "../src/lib/weapon-balance";

const empty: Record<AttachmentSlot,string|null> = { sight:null, barrel:null, grip:null, magazine:null };
const effective = (id:string,slot:AttachmentSlot|null=null,att:string|null=null) => {
  const w=weaponById(id);
  return computeEffectiveStats(w,slot?{...empty,[slot]:att}:empty);
};
const ttk = (id:string) => {
  const w=weaponById(id);
  return idealTimeToKillMs(w,effective(id));
};
describe("2026 weapon-role and burst TTK tuning",()=>{
  test("shared burst timing requires a deliberate headshot rather than a sub-40ms DMR double tap",()=>{
    expect(burstShotIntervalMs(8,"dmr")).toBeCloseTo(100,6);
    expect(burstShotIntervalMs(9,"assault")).toBeCloseTo(67.340,2);
    expect(burstShotIntervalMs(11,"assault")).toBeGreaterThan(50);
    expect(idealTimeToKillMs(weaponById("dmr_cyclone"),effective("dmr_cyclone"))).toBeCloseTo(225,3);
    expect(idealTimeToKillMs(weaponById("dmr_cyclone"),effective("dmr_cyclone"),0,1)).toBeCloseTo(225,3);
    expect(idealTimeToKillMs(weaponById("dmr_cyclone"),effective("dmr_cyclone"),0,2)).toBeCloseTo(100,3);
    expect(ttk("rifle_burst")).toBeCloseTo(245.79,1);
    expect(ttk("rifle_hydra")).toBeCloseTo(201.10,1);
    expect(idealTimeToKillMs(weaponById("rifle_burst"),effective("rifle_burst"),0,2)).toBeGreaterThan(130);
    // The new precision-burst identity is about mixed hits, not a two-headshot elimination.
    const reaver = effective("rifle_burst");
    expect(reaver.headshotMult).toBe(1.7);
    expect(reaver.damage * reaver.headshotMult + 2 * reaver.damage).toBeGreaterThanOrEqual(100);
    expect(reaver.damage * reaver.headshotMult * 2).toBeLessThan(100);
    expect(hitsToEliminate(reaver)).toBe(4);
    expect(hitsToEliminate(reaver, 0, 1)).toBe(3);
    expect(hitsToEliminate(reaver, 0, 2)).toBe(3);
  });
  test("baseline assault firepower is still useful without damage-buff attachments",()=>{
    expect(hitsToEliminate(effective("rifle_ar"))).toBe(3);
    expect(ttk("rifle_ar")).toBeCloseTo(222.22,1);
    expect(hitsToEliminate(effective("rifle_heavy"))).toBe(3);
    expect(hitsToEliminate(effective("rifle_falcon"))).toBe(2);
  });
  test("fast SMGs and flexible sustained-fire rifles no longer require seven/five shots",()=>{
    expect(hitsToEliminate(effective("smg_compact"))).toBe(4);
    expect(hitsToEliminate(effective("smg_vector"))).toBe(5);
    expect(ttk("smg_vector")).toBeCloseTo(250,3);
    expect(hitsToEliminate(effective("rifle_electron"))).toBe(4);
    expect(ttk("rifle_electron")).toBeCloseTo(1000/3,2);
    expect(ttk("lmg_heavy")).toBeCloseTo(250,3);
  });
  test("later pistols and compact PDWs occupy viable but different first-magazine profiles",()=>{
    const expected: Array<[string,number,number]> = [
      ["pistol_ghost",3,1000/3], ["pistol_bastion",2,1000/1.55],
      ["pistol_magnum",2,1000/2.3], ["pistol_burst",3,2*1000/(4*1.65)],
      ["pdw_mamba",6,5*1000/14], ["pdw_sentinel",3,2*1000/7.5],
      ["pistol_machine",5,4*1000/13],
    ];
    for(const [id,hits,ms] of expected) {
      expect(hitsToEliminate(effective(id))).toBe(hits);
      expect(ttk(id)).toBeCloseTo(ms,2);
    }
    const magnum=effective("pistol_magnum");
    const bastion=effective("pistol_bastion");
    expect(hitsToEliminate(magnum)).toBe(2);
    expect(magnum.damage*magnum.headshotMult).toBeGreaterThanOrEqual(100);
    expect(hitsToEliminate(magnum,0,1)).toBe(1);
    // Magnum's one-tap is precision-limited: its 31m full-damage range matters.
    expect(hitsToEliminate(magnum,32,1)).toBe(2);
    expect(bastion.damage*bastion.headshotMult).toBeLessThan(100);
    expect(hitsToEliminate(bastion,0,1)).toBe(2);
  });
  test("Arc Pistol fires faster without outpacing the P-9 and Ghost-18",()=>{
    const arc=effective("pistol_arc"),p9=effective("pistol_side"),ghost=effective("pistol_ghost");
    expect(arc.fireRate).toBe(4);
    expect(arc.fireRate).toBeLessThan(p9.fireRate);
    expect(p9.fireRate).toBeLessThan(ghost.fireRate);
    expect(hitsToEliminate(arc)).toBe(3);
    expect(ttk("pistol_arc")).toBeCloseTo(500,5);
    expect(weaponById("pistol_arc").special?.kind).toBe("arc");
    expect(weaponById("pistol_arc").special).toMatchObject({jumps:2,radius:6,decay:.55});
  });
  test("small suppressor and AP ammo penalties do not destroy core body breakpoints",()=>{
    for(const id of ["rifle_ar","dmr_scout","smg_compact","smg_vector","pistol_ghost","pistol_burst","pistol_bastion","pistol_magnum","pdw_sentinel"]){
      if(!compatibleAttachments(id,"barrel").includes("barrel_suppressor"))continue;
      expect(hitsToEliminate(effective(id,"barrel","barrel_suppressor"))).toBe(hitsToEliminate(effective(id)));
    }
    for(const id of ["rifle_ar","rifle_burst","rifle_heavy","lmg_heavy","dmr_scout"]){
      expect(compatibleAttachments(id,"magazine")).toContain("mag_penetrator");
      expect(hitsToEliminate(effective(id,"magazine","mag_penetrator"))).toBe(hitsToEliminate(effective(id)));
    }
    expect(effective("rifle_ar","magazine","mag_penetrator").bodyPenetration?.maxTargets).toBe(2);
  });
  test("damage falloff stops at the real collision range, not at an infinite damage floor",()=>{
    const w=weaponById("smg_vector");
    const far=maxWeaponHitRange(w.stats.range,w.stats);
    expect(hitsToEliminate(w.stats,far+0.01)).toBeNull();
    expect(idealTimeToKillMs(w,w.stats,far+0.01)).toBeNull();
    expect(hitsToEliminate(w.stats,0)).toBe(5);
  });
  test("every legal single attachment resolves nonnegative combat stats and sane TTK",()=>{
    for(const w of WEAPONS.filter(w=>!w.wonder&&!w.disabled&&!["melee","shotgun","launcher"].includes(w.category))){
      for(const slot of ["sight","barrel","grip","magazine"] as AttachmentSlot[]){
        for(const att of compatibleAttachments(w.id,slot)){
          const stats=computeEffectiveStats(w,{...empty,[slot]:att});
          expect(Number.isFinite(stats.damage)).toBe(true);
          expect(stats.damage).toBeGreaterThan(0);
          expect(stats.magSize).toBeGreaterThanOrEqual(1);
          expect(stats.range).toBeGreaterThan(0);
          expect(stats.fireRate).toBeGreaterThan(0);
          const hits=hitsToEliminate(stats,0);
          expect(hits).not.toBeNull();
          const time=idealTimeToKillMs(w,stats,0);
          if(time!==null)expect(Number.isFinite(time)).toBe(true);
        }
      }
    }
  });
});
