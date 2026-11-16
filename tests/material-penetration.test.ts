import {describe,expect,test} from "bun:test";
import {coverDamageScaleAt,selectMaterialPenetrationHits,traceCoverPenetration,MAX_PENETRATED_SURFACES} from "../src/lib/cover-penetration";
import {featureBoxes} from "../src/lib/map-blueprints";
import {getMap,type CoverBox,type Vec3} from "../src/lib/game-protocol";
import {weaponById,computeEffectiveStats} from "../src/lib/game-data";
import {validateMapDocument,MAP_DOCUMENTS} from "../src/lib/map-documents";

const origin:Vec3=[0,1,0],dir:Vec3=[0,0,1];
const box=(z:number,material:CoverBox["material"],depth=.5,other:Partial<CoverBox>={}):CoverBox=>({
  pos:[0,1,z],size:[10,1,depth/2],kind:"cover",material,...other,
});
const contacts=[{target:"near",t:2,head:false},{target:"far",t:8,head:false}];

describe("authored cover material penetration",()=>{
  test("untagged cover, concrete, reinforced and structural platforms stay fully protective",()=>{
    for(const surface of [undefined,"concrete","reinforced"] as const){
      const trace=traceCoverPenetration([box(4,surface)],origin,dir,100,6);
      expect(trace.blockedAt).toBeCloseTo(3.75);
      expect(coverDamageScaleAt(trace,8)).toBe(0);
    }
    for(const kind of ["platform","solid","stair"] as const){
      expect(traceCoverPenetration([box(4,"glass",.5,{kind})],origin,dir,100,6).blockedAt).toBeCloseTo(3.75);
    }
    // Even a light material on a destructible environment box is not bullet-proof bypassable.
    expect(traceCoverPenetration([box(4,"glass",.5,{environmentId:"wall"})],origin,dir,100,6).blockedAt)
      .toBeCloseTo(3.75);
  });

  test("glass, wood, sheet metal and light barricades lose damage after EXITING cover",()=>{
    for(const material of ["glass","thin_wood","sheet_metal","light_cover"] as const){
      const trace=traceCoverPenetration([box(4,material)],origin,dir,100,4);
      expect(trace.blockedAt).toBe(Infinity);
      expect(coverDamageScaleAt(trace,3)).toBe(1);
      expect(coverDamageScaleAt(trace,4)).toBe(0); // no hit through the inside of a wall
      expect(coverDamageScaleAt(trace,8)).toBeGreaterThan(0);
      expect(coverDamageScaleAt(trace,8)).toBeLessThan(1);
    }
  });

  test("materials consume different penetration budgets and thick barriers remain safe",()=>{
    expect(traceCoverPenetration([box(4,"glass",1)],origin,dir,50,.5).blockedAt).toBe(Infinity);
    expect(traceCoverPenetration([box(4,"thin_wood",1)],origin,dir,50,.5).blockedAt).toBeCloseTo(3.5);
    expect(traceCoverPenetration([box(4,"sheet_metal",1)],origin,dir,50,1.3).blockedAt).toBeCloseTo(3.5);
    expect(traceCoverPenetration([box(4,"sheet_metal",1)],origin,dir,50,1.5).blockedAt).toBe(Infinity);
    expect(traceCoverPenetration([box(4,"thin_wood",8)],origin,dir,50,4).blockedAt).toBe(0); // origin inside wall is blocked
    expect(traceCoverPenetration([box(10,"thin_wood",8)],origin,dir,50,4).blockedAt).toBe(6);
  });

  test("oblique shots cross more material than straight shots",()=>{
    const sheet=box(5,"sheet_metal",.8);
    expect(traceCoverPenetration([sheet],origin,dir,100,1.6).blockedAt).toBe(Infinity);
    const angled:Vec3=[.8,0,.6];
    expect(traceCoverPenetration([sheet],origin,angled,100,1.6).blockedAt).toBeGreaterThan(0);
    expect(traceCoverPenetration([sheet],origin,angled,100,1.6).blockedAt).toBeLessThan(Infinity);
  });

  test("shared cover energy is cumulative, with at most two thin surfaces crossed",()=>{
    const walls=[box(3,"thin_wood"),box(5,"thin_wood"),box(7,"thin_wood")];
    const trace=traceCoverPenetration(walls,origin,dir,100,4);
    expect(trace.crossings.length).toBe(MAX_PENETRATED_SURFACES);
    expect(trace.blockedAt).toBeCloseTo(6.75);
    expect(coverDamageScaleAt(trace,6)).toBeGreaterThan(0);
    expect(coverDamageScaleAt(trace,8)).toBe(0);
    const insufficient=traceCoverPenetration(walls.slice(0,2),origin,dir,100,.6);
    expect(insufficient.crossings.length).toBe(1);
    expect(insufficient.blockedAt).toBeCloseTo(4.75);
  });

  test("cover damage loss compounds with body-to-body retention and honors target limit",()=>{
    const gun=weaponById("sniper_heavy");
    const hits=selectMaterialPenetrationHits(contacts,[box(4,"thin_wood")],origin,dir,100,
      gun.stats.bodyPenetration,gun.stats.coverPenetration);
    expect(hits.map(h=>h.target)).toEqual(["near","far"]);
    expect(hits[0].damageScale).toBe(1);
    expect(hits[1].damageScale).toBeGreaterThan(0);
    expect(hits[1].damageScale).toBeLessThan(gun.stats.bodyPenetration!.damageRetention);
    const ordinary=selectMaterialPenetrationHits(contacts,[box(4,"glass")],origin,dir,100,undefined,0);
    expect(ordinary.map(h=>h.target)).toEqual(["near"]);
    expect(selectMaterialPenetrationHits([{target:"behind",t:8,head:false}],[box(4,"glass")],origin,dir,100,undefined,0)).toEqual([]);
  });

  test("intact riot shield and spawn immunity absorb the round after cover",()=>{
    const gun=weaponById("sniper_heavy");
    for(const blocker of [{shield:true},{protected:true}]){
      const hits=selectMaterialPenetrationHits([
        {target:"shield",t:5,head:false,...blocker},
        {target:"back",t:8,head:false},
      ],[box(3,"glass")],origin,dir,100,gun.stats.bodyPenetration,gun.stats.coverPenetration);
      expect(hits.map(h=>h.target)).toEqual(["shield"]);
    }
  });

  test("weapon classes and magazine upgrades have intentional limits",()=>{
    expect(weaponById("sniper_heavy").stats.coverPenetration).toBeGreaterThan(weaponById("dmr_scout").stats.coverPenetration!);
    expect(weaponById("lmg_hv").stats.coverPenetration).toBeGreaterThan(0);
    expect(weaponById("rifle_ar").stats.coverPenetration).toBeCloseTo(1);
    expect(weaponById("wonder_singularity").stats.coverPenetration).toBeUndefined();
    const empty={sight:null,barrel:null,grip:null,magazine:null};
    expect(computeEffectiveStats(weaponById("rifle_ar"),empty).coverPenetration).toBeCloseTo(1);
    expect(computeEffectiveStats(weaponById("rifle_ar"),{...empty,magazine:"mag_penetrator"}).coverPenetration).toBeCloseTo(1.6);
    expect(computeEffectiveStats(weaponById("sniper_heavy"),{...empty,magazine:"mag_penetrator"}).coverPenetration)
      .toEqual(weaponById("sniper_heavy").stats.coverPenetration); // ineligible ammo never applies
  });

  test("blueprint material metadata survives compilation and official map loading",()=>{
    const boxes=featureBoxes({id:"panel",kind:"cover",x:0,z:4,w:5,d:.5,h:3,material:"glass"});
    expect(boxes).toHaveLength(1);
    expect(boxes[0].material).toBe("glass");
    const nexus=getMap("orbital_nexus");
    expect(nexus.cover.some(c=>c.material==="glass")).toBe(true);
    expect(nexus.cover.some(c=>c.material==="sheet_metal")).toBe(true);
    expect(nexus.cover.some(c=>!c.material)).toBe(true);
  });

  test("invalid material and material on stairs fail authored document validation",()=>{
    const doc=structuredClone(MAP_DOCUMENTS.bunker);
    doc.blueprint.features[0].material="glass";
    doc.blueprint.features[0].kind="stairs";
    expect(validateMapDocument(doc).some(x=>x.includes("ballistic material"))).toBe(true);
    const other=structuredClone(MAP_DOCUMENTS.bunker);
    other.blueprint.features[0].material="adamantium" as any;
    expect(validateMapDocument(other).some(x=>x.includes("ballistic material"))).toBe(true);
  });
});
