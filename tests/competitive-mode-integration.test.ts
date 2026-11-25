import {describe,expect,test} from "bun:test";
import {MAP_LIST,mapAllowedForMode,DEFAULT_CONFIG} from "../src/lib/game-protocol";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";
import {botPositionEmbedded} from "../src/lib/bot-physics";
import {featureBoxes} from "../src/lib/map-blueprints";

describe("new competitive mode integration",()=>{
  const dustwater=MAP_LIST.find(map=>map.id==="dustwater")!;
  test("Dustwater is a validated published map and supports all three modes",()=>{
    expect(dustwater).toBeDefined();
    expect(validateMapDocument(MAP_DOCUMENTS.dustwater)).toEqual([]);
    for(const mode of ["searchdestroy","hardpoint","frontier"] as const)
      expect(mapAllowedForMode(mode,"dustwater")).toBe(true);
    expect(mapAllowedForMode("searchdestroy","compound")).toBe(true);
    expect(mapAllowedForMode("searchdestroy","skybridge")).toBe(true);
    expect(mapAllowedForMode("hardpoint","compound")).toBe(false);
    expect(mapAllowedForMode("frontier","compound")).toBe(false);
  });
  test("bomb sites and all five Hardpoint hills are accessible inside the boomtown",()=>{
    const objectives:[number,number,number][]=[
      [-42,0,-40],[42,0,-40],
      [-20,0,-34],[20,0,-34],[0,0,8],[-42,0,40],[42,0,40],
    ];
    for(const point of objectives){
      expect(botPositionEmbedded(dustwater.cover,point)).toBe(false);
      expect(dustwater.regions?.some(r=>Math.abs(point[0]-r.x)<=r.w/2&&Math.abs(point[2]-r.z)<=r.d/2)).toBe(true);
    }
  });
  test("Dustwater interiors and vertical routes are physically accessible",()=>{
    const buildings=MAP_DOCUMENTS.dustwater.theme.props.filter(prop=>prop.kind==="building");
    expect(buildings).toHaveLength(4);
    expect(buildings.every(prop=>prop.roofAccess===true)).toBe(true);
    const platform=MAP_DOCUMENTS.dustwater.blueprint.features.find(feature=>feature.id==="water-tower-platform");
    const stair=MAP_DOCUMENTS.dustwater.blueprint.features.find(feature=>feature.id==="water-tower-staircase");
    expect(platform).toBeDefined();
    expect(stair).toMatchObject({kind:"stairs",h:5.4,axis:"x",sign:1});
    const steps=featureBoxes(stair!);
    expect(steps.length).toBeGreaterThan(10);
    const landing=steps[steps.length-1];
    expect(landing.pos[1]+landing.size[1]).toBeCloseTo((platform!.y??0)+platform!.h,1);
    expect(Math.abs(landing.pos[0]-platform!.x)).toBeLessThan(platform!.w/2+landing.size[0]);
    expect(MAP_DOCUMENTS.dustwater.blueprint.features.some(feature=>feature.kind==="platform"&&(feature.y??0)+feature.h>=5.39)).toBe(true);
    const interiorIds=MAP_DOCUMENTS.dustwater.blueprint.features.map(feature=>feature.id);
    for(const id of ["saloon-bar-counter","saloon-poker-table","sheriff-cell-left","sheriff-cell-right",
      "bank-vault-back","bank-vault-side-left","bank-vault-side-right","depot-cargo-crate-a","depot-cargo-crate-b"])
      expect(interiorIds).toContain(id);
  });
  test("mode defaults use the specified competitive match limits",()=>{
    expect(DEFAULT_CONFIG("searchdestroy",8)).toMatchObject({scoreLimit:0,timeLimit:0});
    expect(DEFAULT_CONFIG("hardpoint",8)).toMatchObject({scoreLimit:200,timeLimit:600});
    expect(DEFAULT_CONFIG("frontier",8)).toMatchObject({scoreLimit:75,timeLimit:600});
  });
});
