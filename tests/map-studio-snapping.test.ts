import {describe,expect,test} from "bun:test";
import {snapStudioFootprint,snapStudioElevation,STUDIO_STOREY_HEIGHT,
  type StudioSnapTarget} from "../src/lib/map-studio-snapping";
import {studioBuildingPrefab,STUDIO_BUILDING_PRESETS} from "../src/lib/map-studio-prefabs";
import {studioBuildingPlacementIssues} from "../src/lib/map-studio-diagnostics";
import type {MapBlueprint} from "../src/lib/map-blueprints";

const wall:StudioSnapTarget={key:"building 1",kind:"building",x:0,z:0,w:20,d:20,y:0,h:10};
const deck:StudioSnapTarget={key:"deck",kind:"platform",x:60,z:0,w:32,d:32,y:2,h:6};
const candidate=(x:number,z=0,w=20,d=20)=>({x,z,w,d});
describe("structure-aware studio snapping",()=>{
  test("configurable grid and direct face magnetism",()=>{
    const r=snapStudioFootprint(candidate(22.2),[wall],{grid:2,mode:"clearance"});
    expect(r.x).toBe(23); // 10 + 10 + 3 clearance
    expect(r.snappedX).toBe(23);
    expect(r.hints.length).toBeGreaterThan(0);
  });
  test("front/back edge and center alignment within radius only",()=>{
    const r=snapStudioFootprint(candidate(22.2,1.8),[wall],{grid:0});
    expect(r.z).toBe(0);
    expect(snapStudioFootprint(candidate(80,10),[wall],{grid:0}).x).toBe(80);
  });
  test("smart mode can be disabled without disabling grid",()=>{
    const r=snapStudioFootprint(candidate(42.2),[wall],{grid:2,smart:false,surface:true});
    expect(r.x).toBe(42);expect(r.y).toBeUndefined();expect(r.hints).toEqual([]);
  });
  test("does not snap to itself during transform",()=>{
    const r=snapStudioFootprint(candidate(2),[wall],{grid:0,ignoreKey:"building 1"});
    expect(r.x).toBe(2);
  });
  test("supports fully contained objects on highest elevated surface",()=>{
    const r=snapStudioFootprint(candidate(60,0,8,8),[deck,wall],{surface:true,grid:0});
    expect(r.y).toBe(8);expect(r.surface).toBe("deck");
    expect(snapStudioFootprint(candidate(74,0,12,12),[deck],{surface:true,grid:0}).y).toBeUndefined();
  });
  test("independent surface toggle places a prop on a deck with magnetic alignment disabled",()=>{
    const r=snapStudioFootprint(candidate(60,0,8,8),[deck],{smart:false,surface:true,grid:2});
    expect(r.x).toBe(60);expect(r.y).toBe(8);expect(r.snappedX).toBeUndefined();
  });
  test("vertical snapping uses deck height and standardized floors",()=>{
    expect(snapStudioElevation(7.5,candidate(60,0,8,8),[deck])).toBe(8);
    expect(snapStudioElevation(9.7,candidate(80),[])).toBe(10);
    expect(snapStudioElevation(12.8,candidate(80),[])).toBe(12.8);
  });
  test("new building presets use consistent storey heights",()=>{
    expect(STUDIO_BUILDING_PRESETS.every(p=>p.h===STUDIO_STOREY_HEIGHT||
      p.h===STUDIO_STOREY_HEIGHT*2)).toBe(true);
  });
  test("a building on a full platform is not flagged as intersecting it",()=>{
    const blueprint:MapBlueprint={
      name:"Test",shortName:"T",description:"",pace:"compact",
      regions:[{x:60,z:0,w:200,d:200}],features:[{id:"deck",kind:"platform",x:60,z:0,w:40,d:40,h:6,y:2}],
      spawns:{ffa:[[0,0,0]],red:[[0,0,0]],blue:[[0,0,0]]}
    };
    const elevated={...studioBuildingPrefab("house",60,0),y:8};
    const problems=studioBuildingPlacementIssues(elevated,blueprint,[],[]);
    expect(problems.some(p=>p.code==="feature")).toBe(false);
  });
});
