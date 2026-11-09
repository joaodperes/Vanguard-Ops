import {describe,expect,test} from "bun:test";
import {lockedPosition,normalizeTurns,rotatedExtents,preserveSavedGeometryOnMove} from "../src/lib/map-studio-transform";
import {transformFeatureAssembly} from "../src/lib/map-studio-construction";
import {containerSideStripes} from "../src/lib/container-details";
import {MAP_BLUEPRINTS,featureFootprint,type MapFeature} from "../src/lib/map-blueprints";
import {getMap} from "../src/lib/game-protocol";
import {visualThemeForMap,cityBuildingBoxes} from "../src/lib/map-visuals";
import {studioBuildingPrefab} from "../src/lib/map-studio-prefabs";
import mapSchema from "../src/data/schemas/map-blueprints.schema.json";
import themeSchema from "../src/data/schemas/map-theme.schema.json";

describe("Map Studio persistent orientation and axis locking",()=>{
  test("rotate quarter turn then move without changing the stored orientation or world extents",()=>{
    const initial={w:12,h:3,d:5,turns:0 as const};
    const rotated=rotatedExtents(initial,1,{x:1,y:1,z:1});
    expect(rotated).toEqual({w:5,h:3,d:12,turns:1});
    const moved=rotatedExtents(rotated,1,{x:1,y:1,z:1});
    expect(moved).toEqual(rotated);
    expect(rotatedExtents(rotated,2,{x:1,y:1,z:1}))
      .toEqual({w:12,h:3,d:5,turns:2});
    const resized=rotatedExtents(rotated,1,{x:2,y:1,z:3});
    expect(resized).toEqual({w:15,h:3,d:24,turns:1});
    expect(normalizeTurns(-1)).toBe(3);
    expect(normalizeTurns(5)).toBe(1);
  });
  test("resize then move never reverts a saved feature's width, depth, height or turn",()=>{
    const initial:MapFeature={id:"cover",kind:"cover",x:12,y:2,z:-9,w:8,d:3,h:4,turns:1};
    const resized=transformFeatureAssembly([initial],initial.id,
      {x:12,y:2,z:-9,w:15,d:7,h:9,turns:1},false)[0];
    expect(featureFootprint(resized)).toEqual({x:12,y:2,z:-9,w:15,d:7,h:9});
    // Simulate a Move gizmo whose initial geometry predates the resize.
    const stale={x:34,y:2,z:-9,w:8,d:3,h:4,turns:0};
    const move=preserveSavedGeometryOnMove(stale,{...featureFootprint(resized),turns:resized.turns});
    const moved=transformFeatureAssembly([resized],resized.id,move,false)[0];
    expect(moved.x).toBe(34);
    expect(moved.z).toBe(-9);
    expect(moved.y).toBe(2);
    expect(featureFootprint(moved)).toEqual({x:34,y:2,z:-9,w:15,d:7,h:9});
    expect(moved.turns).toBe(1);
    // Subsequent moves on another axis must remain dimension-neutral.
    const next=preserveSavedGeometryOnMove({...stale,x:moved.x,z:25},
      {...featureFootprint(moved),turns:moved.turns});
    const twice=transformFeatureAssembly([moved],moved.id,next,false)[0];
    expect(featureFootprint(twice)).toEqual({x:34,y:2,z:25,w:15,d:7,h:9});
    expect(twice.turns).toBe(1);
  });
  test("move keeps last saved geometry for other editable objects too",()=>{
    const stale={x:4,y:6,z:8,w:4,h:4,d:4,turns:0};
    const building=preserveSavedGeometryOnMove(stale,{w:28,h:11,d:19,turns:3});
    const hazard=preserveSavedGeometryOnMove(stale,{w:13,h:2,d:9,turns:2});
    const legacy=preserveSavedGeometryOnMove(stale,{w:3.5,h:8.25,d:1.5,turns:1});
    expect(building).toEqual({x:4,y:6,z:8,w:28,h:11,d:19,turns:3});
    expect(hazard).toEqual({x:4,y:6,z:8,w:13,h:2,d:9,turns:2});
    expect(legacy).toEqual({x:4,y:6,z:8,w:3.5,h:8.25,d:1.5,turns:1});
  });
  test("a saved building turn rotates doors, furnishings, stairs and gameplay collision together",()=>{
    const original=studioBuildingPrefab("house",87,-80);
    const world=cityBuildingBoxes(original);
    const rotated=cityBuildingBoxes({...original,w:original.d,d:original.w,turns:1});
    expect(rotated.length).toBe(world.length);
    for(let i=0;i<world.length;i++){
      const a=world[i],b=rotated[i];
      expect(b.pos[0]-original.x).toBeCloseTo(a.pos[2]-original.z);
      expect(b.pos[2]-original.z).toBeCloseTo(-(a.pos[0]-original.x));
      expect(b.size[0]).toBeCloseTo(a.size[2]);
      expect(b.size[2]).toBeCloseTo(a.size[0]);
      expect(b.pos[1]).toBeCloseTo(a.pos[1]);
    }
  });
  test("moving on a selected axis keeps both other coordinates exact",()=>{
    const start={x:11.5,y:2.25,z:-18.2};
    const attempted={x:29,y:7,z:40};
    expect(lockedPosition(start,attempted,"x")).toEqual({x:29,y:2.25,z:-18.2});
    expect(lockedPosition(start,attempted,"y")).toEqual({x:11.5,y:7,z:-18.2});
    expect(lockedPosition(start,attempted,"z")).toEqual({x:11.5,y:2.25,z:40});
  });
  test("map and theme JSON schemas support saved quarter-turns",()=>{
    const properties=mapSchema.properties.maps.patternProperties["^[a-z][a-z0-9_:-]*$"].properties;
    expect(properties.features.items.properties.turns.maximum).toBe(3);
    expect(properties.hazards.items.properties.turns.maximum).toBe(3);
    expect(properties.legacyCoverOverrides.patternProperties["^(0|[1-9][0-9]*)$"].properties.turns.maximum).toBe(3);
    // The public schema is generated from a Zod literal union (0 | 1 | 2 | 3),
    // which is encoded as anyOf/const rather than an independent min/max range.
    expect(themeSchema.properties.props.items.properties.turns.anyOf
      .map(option=>option.const)).toEqual([0,1,2,3]);
  });
});

