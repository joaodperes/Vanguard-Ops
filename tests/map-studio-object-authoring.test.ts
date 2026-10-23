import { describe,expect,test } from "bun:test";
import { getMap } from "../src/lib/game-protocol";
import {
  insideRegion, insideRegions, regionRectangles, regionBoundary, featureBoxes,
  nearestPlatformSnap, snapCoverToPlatform, authoredHazardEnvironment, validateBlueprint, overrideBox,
  type MapFeature, type MapBlueprint,
} from "../src/lib/map-blueprints";

const platform:MapFeature={id:"deck",kind:"platform",x:12,z:8,w:16,d:12,h:4.2};
const stairs:MapFeature={id:"access",kind:"stairs",x:11,z:23,w:4,d:8,h:3,axis:"z",sign:1};

describe("Map Studio authored objects",()=>{
  test("circle and triangle containment differs from rectangular bounding box",()=>{
    const circle={x:0,z:0,w:20,d:20,shape:"circle" as const};
    const triangle={x:0,z:0,w:20,d:20,shape:"triangle" as const};
    expect(insideRegion(9,9,circle)).toBe(false);
    expect(insideRegion(0,0,circle)).toBe(true);
    expect(insideRegion(0,-9,triangle)).toBe(true);
    expect(insideRegion(9,-9,triangle)).toBe(false);
    expect(insideRegion(9,9,triangle)).toBe(true);
  });
  test("nonrectangular regions create stepped but playable physical boundaries",()=>{
    const regions=[{x:0,z:0,w:30,d:30,shape:"circle" as const},{x:15,z:0,w:15,d:15}];
    const strips=regionRectangles(regions);
    expect(strips.length).toBeGreaterThan(10);
    expect(strips.every(r=>r.w>0&&r.d>0)).toBe(true);
    expect(regionBoundary(regions).length).toBeGreaterThan(4);
    expect(insideRegions(0,0,regions)).toBe(true);
    expect(insideRegions(14,12,regions)).toBe(false);
  });
  test("standalone staircase climbs to requested height and has correct footprint",()=>{
    const boxes=featureBoxes(stairs);
    expect(boxes.length).toBe(Math.ceil(stairs.h/.42));
    expect(boxes.every(b=>b.kind==="stair")).toBe(true);
    expect(boxes.at(-1)!.pos[1]+boxes.at(-1)!.size[1]).toBeCloseTo(stairs.h);
    expect(featureBoxes({...platform,autoStairs:false})).toHaveLength(1);
    expect(featureBoxes(platform).length).toBeGreaterThan(1);
  });
  test("snap to platform picks closest landing and derives height/run",()=>{
    const snapped=nearestPlatformSnap({...stairs,x:12,z:15},[platform]);
    expect(snapped).not.toBeNull();
    expect(snapped!.z).toBe(14); // south platform edge: z + d/2
    expect(snapped!.axis).toBe("z");
    expect(snapped!.sign).toBe(1);
    expect(snapped!.h).toBe(platform.h);
    expect(snapped!.d).toBeCloseTo(Math.ceil(platform.h/.42)*.76);
    expect(nearestPlatformSnap(stairs,[])).toBeNull();
  });
  test("elevated walls keep their own thickness above floating platforms",()=>{
    const wall:MapFeature={id:"gantry-wall",kind:"cover",x:12,z:8,w:3,d:1,h:2.3};
    const snapped=snapCoverToPlatform(wall,[platform]);
    expect(snapped?.y).toBeCloseTo(platform.h);
    expect(snapped?.h).toBe(2.3);
    const boxes=featureBoxes(snapped!);
    expect(boxes[0].pos[1]-boxes[0].size[1]).toBeCloseTo(platform.h);
    expect(boxes[0].pos[1]+boxes[0].size[1]).toBeCloseTo(platform.h+wall.h);
    expect(snapCoverToPlatform(wall,[])).toBeNull();
  });
  test("platform-top stairs reach elevated landings without overshooting",()=>{
    const raised:MapFeature={...platform,y:4,h:3};
    const snapped=nearestPlatformSnap({...stairs,y:0,h:1},[raised]);
    expect(snapped?.y).toBe(0);
    expect(snapped?.h).toBe(7);
    expect(snapped?.d).toBeCloseTo(Math.ceil(7/.42)*.76);
    const boxes=featureBoxes(snapped!);
    expect(boxes.at(-1)!.pos[1]+boxes.at(-1)!.size[1]).toBeCloseTo(7);
  });
  test("authored hazards convert to existing authoritative environment types",()=>{
    const fire=authoredHazardEnvironment({id:"heat",type:"fire",x:10,z:5,y:1,w:6,d:4,h:2,dps:9});
    expect(fire.type).toBe("fire");
    expect(fire.size).toEqual([3,1,2]);
    if(fire.type==="fire")expect(fire.dps).toBe(9);
    const spike=authoredHazardEnvironment({id:"spikes",type:"spikes",x:10,z:5,y:1,w:6,d:4,h:2,damage:20,period:4,activeFor:1});
    expect(spike.type).toBe("spikes");
    const pad=authoredHazardEnvironment({id:"pad",type:"jump_pad",x:10,z:5,y:1,w:6,d:4,h:2,launchY:20});
    if(pad.type==="jump_pad")expect(pad.launch).toEqual([0,20,0]);
  });
  test("maps expose editable legacy covers, including stair steps",()=>{
    const compiled=getMap("compound");
    expect(compiled.editorLegacyCoverCount).toBeGreaterThan(0);
    const legacy=compiled.cover.slice(0,compiled.editorLegacyCoverCount);
    expect(legacy.some(b=>b.kind==="stair")).toBe(true);
  });
  test("legacy box overrides use full width/height/depth and preserve metadata",()=>{
    const base={pos:[5,3,7] as [number,number,number],size:[2,1,3] as [number,number,number],kind:"stair" as const};
    const moved=overrideBox(base,{x:10,y:6,z:-4,w:6,h:8,d:12});
    expect(moved.pos).toEqual([10,6,-4]);
    expect(moved.size).toEqual([3,4,6]);
    expect(moved.kind).toBe("stair");
    expect(base.pos).toEqual([5,3,7]);
  });
  test("invalid legacy edits are caught before publishing",()=>{
    const plan:MapBlueprint={name:"Test",shortName:"TST",description:"Test",pace:"balanced",
      regions:[{x:0,z:0,w:50,d:50}],features:[],
      spawns:{ffa:[[0,0,0]],red:[[-15,0,0]],blue:[[15,0,0]]},
      legacyCoverOverrides:{"1":{x:0,y:0,z:0,w:-2,h:1,d:3}}};
    expect(validateBlueprint(plan).some(issue=>issue.includes("legacyCoverOverrides[1]"))).toBe(true);
  });
  test("rejects unknown shapes, impossible hazards, and duplicate feature/hazard IDs",()=>{
    const plan:MapBlueprint={name:"Test",shortName:"TST",description:"Test",pace:"balanced",
      regions:[{x:0,z:0,w:100,d:100}],features:[platform],
      hazards:[{id:"deck",type:"spikes",x:0,z:0,y:1,w:5,d:5,h:2,damage:10,period:3,activeFor:4}],
      spawns:{ffa:[[30,0,30]],red:[[-30,0,30]],blue:[[30,0,-30]]}};
    const errors=validateBlueprint(plan);
    expect(errors.some(e=>e.includes("duplicate ID"))).toBe(true);
    expect(errors.some(e=>e.includes("spike timing"))).toBe(true);
    expect(validateBlueprint({...plan,regions:[{x:0,z:0,w:100,d:100,shape:"hexagon" as never}]}).some(e=>e.includes("invalid shape"))).toBe(true);
  });
});
