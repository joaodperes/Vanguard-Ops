import { describe, expect, test } from "bun:test";
import { resolveMaterialPenetrationShot, BODY_PENETRATION_ENERGY_COST, MAX_PENETRATED_BODIES, MAX_PENETRATED_SURFACES } from "../src/lib/cover-penetration";
import { damageBallisticCoverOnShot } from "../src/lib/material-cover-damage";
import { WEAPONS, weaponById, computeEffectiveStats } from "../src/lib/game-data";
import type { CoverBox, Vec3 } from "../src/lib/game-protocol";

const origin:Vec3=[0,1.2,0],dir:Vec3=[0,0,1];
const cover=(at:number,material:CoverBox["material"],depth:number,ballisticId?:string):CoverBox=>({
  kind:"cover",pos:[0,1.2,at],size:[3,1.2,depth/2],material,ballisticId,
});
const dummy=(at:number,id:string)=>({target:id,t:at,head:false});
const empty={sight:null,barrel:null,grip:null,magazine:null};

describe("unified ammunition penetration",()=>{
  test("ordinary firearm families have nonzero ratings, projectiles and wonder abilities keep their own rules",()=>{
    const conventional=WEAPONS.filter(w=>!w.wonder&&!w.special&&
      ["assault","smg","pdw","pistol","shotgun","dmr","sniper","lmg"].includes(w.category));
    expect(conventional.length).toBeGreaterThan(25);
    for(const gun of conventional){
      expect(gun.stats.coverPenetration).toBeGreaterThan(0);
      expect(gun.stats.coverPenetration).toBeLessThanOrEqual(6);
    }
    for(const id of ["wonder_riot_shield","wonder_singularity","launcher_rocket","crossbow_reclaimer","rifle_electron","pistol_arc"]){
      expect(weaponById(id).stats.coverPenetration).toBeUndefined();
    }
  });
  test("pistol crosses a thin glass screen but not thick wood; default rifle crosses both",()=>{
    const pistol=weaponById("pistol_side");
    const rifle=weaponById("rifle_ar");
    const glass=cover(5,"glass",.3);
    const wood=cover(5,"thin_wood",.8);
    const contacts=[dummy(8,"behind")];
    expect(resolveMaterialPenetrationShot(contacts,[glass],origin,dir,30,
      pistol.stats.bodyPenetration,pistol.stats.coverPenetration).hits.map(h=>h.target)).toEqual(["behind"]);
    expect(resolveMaterialPenetrationShot(contacts,[wood],origin,dir,30,
      pistol.stats.bodyPenetration,pistol.stats.coverPenetration).hits).toHaveLength(0);
    expect(resolveMaterialPenetrationShot(contacts,[wood],origin,dir,30,
      rifle.stats.bodyPenetration,rifle.stats.coverPenetration).hits).toHaveLength(1);
  });
  test("an ordinary VK-12 stops after the first body, while Penetrator Rounds reach the second",()=>{
    const base=computeEffectiveStats(weaponById("rifle_ar"),empty);
    const upgraded=computeEffectiveStats(weaponById("rifle_ar"),{...empty,magazine:"mag_penetrator"});
    const contacts=[dummy(4,"first"),dummy(8,"second"),dummy(12,"third")];
    const regular=resolveMaterialPenetrationShot(contacts,[],origin,dir,30,
      base.bodyPenetration,base.coverPenetration);
    const enhanced=resolveMaterialPenetrationShot(contacts,[],origin,dir,30,
      upgraded.bodyPenetration,upgraded.coverPenetration);
    expect(regular.hits.map(h=>h.target)).toEqual(["first"]);
    expect(regular.stoppedAt).toBe(4);
    expect(enhanced.hits.map(h=>h.target)).toEqual(["first","second"]);
    expect(enhanced.stoppedAt).toBe(8);
    expect(enhanced.hits[1].damageScale).toBeCloseTo(.35);
    expect(upgraded.damage).toBeLessThan(base.damage);
    expect(upgraded.magSize).toBeLessThan(base.magSize);
  });
  test("a preceding body consumes energy needed to pierce a metal screen",()=>{
    const power=1.6,metal=cover(6,"sheet_metal",.6);
    const contacts=[dummy(3,"near"),dummy(9,"behind")];
    const clean=resolveMaterialPenetrationShot([contacts[1]],[metal],origin,dir,20,undefined,power);
    expect(clean.hits.map(h=>h.target)).toEqual(["behind"]);
    const intercepted=resolveMaterialPenetrationShot(contacts,[metal],origin,dir,20,undefined,power);
    expect(intercepted.hits.map(h=>h.target)).toEqual(["near"]);
    expect(intercepted.stoppedAt).toBeCloseTo(5.7);
    expect(power-BODY_PENETRATION_ENERGY_COST).toBeLessThan(.6*1.42);
  });
  test("Annihilator crosses metal and aligned bodies, never concrete or more than three bodies",()=>{
    const w=weaponById("sniper_heavy");
    const contacts=[dummy(7,"one"),dummy(10,"two"),dummy(13,"three"),dummy(16,"four")];
    const metal=cover(4,"sheet_metal",.6);
    const shot=resolveMaterialPenetrationShot(contacts,[metal],origin,dir,30,
      w.stats.bodyPenetration,w.stats.coverPenetration);
    expect(shot.hits.map(h=>h.target)).toEqual(["one","two","three"]);
    expect(shot.hits[0].damageScale).toBeLessThan(1);
    expect(shot.hits[1].damageScale).toBeCloseTo(shot.hits[0].damageScale*.65);
    expect(shot.stoppedAt).toBe(13);
    expect(MAX_PENETRATED_BODIES).toBe(3);
    expect(MAX_PENETRATED_SURFACES).toBe(2);
    for(const material of ["concrete","reinforced",undefined] as const)
      expect(resolveMaterialPenetrationShot(contacts,[cover(4,material,.6)],origin,dir,30,
        w.stats.bodyPenetration,w.stats.coverPenetration).hits).toHaveLength(0);
  });
  test("stoppedAt ensures a body absorbs a shot before it can damage downstream cover",()=>{
    const c=cover(6,"glass",.3,"behind_glass");
    const gun=weaponById("rifle_ar");
    const stop=resolveMaterialPenetrationShot([dummy(3,"opponent")],[c],origin,dir,30,
      gun.stats.bodyPenetration,gun.stats.coverPenetration).stoppedAt;
    expect(stop).toBe(3);
    const map={cover:[c]} as import("../src/lib/game-protocol").MapDef;
    expect(damageBallisticCoverOnShot(map,new Map(),new Set(),origin,dir,30,
      gun.stats.coverPenetration!,gun.stats.damage,stop)).toEqual([]);
  });
  test("special piercing crossbow bolts retain two-body behavior without piercing walls",()=>{
    const bolt=computeEffectiveStats(weaponById("crossbow_reclaimer"),{
      ...empty,barrel:"barrel_bolt_piercing",
    });
    expect(bolt.coverPenetration).toBeUndefined();
    expect(bolt.bodyPenetration?.maxTargets).toBe(2);
    const bodies=[dummy(3,"first"),dummy(7,"second"),dummy(11,"third")];
    const open=resolveMaterialPenetrationShot(bodies,[],origin,dir,25,
      bolt.bodyPenetration,bolt.coverPenetration);
    expect(open.hits.map(h=>h.target)).toEqual(["first","second"]);
    const behindWall=resolveMaterialPenetrationShot(bodies,[cover(5,"glass",.3)],
      origin,dir,25,bolt.bodyPenetration,bolt.coverPenetration);
    expect(behindWall.hits.map(h=>h.target)).toEqual(["first"]);
  });
  test("slug ammo is a single better-penetrating projectile than eight ordinary pellets",()=>{
    const gun=weaponById("shotgun_br");
    const regular=computeEffectiveStats(gun,empty);
    const slug=computeEffectiveStats(gun,{...empty,magazine:"mag_slug"});
    expect(regular.coverPenetration).toBeGreaterThan(0);
    expect(slug.coverPenetration).toBeCloseTo((regular.coverPenetration??0)+.9);
    expect(regular.pellets).toBeGreaterThan(1);
    expect(slug.pellets).toBe(1);
    const wall=cover(5,"thin_wood",.9),contacts=[dummy(8,"target")];
    expect(resolveMaterialPenetrationShot(contacts,[wall],origin,dir,25,undefined,
      regular.coverPenetration).hits).toHaveLength(0);
    expect(resolveMaterialPenetrationShot(contacts,[wall],origin,dir,25,undefined,
      slug.coverPenetration).hits).toHaveLength(1);
  });
});
