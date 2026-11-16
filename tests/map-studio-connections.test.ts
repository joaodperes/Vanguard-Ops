import {describe,expect,test} from "bun:test";
import {attachStairsToPlatform,featureBoxes,featureFootprint,reconcileFeatureAttachments,resolveStairAttachments,validateBlueprint,type MapFeature,type PlatformEdge,type MapBlueprint} from "../src/lib/map-blueprints";
import {studioStructurePrefab} from "../src/lib/map-studio-prefabs";
import {constructionDimension,copyFeatureAssembly,joinFeatureFaces,transformFeature,transformFeatureAssembly,wallBetween} from "../src/lib/map-studio-construction";
import {studioConnectionIssues} from "../src/lib/map-studio-diagnostics";
import {snapStudioFootprint} from "../src/lib/map-studio-snapping";
import {botTraversableEdge} from "../src/lib/bot-routing";
import {compileMapStudioDraft} from "../src/lib/game-protocol";
import {visualThemeForMap} from "../src/lib/map-visuals";
import {importMapDocuments,exportMapLibrary} from "../src/lib/map-document-io";
import {MAP_DOCUMENTS} from "../src/lib/map-documents";

const deck:MapFeature={id:"deck",kind:"platform",x:0,z:0,w:24,d:20,h:5,y:0,autoStairs:false};
const stair:MapFeature={id:"stairs",kind:"stairs",x:20,z:0,w:4,d:10,h:5,y:0,axis:"x",sign:1};
const blueprint=(features:MapFeature[]):MapBlueprint=>({name:"Test",shortName:"T",description:"",pace:"balanced",templateMapId:"bunker",
  regions:[{x:0,z:0,w:400,d:400}],features,spawns:{ffa:[[-120,0,100]],red:[[-120,0,120]],blue:[[120,0,-120]]}});