describe("Breakwater map polish",()=>{
  test("shipping containers have symmetric stripes on both long walls",()=>{
    for(const [w,d,h] of [[9,5,3.3],[3.8,7.5,3.2],[10,10,4]]){
      const ribs=containerSideStripes(w,d,h);
      expect(ribs.length).toBeGreaterThanOrEqual(4);
      expect(ribs.length%2).toBe(0);
      const longX=w>=d,half=(longX?d:w)/2+.045;
      expect(ribs.some(p=>(longX?p.z:p.x)>0)).toBe(true);
      expect(ribs.some(p=>(longX?p.z:p.x)<0)).toBe(true);
      for(let n=0;n<ribs.length;n+=2){
        expect(ribs[n].y).toBe(ribs[n+1].y);
        if(longX){
          expect(ribs[n].x).toBe(ribs[n+1].x);
          expect(ribs[n].z).toBeCloseTo(-half);
          expect(ribs[n+1].z).toBeCloseTo(half);
        }else{
          expect(ribs[n].z).toBe(ribs[n+1].z);
          expect(ribs[n].x).toBeCloseTo(-half);
          expect(ribs[n+1].x).toBeCloseTo(half);
        }
      }
    }
  });
  test("floating transfer cart and elevated authored crane platform are removed",()=>{
    const map=getMap("shipyard");
    const blueprint=MAP_BLUEPRINTS.maps.shipyard;
    expect(blueprint.features.some(f=>f.id==="crane-platform")).toBe(false);
    expect(map.environment?.some(e=>e.type==="moving_platform")).toBe(false);
    expect(map.environment?.some(e=>e.id==="shipyard_platform")).toBe(false);
    // Other dock features and container props remain for combat.
    expect(visualThemeForMap("shipyard").props.filter(p=>p.kind==="container").length).toBeGreaterThan(5);
    expect(blueprint.features.some(f=>f.id==="southern-containers")).toBe(true);
  });
});
