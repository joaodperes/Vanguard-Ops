import { describe,expect,test } from "bun:test";
import { MAPS } from "../src/lib/game-protocol";
import { MAP_BLUEPRINTS,insideRegions } from "../src/lib/map-blueprints";
import { visualThemeForMap } from "../src/lib/map-visuals";

describe("Ridgefall factory redesign",()=>{
  const blueprint=MAP_BLUEPRINTS.maps.skybridge;
  const compiled=MAPS.skybridge;
  const theme=visualThemeForMap("skybridge");
  test("replaces outdoor skybridge geometry without changing the map ID",()=>{
    expect(compiled.id).toBe("skybridge");
    expect(compiled.name).toBe("RIDGEFALL");
    expect(compiled.biome).toBe("factory_interior");
    expect(compiled.editorLegacyCoverCount).toBe(0);
    expect(blueprint.regions.length).toBeGreaterThanOrEqual(5);
    expect(compiled.wallHeight).toBe(18);
    expect(compiled.spawns.ffa).toEqual(blueprint.spawns.ffa);
    expect(compiled.spawns.red).toEqual(blueprint.spawns.red);
    expect(compiled.spawns.blue).toEqual(blueprint.spawns.blue);
  });
  test("has raised factory gantries, barriers, loading bays and breachable security gate",()=>{
    expect(blueprint.features.filter(f=>f.kind==="platform").length).toBeGreaterThanOrEqual(4);
    expect(blueprint.features.filter(f=>f.kind==="stairs").length).toBeGreaterThanOrEqual(4);
    expect(blueprint.features.some(f=>f.kind==="cover"&&(f.y??0)>0)).toBe(true);
    expect(compiled.environment?.some(e=>e.type==="destructible_wall"&&e.id==="factory-blast-door")).toBe(true);
  });
  test("replaces alpine scenery with industrial props and materials",()=>{
    expect(theme.vegetation).toBe(0);
    expect(theme.surfaces?.floor.pattern).toBe("concrete");
    expect(theme.props.some(p=>p.kind==="crane")).toBe(true);
    expect(theme.props.some(p=>p.kind==="container")).toBe(true);
    expect(theme.props.some(p=>p.kind==="tree")).toBe(false);
  });
  test("keeps authored combat spawns inside factory collision boundaries",()=>{
    for(const p of Object.values(blueprint.spawns).flat())
      expect(insideRegions(p[0],p[2],blueprint.regions,1.1)).toBe(true);
  });
});
