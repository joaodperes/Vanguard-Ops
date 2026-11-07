import { describe, expect, test } from "bun:test";
import {
  BALLISTIC_MATERIALS, MAX_PENETRATED_SURFACES, coverDamageScaleAt,
  selectMaterialPenetrationHits, traceCoverPenetration,
} from "../src/lib/cover-penetration";
import { weaponById, computeEffectiveStats, type AttachmentSlot } from "../src/lib/game-data";
import { featureBoxes } from "../src/lib/map-blueprints";
import { MAP_DOCUMENTS, validateMapDocument } from "../src/lib/map-documents";
import { getMap } from "../src/lib/game-protocol";
import type { CoverBox, Vec3 } from "../src/lib/game-protocol";

const origin: Vec3 = [0, 1.3, 0], dir: Vec3 = [0, 0, 1];
const flat = {sight:null,barrel:null,grip:null,magazine:null} satisfies Record<AttachmentSlot,string|null>;
const wall = (z:number,material?:CoverBox["material"],depth=.4,kind:CoverBox["kind"]="cover"):CoverBox =>
  ({pos:[0,1.3,z],size:[5,1.3,depth/2],kind,material});
const hit = (target:string,t:number,shield=false,protectedHit=false) =>
  ({target,t,head:false,shield,protected:protectedHit});