describe("physical construction connections",()=>{
  for(const edge of ["north","south","east","west"] as PlatformEdge[])for(const height of [5,10]){
    test(edge+" stairs meet and traverse a "+height+"u deck in both directions",()=>{
      const p={...deck,h:height},f=attachStairsToPlatform(stair,p,edge),boxes=[...featureBoxes(p),...featureBoxes(f)];
      expect(studioConnectionIssues([p,f])).toEqual([]);
      const axis=f.axis==="x"?0:2,sign=f.sign!,start:[number,number,number]=[f.x,0,f.z],end:[number,number,number]=[f.x,height,f.z];
      start[axis]+=sign*(f.d+.7);end[axis]-=sign;
      expect(botTraversableEdge(start,end[0],end[2],boxes)).toBeCloseTo(height);
      expect(botTraversableEdge(end,start[0],start[2],boxes)).toBeCloseTo(0);
    });
  }
  test("rooftop prefab is connected instead of stranding stairs beside the deck",()=>{
    const kit=studioStructurePrefab("rooftop",0,0);
    expect(kit.find(f=>f.kind==="stairs")!.attachment?.platformId).toBe(kit.find(f=>f.kind==="platform")!.id);
    expect(studioConnectionIssues(kit)).toEqual([]);
  });
  test("physical footprints match the compiled stair bounds on both axes",()=>{
    for(const axis of ["x","z"] as const)for(const sign of [-1,1] as const){
      const f={...stair,axis,sign},fp=featureFootprint(f),boxes=featureBoxes(f);
      expect(Math.min(...boxes.map(b=>b.pos[0]-b.size[0]))).toBeCloseTo(fp.x-fp.w/2-(axis==="x"?.02:0));
      expect(Math.max(...boxes.map(b=>b.pos[2]+b.size[2]))).toBeCloseTo(fp.z+fp.d/2+(axis==="z"?.02:0));
    }
  });
  test("changing platform dimensions, location and top keeps the saved stair connection",()=>{
    const f=attachStairsToPlatform(stair,deck,"east");
    const [p,s]=reconcileFeatureAttachments([{...deck,x:15,z:10,w:30,h:10},f],[deck,f]);
    expect(s.x).toBe(30);expect(s.z).toBe(10);expect(s.h).toBe(10);
    expect(studioConnectionIssues([p,s])).toEqual([]);
  });
  test("elevated floor-to-floor attachment retains the chosen starting floor",()=>{
    const f=attachStairsToPlatform({...stair,y:5},{...deck,h:10},"north");
    expect(f.y).toBe(5);expect(f.h).toBe(5);
  });
  test("reports buried stairs and an unattached height mismatch",()=>{
    expect(studioConnectionIssues([deck,{...stair,x:0,z:0,h:2}]).some(i=>i.code.startsWith("buried-stairs"))).toBe(true);
    expect(studioConnectionIssues([deck,{...stair,x:12,h:3}]).some(i=>i.code.startsWith("landing-height"))).toBe(true);
  });
  test("detects actual obstruction and missing headroom at a connected stair",()=>{
    const f=attachStairsToPlatform(stair,deck,"east");
    const ceiling:MapFeature={id:"ceiling",kind:"cover",x:12,z:0,w:6,d:8,y:5.3,h:1};
    expect(studioConnectionIssues([deck,f,ceiling]).some(i=>i.code.startsWith("blocked-stairs"))).toBe(true);
  });
  test("missing platform stays a visible invalid reference",()=>{
    const f=attachStairsToPlatform(stair,deck,"east");
    expect(studioConnectionIssues([f]).some(i=>i.code.startsWith("missing-platform"))).toBe(true);
    expect(validateBlueprint(blueprint([f])).some(s=>s.includes("connection"))).toBe(true);
  });
  test("quarter-turn rotation changes the physical axis and downhill sign",()=>{
    const fp=featureFootprint({...stair,axis:"z"});
    const f=transformFeature({...stair,axis:"z"},{...fp,w:fp.d,d:fp.w,turns:1});
    expect(f.axis).toBe("x");expect(f.sign).toBe(1);
    expect(featureFootprint(f).w).toBe(stair.d);
  });
  test("copy, rotate, move and resize an entire rooftop preserves all links",()=>{
    let counter=0;
    const kit=studioStructurePrefab("rooftop",0,0).map(f=>({...f,assemblyId:"roof"}));
    const copies=copyFeatureAssembly(kit,kit[0].id,()=>"copy_"+(++counter));
    expect(copies[1].attachment!.platformId).toBe(copies[0].id);
    expect(copies[0].assemblyId).not.toBe("roof");
    const moved=transformFeatureAssembly(copies,copies[0].id,{x:40,z:50,y:0,w:24,h:10,d:22,turns:1});
    expect(studioConnectionIssues(moved)).toEqual([]);
    expect(moved[1].attachment!.edge).toBe("north");
    expect(moved[1].h).toBe(10);
    expect(reconcileFeatureAttachments(moved,copies)[1].attachment!.edge).toBe("north");
  });
  test("construction edits retain immutable snapshots for undo and redo",()=>{
    const original=studioStructurePrefab("rooftop",0,0).map(f=>({...f,assemblyId:"roof"}));
    const before=JSON.stringify(original);
    const edited=transformFeatureAssembly(original,original[0].id,{x:40,z:20,y:0,w:24,d:22,h:10,turns:1});
    expect(JSON.stringify(original)).toBe(before);
    const restored=JSON.parse(before) as MapFeature[];
    expect(restored.flatMap(featureBoxes)).toEqual(original.flatMap(featureBoxes));
    expect(studioConnectionIssues(restored)).toEqual([]);
    expect(studioConnectionIssues(edited)).toEqual([]);
  });
  test("all four assembly orientations remain physically traversable",()=>{
    const kit=studioStructurePrefab("rooftop",0,0).map(f=>({...f,assemblyId:"roof"}));
    for(let turns=0;turns<4;turns++){
      const moved=transformFeatureAssembly(kit,kit[0].id,{x:0,z:0,y:0,w:turns%2?24:22,d:turns%2?22:24,h:5,turns});
      expect(studioConnectionIssues(moved)).toEqual([]);
    }
  });
  test("a single-piece transform detaches stairs explicitly",()=>{
    const f=attachStairsToPlatform(stair,deck,"east"),fp=featureFootprint(f);
    const moved=transformFeatureAssembly([deck,f],f.id,{...fp,x:fp.x+4,turns:0},false);
    expect(moved[1].attachment).toBeUndefined();
  });
  test("tiny wall gaps are measured and repaired without moving the other end",()=>{
    const a=wallBetween({x:0,z:0},{x:8,z:0},"a"),b=wallBetween({x:8.12,z:0},{x:16,z:0},"b");
    expect(studioConnectionIssues([a,b]).some(i=>i.canJoin)).toBe(true);
    const joined=joinFeatureFaces(a,b)!;
    expect(joined.x-joined.w/2).toBe(0);
    expect(joined.x+joined.w/2).toBeCloseTo(8.12);
    expect(studioConnectionIssues([joined,b])).toEqual([]);
  });
  test("join mode closes walls while clearance mode deliberately keeps a passage",()=>{
    const wall={key:"wall",kind:"cover" as const,x:0,z:0,w:12,d:1};
    expect(snapStudioFootprint({x:14,z:0,w:12,d:1},[wall],{grid:2,mode:"join"}).x).toBe(12);
    expect(snapStudioFootprint({x:14,z:0,w:12,d:1},[wall],{grid:2,mode:"clearance"}).x).toBe(15);
    expect(constructionDimension(7.8,1)).toBe(8);expect(constructionDimension(7.8,0)).toBe(7.8);
  });
  test("export/import and runtime compilation resolve persistent connections identically",()=>{
    const p={...deck,x:100,z:100,h:10},f=attachStairsToPlatform({...stair,x:120,z:100},p,"east");
    const doc={version:2 as const,id:"connection_test",blueprint:blueprint([p,{...f,h:1}]),theme:visualThemeForMap("compound")};
    const loaded=importMapDocuments(JSON.parse(JSON.stringify(exportMapLibrary({connection_test:doc}))),MAP_DOCUMENTS,"compound").documents.connection_test;
    const compiled=compileMapStudioDraft(loaded.id,loaded.blueprint,loaded.theme);
    for(const box of resolveStairAttachments(loaded.blueprint.features).flatMap(featureBoxes))expect(compiled.cover).toContainEqual(box);
  });
});
