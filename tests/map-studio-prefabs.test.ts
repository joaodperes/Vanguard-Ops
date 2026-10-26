import {describe,expect,test} from "bun:test";
import {STUDIO_BUILDING_PRESETS,studioBuildingPrefab} from "../src/lib/map-studio-prefabs";
import {cityBuildingBoxes,cityInteriorFixtures} from "../src/lib/map-visuals";

describe("Map Studio Quick Build building presets",()=>{
  test("offers different recognizable layouts and elevations",()=>{
    expect(STUDIO_BUILDING_PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(STUDIO_BUILDING_PRESETS.map(p=>p.use)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(STUDIO_BUILDING_PRESETS.map(p=>p.shape)).size).toBe(3);
    expect(new Set(STUDIO_BUILDING_PRESETS.map(p=>p.w+":"+p.d+":"+p.h)).size).toBeGreaterThanOrEqual(6);
  });
  test("placed presets serialize to ordinary MapProps with shared colliders",()=>{
    for(const preset of STUDIO_BUILDING_PRESETS){
      const prop=studioBuildingPrefab(preset.id,72,-90);
      expect(prop.kind).toBe("building");
      expect(prop.x).toBe(72);expect(prop.z).toBe(-90);
      expect(prop.use).toBe(preset.use);
      const boxes=cityBuildingBoxes(prop);
      expect(boxes.length).toBeGreaterThan(6);
      expect(boxes.some(b=>b.kind==="cover")).toBe(true);
      expect(cityInteriorFixtures(prop).length).toBeGreaterThan(0);
      expect(boxes.every(b=>Number.isFinite(b.pos[0])&&Number.isFinite(b.pos[1])&&Number.isFinite(b.pos[2]))).toBe(true);
    }
  });
  test("roof access can be disabled and is respected by physics",()=>{
    const withAccess=studioBuildingPrefab("house",60,60);
    const noAccess={...withAccess,roofAccess:false};
    const stairs=cityBuildingBoxes(withAccess).filter(b=>b.kind==="stair").length;
    expect(stairs).toBeGreaterThan(0);
    expect(cityBuildingBoxes(noAccess).filter(b=>b.kind==="stair").length).toBe(0);
  });
});
