import { describe,test,expect } from "bun:test";
import { MAP_BLUEPRINTS,validateBlueprint,insideRegions,regionBoundary,featureBoxes,nextRegionPortal } from "../src/lib/map-blueprints";
import { MAPS } from "../src/lib/game-protocol";
describe("JSON map blueprints",()=>{
  test("built-in maps pass geometry and spawn validation",()=>{
    for(const [id,b] of Object.entries(MAP_BLUEPRINTS.maps)){
      expect(validateBlueprint(b)).toEqual([]);
      expect(MAPS[id].regions?.length).toBe(b.regions.length);
      expect(regionBoundary(b.regions).length).toBeGreaterThan(4);
      for(const p of Object.values(b.spawns).flat())expect(insideRegions(p[0],p[2],b.regions,1.1)).toBe(true);
    }
  });
  test("shared overlap creates no interior wall",()=>{
    const r=[{x:0,z:0,w:20,d:20},{x:14,z:0,w:20,d:12}],walls=regionBoundary(r);
    expect(walls.some(w=>w.pos[0]===10&&w.pos[2]===0)).toBe(false);
    expect(walls.some(w=>w.pos[0]===24)).toBe(true);
    expect(insideRegions(16,0,r)).toBe(true);
  });
  test("platforms create two walkable stair flights",()=>{
    const boxes=featureBoxes({id:"p",kind:"platform",x:0,z:0,w:12,d:12,h:4.2});
    const stairs=boxes.filter(b=>b.kind==="stair");
    expect(stairs.length).toBe(20);
    expect(stairs.some(b=>b.pos[2]>6)).toBe(true);
    expect(stairs.some(b=>b.pos[2]<-6)).toBe(true);
    const tops=[...new Set(stairs.filter(s=>s.pos[2]>0).map(s=>+(s.pos[1]+s.size[1]).toFixed(3)))].sort((a,b)=>a-b);
    expect(tops.every((v,i)=>i===0||v-tops[i-1]<=0.55)).toBe(true);
  });
  test("large cross-district paths use local region portals",()=>{
    const b=MAP_BLUEPRINTS.maps.skybridge;
    const p=nextRegionPortal([-108,0,-5],[108,0,-5],b.regions);
    expect(p).not.toBeNull();
    expect(insideRegions(p![0],p![2],b.regions)).toBe(true);
  });
});
