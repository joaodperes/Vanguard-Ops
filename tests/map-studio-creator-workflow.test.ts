import {describe,expect,test} from "bun:test";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {mapProps,visualThemeForMap,cityBuildingBoxes} from "../src/lib/map-visuals";
import {getMap,compileMapStudioDraft} from "../src/lib/game-protocol";
import {STUDIO_STRUCTURE_PRESETS,studioStructurePrefab,studioBuildingPrefab} from "../src/lib/map-studio-prefabs";
import {studioBuildingPlacementIssues,studioMapIssues} from "../src/lib/map-studio-diagnostics";

describe("Map Studio creator workflow",()=>{
  test("every construction kit creates individually editable, physics-backed features",()=>{
    expect(STUDIO_STRUCTURE_PRESETS.length).toBeGreaterThanOrEqual(7);
    for(const kit of STUDIO_STRUCTURE_PRESETS){
      const pieces=studioStructurePrefab(kit.id,105,-105);
      expect(pieces.length).toBeGreaterThan(0);
      expect(new Set(pieces.map(p=>p.id)).size).toBe(pieces.length);
      expect(pieces.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.w>0&&p.d>0&&p.h>0)).toBe(true);
    }
    const room=studioStructurePrefab("room",0,0);
    expect(room.filter(f=>f.kind==="cover").length).toBeGreaterThanOrEqual(4);
    expect(studioStructurePrefab("rooftop",0,0).some(f=>f.kind==="stairs")).toBe(true);
  });
  test("promoting an Afterlight lot masks its generated copy without losing gameplay collision",()=>{
    const blueprint=structuredClone(MAP_BLUEPRINTS.maps.arena_neon);
    const theme=structuredClone(visualThemeForMap("arena_neon"));
    const initial=mapProps("arena_neon",blueprint,theme);
    const lot=initial.find(p=>p.kind==="building"&&p.lotId);
    expect(lot?.lotId).toBeTruthy();
    blueprint.cityBuildingDisabled=[lot!.lotId!];
    theme.props.push({...lot!});
    const after=mapProps("arena_neon",blueprint,theme);
    expect(after.filter(p=>p.kind==="building"&&p.lotId===lot!.lotId).length).toBe(1);
    expect(after.some(p=>p===theme.props[0])).toBe(true);
    const preview=compileMapStudioDraft("arena_neon",blueprint,theme);
    expect(preview.props.filter(p=>p.lotId===lot!.lotId)).toHaveLength(1);
    expect(preview.cover.length).toBeGreaterThan(0);
    expect(cityBuildingBoxes(theme.props[0]).length).toBeGreaterThan(5);
    // The day edition compiles the same promoted building when given the
    // shared blueprint and the daytime palette with shared authored props.
    const dayTheme={...structuredClone(visualThemeForMap("terminal")),props:theme.props};
    const day=compileMapStudioDraft("terminal",blueprint,dayTheme);
    expect(day.props).toEqual(preview.props);
    expect(day.cover).toEqual(preview.cover);
  });
  test("ghost placement rejects invalid overlaps, park intrusion and blocked spawns",()=>{
    const plan=structuredClone(MAP_BLUEPRINTS.maps.arena_neon);
    const house=studioBuildingPrefab("house",90,90);
    expect(studioBuildingPlacementIssues(house,plan,[],[])).toHaveLength(0);
    expect(studioBuildingPlacementIssues({...house,x:0,z:0},plan,[],[]).some(x=>x.code==="park")).toBe(true);
    expect(studioBuildingPlacementIssues({...house,x:195,z:195},plan,[],[]).some(x=>x.code==="bounds")).toBe(true);
    expect(studioBuildingPlacementIssues(house,plan,[{...house,x:91}],[]).some(x=>x.code==="overlap")).toBe(true);
    expect(studioBuildingPlacementIssues(house,plan,[],[[90,0,90]]).some(x=>x.code==="spawn")).toBe(true);
  });
  test("safety overlays locate authored map errors before export",()=>{
    const plan=structuredClone(MAP_BLUEPRINTS.maps.compound);
    plan.spawns.ffa.push([2000,0,2000]);
    const issues=studioMapIssues(plan,[]);
    expect(issues.some(x=>x.code.startsWith("outside-spawn"))).toBe(true);
    expect(issues.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.z))).toBe(true);
    expect(getMap("arena_neon").id).toBe("arena_neon");
  });
});
