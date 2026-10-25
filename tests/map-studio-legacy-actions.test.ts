import {describe,expect,test} from "bun:test";
import { MAPS,type CoverBox,type EnvironmentObject } from "../src/lib/game-protocol";
import { compileVisibleLegacyBoxes, validateBlueprint, type MapBlueprint } from "../src/lib/map-blueprints";
import { legacyCoverToFeature,legacyFlightToFeature,legacyEnvironmentToHazard,
  toggleOriginalIndex } from "../src/lib/map-object-actions";
import { featureBoxes } from "../src/lib/map-blueprints";

describe("Map Studio existing-object Duplicate and Delete",()=>{
  const cover:CoverBox[]=[
    {kind:"cover",pos:[3,1,4],size:[2,1,.5]},
    {kind:"platform",pos:[9,2.5,7],size:[4,2.5,3]},
    {kind:"cover",pos:[15,1,9],size:[1,1,1]},
  ];
  test("deleting a source index removes gameplay collision, not just the preview",()=>{
    const remaining=compileVisibleLegacyBoxes(cover,[1],{
      "2":{x:42,y:3,z:8,w:6,h:4,d:2},
    });
    expect(remaining).toHaveLength(2);
    expect(remaining[0].pos).toEqual([3,1,4]);
    // Index two retains its override after index one disappears.
    expect(remaining[1].pos).toEqual([42,3,8]);
    expect(remaining[1].size).toEqual([3,2,1]);
    expect(cover[2].pos).toEqual([15,1,9]);
    expect(compileVisibleLegacyBoxes(cover,[],undefined)).toHaveLength(3);
  });
  test("legacy hide and restore are stable, idempotent and sorted",()=>{
    const gone=toggleOriginalIndex([6,1],4,true);
    expect(gone).toEqual([1,4,6]);
    expect(toggleOriginalIndex(gone,4,true)).toEqual(gone);
    expect(toggleOriginalIndex(gone,4,false)).toEqual([1,6]);
  });
  test("a copied built-in wall and platform become independent authored features",()=>{
    const wall=legacyCoverToFeature(cover[0],"copy_wall");
    expect(wall.kind).toBe("cover");
    expect(wall.x).toBe(13);
    expect(wall.y).toBe(0);
    expect(featureBoxes(wall)[0].pos).toEqual([13,1,4]);
    const platform=legacyCoverToFeature(cover[1],"copy_platform");
    expect(platform.kind).toBe("platform");
    expect(platform.autoStairs).toBe(false);
    expect(featureBoxes(platform)).toHaveLength(1);
  });
  test("a copied original flight becomes ONE editable authored stairs object",()=>{
    const source=MAPS.compound.editorLegacyCoverSource!;
    const flight=MAPS.compound.editorLegacyStairFlights!.find(f=>f.indices.length>5)!;
    const feature=legacyFlightToFeature(flight.indices.map(i=>source[i]),"copy_flight");
    expect(feature.kind).toBe("stairs");
    expect(feature.x).toBeGreaterThan(-100);
    expect(feature.axis==="x"||feature.axis==="z").toBe(true);
    expect(featureBoxes(feature).length).toBeGreaterThan(2);
  });
  test("all built-in hazard kinds duplicate with their gameplay parameters",()=>{
    const sources:EnvironmentObject[]=[
      {id:"f",type:"fire",pos:[0,1,0],size:[2,1,2],dps:9},
      {id:"s",type:"spikes",pos:[0,1,0],size:[2,1,2],damage:22,period:6,activeFor:2},
      {id:"j",type:"jump_pad",pos:[0,1,0],size:[2,1,2],launch:[0,19,3]},
      {id:"m",type:"moving_platform",pos:[0,1,0],size:[2,1,2],to:[8,1,0],period:6},
      {id:"d",type:"destructible_wall",pos:[0,1,0],size:[2,1,2],hp:160},
    ];
    const duplicates=sources.map((source,i)=>legacyEnvironmentToHazard(source,"copy_"+i));
    expect(duplicates.map(x=>x.type)).toEqual(sources.map(x=>x.type));
    expect(duplicates[0].dps).toBe(9);
    expect(duplicates[1].damage).toBe(22);
    expect(duplicates[2].launchY).toBe(19);
    expect(duplicates[3].toX).toBe(18);
    expect(duplicates[4].hp).toBe(160);
  });
  test("invalid or duplicate deleted indices produce useful content warnings",()=>{
    const blueprint:MapBlueprint={name:"Test",shortName:"TST",description:"Test",pace:"balanced",
      regions:[{x:0,z:0,w:60,d:60}],features:[],
      spawns:{ffa:[[0,0,0]],red:[[-10,0,0]],blue:[[10,0,0]]},
      legacyCoverDisabled:[0,0,-1,1.5],legacyEnvironmentDisabled:[-2]};
    const problems=validateBlueprint(blueprint).filter(x=>x.includes("Disabled"));
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });
});
