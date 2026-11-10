import {describe,expect,test} from "bun:test";
import {BALLISTIC_MATERIALS,traceCoverPenetration} from "../src/lib/cover-penetration";
import {MAP_LIST,getMap,type CoverBox,type Vec3} from "../src/lib/game-protocol";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";
import {authoredBallisticCover,coverMaxIntegrity} from "../src/lib/material-cover-damage";
import {cityBuildingBoxes,cityFixtureMaterial,mapPropBallisticId,propColliders} from "../src/lib/map-visuals";
import {FOREST_OBJECTS,FOREST_WARFARE_COVER,forestLogCoverId} from "../src/lib/forest-warfare";
import {STUDIO_ASSETS,instantiateStudioAsset,importStudioAssets} from "../src/lib/map-studio-assets";
import {studioStructurePrefab,STUDIO_STRUCTURE_PRESETS} from "../src/lib/map-studio-prefabs";

const SOFT=new Set(["thin_wood","glass","light_cover","sheet_metal"]);
const names=MAP_LIST.map(m=>m.id);

describe("all-map material authoring contract",()=>{
  test("every published JSON cover explicitly declares an allowed ballistic material",()=>{
    for(const [id,doc] of Object.entries(MAP_DOCUMENTS)){
      const features=doc.blueprint.features.filter(f=>f.kind==="cover");
      for(const feature of features)
        expect(BALLISTIC_MATERIALS).toContain(feature.material);
      const errors=validateMapDocument(doc);
      expect(errors.filter(e=>e.includes("ballistic material"))).toEqual([]);
      expect(doc.id).toBe(id);
    }
  });

  test("a newly imported cover with omitted or invalid material is rejected",()=>{
    const doc=structuredClone(MAP_DOCUMENTS.bunker);
    const cover=doc.blueprint.features.find(f=>f.kind==="cover");
    if(!cover)throw Error("Bunker requires at least one cover feature");
    cover.material=undefined;
    expect(validateMapDocument(doc).some(e=>e.includes("Missing ballistic material"))).toBe(true);
    cover.material="thin_wood";
    expect(validateMapDocument(doc).some(e=>e.includes("Missing ballistic material"))).toBe(false);
  });

  test("every compiled static cover (including procedural props and legacy walls) is typed",()=>{
    expect(names).toHaveLength(11);
    for(const map of MAP_LIST){
      const covers=map.cover.filter(c=>(c.kind??"cover")==="cover"&&!c.environmentId);
      expect(covers.length).toBeGreaterThan(0);
      for(const box of covers){
        expect(BALLISTIC_MATERIALS).toContain(box.material);
        if(SOFT.has(box.material??""))expect(box.ballisticId).toBeTruthy();
        if(box.ballisticId)expect(box.kind).toBe("cover");
      }
      const ids=authoredBallisticCover(map.cover).map(c=>c.ballisticId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("indestructible heavy cover stays protective even when named or visually decorated",()=>{
    const stone=getMap("emberhold").cover.find(c=>c.ballisticId==="donjon-wall-west"||
      c.material==="reinforced"&&c.size[0]>.3&&c.size[1]>1);
    if(!stone)throw Error("Missing castle masonry");
    expect(coverMaxIntegrity(stone.material)).toBeNull();
    const origin:Vec3=[stone.pos[0]-stone.size[0]-3,stone.pos[1],stone.pos[2]];
    const hit=traceCoverPenetration([stone],origin,[1,0,0],20,15);
    expect(Number.isFinite(hit.blockedAt)).toBe(true);
  });

  test("thin roof panels and metal guardrails use the same cross-map penetration rules",()=>{
    for(const [mapId,featureId] of [
      ["whiteout_depot","west-shed-roof"],
      ["whiteout_depot","platform-canopy-0"],
      ["floodgate","turbine-roof-27"],
      ["skybridge","gantry-north-railing"],
    ] as const){
      const b=getMap(mapId).cover.find(c=>c.ballisticId===featureId);
      expect(b?.material).toBe("sheet_metal");
      if(!b)continue;
      const o:Vec3=[b.pos[0],b.pos[1]+b.size[1]+2,b.pos[2]];
      expect(traceCoverPenetration([b],o,[0,-1,0],50,10).crossings).toHaveLength(1);
      expect(coverMaxIntegrity(b.material)).toBeNull();
    }
  });

  test("crates and heavy cargo are intentionally distinct, not materialized from textures",()=>{
    expect(getMap("skybridge").cover.find(c=>c.ballisticId==="forge-crates")?.material).toBe("light_cover");
    expect(getMap("skybridge").cover.find(c=>c.ballisticId==="steel-crate-1")?.material).toBe("reinforced");
    expect(getMap("shipyard").cover.find(c=>c.ballisticId==="fish-market-stalls")?.material).toBe("thin_wood");
    expect(getMap("orbital_nexus").cover.find(c=>c.ballisticId==="red-baffle-n")?.material).toBe("glass");
    expect(getMap("whiteout_depot").cover.find(c=>c.ballisticId==="gallery-west-crates")?.material).toBe("light_cover");
  });

  test("all industrial pallet decorations have collision; unmodeled Whiteout pallets are breakable",()=>{
    for(const id of ["whiteout_depot","skybridge","floodgate"] as const){
      const map=getMap(id);
      const pallets=(map.props??[]).filter(p=>p.kind==="cargo_pallet");
      expect(pallets.length).toBeGreaterThan(0);
      for(const p of pallets){
        const boxes=map.cover.filter(b=>(b.kind??"cover")==="cover"&&
          Math.abs(b.pos[0]-p.x)<.1&&Math.abs(b.pos[2]-p.z)<.1);
        expect(boxes.length).toBeGreaterThan(0);
        if(id==="whiteout_depot"){
          expect(boxes.some(b=>b.ballisticId===mapPropBallisticId(p) &&
            b.material==="light_cover")).toBe(true);
        }
      }
    }
  });

  test("Afterlight city fixtures and benches have deterministic, destructible material IDs",()=>{
    for(const id of ["terminal","arena_neon"] as const){
      const map=getMap(id);
      const buildings=(map.props??[]).filter(p=>p.kind==="building");
      expect(buildings.length).toBeGreaterThan(0);
      for(const building of buildings){
        const boxes=cityBuildingBoxes(building);
        expect(boxes.some(b=>b.material==="reinforced")).toBe(true);
        expect(boxes.some(b=>b.ballisticId?.startsWith("city:fixture:"))).toBe(true);
        for(const box of boxes.filter(b=>SOFT.has(b.material??"")))
          expect(box.ballisticId).toBeTruthy();
      }
      const benches=(map.props??[]).filter(p=>p.kind==="bench");
      for(const bench of benches)
        expect(map.cover.some(c=>c.ballisticId===mapPropBallisticId(bench)&&
          c.material==="thin_wood")).toBe(true);
    }
    expect(cityFixtureMaterial("partition")).toBe("light_cover");
    expect(cityFixtureMaterial("table")).toBe("thin_wood");
    expect(cityFixtureMaterial("server_rack")).toBe("reinforced");
  });

  test("forest bushes no longer stop gunfire, fallen logs splinter, big trunks stay protective",()=>{
    const forest=getMap("forest_warfare");
    for(const p of FOREST_OBJECTS){
      if(p.kind==="log"){
        const b=forest.cover.find(c=>c.ballisticId===forestLogCoverId(p));
        expect(b?.material).toBe("thin_wood");
        expect(b?.size[1]).toBeCloseTo(.95);
      }else if(p.kind==="bush"){
        expect(FOREST_WARFARE_COVER.some(c=>Math.abs(c.pos[0]-p.x)<.01 &&
          Math.abs(c.pos[2]-p.z)<.01 && c.kind==="cover")).toBe(false);
      }
    }
    expect(forest.cover.some(c=>c.ballisticId?.startsWith("forest:parapet:") &&
      c.material==="thin_wood")).toBe(true);
  });

  test("stone ruins use open pillars rather than an invisible solid enclosure",()=>{
    const map=getMap("compound");
    const p=(map.props??[]).find(prop=>prop.kind==="ruin"||prop.kind==="temple");
    if(!p)throw Error("Compound should contain ruins");
    const colliders=propColliders([p],[]);
    expect(colliders).toHaveLength(5);
    expect(colliders.every(c=>c.material==="concrete")).toBe(true);
    const start:Vec3=[p.x,(p.y??0)+(p.h??3)*.4,p.z-30];
    expect(traceCoverPenetration(colliders,start,[0,0,1],60,20).blockedAt).toBe(Infinity);
  });

  test("all construction kit cover and asset recipes start with explicit materials",()=>{
    for(const preset of STUDIO_STRUCTURE_PRESETS)
      for(const f of studioStructurePrefab(preset.id,0,0).filter(f=>f.kind==="cover"))
        expect(BALLISTIC_MATERIALS).toContain(f.material);
    for(const asset of STUDIO_ASSETS)
      for(const f of asset.features.filter(f=>f.kind==="cover"))
        expect(BALLISTIC_MATERIALS).toContain(f.material);
    const old=[{id:"old",name:"Old wall",category:"My assets" as const,
      features:[{id:"panel",kind:"cover" as const,x:0,z:0,w:2,d:.4,h:3}],
      props:[]}];
    const imported=importStudioAssets({version:1,assets:old});
    expect(imported[0].features[0].material).toBe("reinforced");
    const placed=instantiateStudioAsset(imported[0],5,8,()=>"unique");
    expect(placed.features[0].material).toBe("reinforced");
  });
});