describe("material-based cover penetration",()=>{
  test("explicit material list and weapon energy are defined for the intended conventional classes",()=>{
    expect(BALLISTIC_MATERIALS).toContain("glass");
    for(const id of ["rifle_dm","dmr_cyclone","dmr_heavy","sniper_lr","sniper_heavy","lmg_light","lmg_heavy"]){
      expect(weaponById(id).stats.coverPenetration).toBeGreaterThan(0);
    }
    for(const id of ["rifle_ar","pistol_side","smg_vector","shotgun_auto"]){
      expect(weaponById(id).stats.coverPenetration ?? 0).toBe(0);
    }
    expect(weaponById("sniper_heavy").stats.coverPenetration)
      .toBeGreaterThan(weaponById("dmr_cyclone").stats.coverPenetration ?? 0);
  });

  test("ordinary bullets stop even at thin cover; heavy rounds pass with reduced damage",()=>{
    const boxes=[wall(5,"thin_wood",.6)],targets=[hit("behind",8)];
    expect(selectMaterialPenetrationHits(targets,boxes,origin,dir,40)).toEqual([]);
    const hits=selectMaterialPenetrationHits(targets,boxes,origin,dir,40,undefined,2);
    expect(hits.map(h=>h.target)).toEqual(["behind"]);
    expect(hits[0].damageScale).toBeGreaterThan(0);
    expect(hits[0].damageScale).toBeLessThan(.75);
    expect(selectMaterialPenetrationHits([hit("ahead",3),...targets],boxes,origin,dir,40,undefined,2)
      .map(h=>h.target)).toEqual(["ahead"]); // no body penetration by default
  });

  test("thick and reinforced cover stay safe, including untagged walls, roofs and environment barriers",()=>{
    const materials:(CoverBox["material"]|undefined)[]=[undefined,"concrete","reinforced"];
    for(const mat of materials)
      expect(selectMaterialPenetrationHits([hit("target",8)],[wall(5,mat)],origin,dir,40,undefined,6)).toEqual([]);
    expect(selectMaterialPenetrationHits([hit("target",8)],[wall(5,"glass",.3,"solid")],origin,dir,40,undefined,6)).toEqual([]);
    expect(selectMaterialPenetrationHits([hit("target",8)],[{...wall(5,"thin_wood"),environmentId:"breakable_1"}],origin,dir,40,undefined,6)).toEqual([]);
    expect(selectMaterialPenetrationHits([hit("target",8)],[wall(5,"thin_wood",10)],origin,dir,40,undefined,2)).toEqual([]);
  });

  test("normal-incidence glass and sheet metal require different penetration budgets",()=>{
    const glass=traceCoverPenetration([wall(5,"glass",.6)],origin,dir,40,.5);
    expect(glass.blockedAt).toBe(Infinity);
    const metal=traceCoverPenetration([wall(5,"sheet_metal",.6)],origin,dir,40,.5);
    expect(Number.isFinite(metal.blockedAt)).toBe(true);
    const strong=traceCoverPenetration([wall(5,"sheet_metal",.6)],origin,dir,40,2);
    expect(coverDamageScaleAt(strong,7)).toBeLessThan(coverDamageScaleAt(glass,7));
  });

  test("oblique traversal consumes more energy than a perpendicular hit",()=>{
    const sheet=wall(5,"sheet_metal",.6);
    const oblique:Vec3=[Math.sqrt(.75),0,.5];
    const atOblique:Vec3=[-10,1.3,0];
    const centered:CoverBox={...sheet,pos:[0,1.3,5],size:[20,1.3,.3]};
    expect(traceCoverPenetration([sheet],origin,dir,40,1).blockedAt).toBe(Infinity);
    expect(traceCoverPenetration([centered],atOblique,oblique,40,1).blockedAt).not.toBe(Infinity);
  });

  test("damage is multiplicative through layers and stops after two penetrable surfaces",()=>{
    const boxes=[wall(4,"glass",.4),wall(6,"thin_wood",.4)];
    const trace=traceCoverPenetration(boxes,origin,dir,20,4);
    expect(trace.crossings).toHaveLength(2);
    expect(coverDamageScaleAt(trace,3)).toBe(1);
    expect(coverDamageScaleAt(trace,5)).toBeLessThan(1);
    expect(coverDamageScaleAt(trace,9)).toBeLessThan(coverDamageScaleAt(trace,5));
    const three=traceCoverPenetration([...boxes,wall(8,"glass",.4)],origin,dir,20,4);
    expect(three.crossings).toHaveLength(MAX_PENETRATED_SURFACES);
    expect(three.blockedAt).toBeGreaterThan(7);
    expect(selectMaterialPenetrationHits([hit("late",10)],[...boxes,wall(8,"glass",.4)],origin,dir,20,undefined,4)).toEqual([]);
  });

  test("body chaining still works after cover, but shields and spawn protection stop it",()=>{
    const cover=[wall(4,"glass",.4)];
    const body={maxTargets:3,damageRetention:.5};
    const contacts=[hit("front",7),hit("second",10),hit("third",13)];
    const hits=selectMaterialPenetrationHits(contacts,cover,origin,dir,40,body,2);
    expect(hits.map(h=>h.target)).toEqual(["front","second","third"]);
    expect(hits[1].damageScale).toBeCloseTo(hits[0].damageScale*.5);
    const shielded=selectMaterialPenetrationHits([contacts[0],hit("shield",10,true),contacts[2]],cover,origin,dir,40,body,2);
    expect(shielded.map(h=>h.target)).toEqual(["front","shield"]);
    expect(selectMaterialPenetrationHits([hit("immune",7,false,true),contacts[1]],cover,origin,dir,40,body,2)
      .map(h=>h.target)).toEqual(["immune"]);
  });

  test("Penetrator Rounds grant only modest additional cover power without increasing base damage",()=>{
    const weapon=weaponById("rifle_ar");
    const base=computeEffectiveStats(weapon,flat);
    const round=computeEffectiveStats(weapon,{...flat,magazine:"mag_penetrator"});
    expect(base.coverPenetration ?? 0).toBe(0);
    expect(round.coverPenetration).toBeGreaterThan(0);
    expect(round.damage).toBeLessThan(base.damage);
    expect(round.bodyPenetration?.maxTargets).toBe(2);
    const heavy=weaponById("sniper_lr");
    const boosted=computeEffectiveStats(heavy,{...flat,magazine:"mag_penetrator"});
    expect(boosted.coverPenetration).toBeGreaterThan(heavy.stats.coverPenetration ?? 0);
  });

  test("published material tags survive blueprint compilation and invalid document tags are rejected",()=>{
    const shipped=["bunker","shipyard","skybridge","orbital_nexus","floodgate"];
    for(const id of shipped){
      const doc=MAP_DOCUMENTS[id];
      const marked=doc.blueprint.features.filter(f=>f.material&&f.material!=="concrete");
      expect(marked.length).toBeGreaterThan(0);
      expect(validateMapDocument(doc)).toEqual([]);
      for(const feature of marked){
        const boxes=featureBoxes(feature);
        expect(boxes[0].material).toBe(feature.material);
        const published=getMap(id);
        expect(published.cover.some(c=>c.material===feature.material
          && Math.abs(c.pos[0]-feature.x)<.01 && Math.abs(c.pos[2]-feature.z)<.01)).toBe(true);
      }
    }
    const wrong=structuredClone(MAP_DOCUMENTS.shipyard);
    wrong.blueprint.features[0].material="unobtanium" as never;
    expect(validateMapDocument(wrong).some(s=>s.includes("ballistic material"))).toBe(true);
  });
});
