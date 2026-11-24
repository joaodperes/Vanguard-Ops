import {describe,expect,test} from "bun:test";
import {MAP_LIST,mapAllowedForMode,DEFAULT_CONFIG} from "../src/lib/game-protocol";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";
import {botPositionEmbedded} from "../src/lib/bot-physics";

describe("new competitive mode integration",()=>{
  const dustwater=MAP_LIST.find(map=>map.id==="dustwater")!;
  test("Dustwater is a validated published map and supports all three modes",()=>{
    expect(dustwater).toBeDefined();
    expect(validateMapDocument(MAP_DOCUMENTS.dustwater)).toEqual([]);
    for(const mode of ["searchdestroy","hardpoint","frontier"] as const)
      expect(mapAllowedForMode(mode,"dustwater")).toBe(true);
    expect(mapAllowedForMode("searchdestroy","compound")).toBe(false);
    expect(mapAllowedForMode("hardpoint","compound")).toBe(false);
    expect(mapAllowedForMode("frontier","compound")).toBe(false);
  });
  test("bomb sites and all five Hardpoint hills are accessible inside the boomtown",()=>{
    const objectives:[number,number,number][]=[
      [-22,0,-18],[22,0,18],
      [-24,0,-18],[22,0,-18],[0,0,0],[-22,0,20],[24,0,20],
    ];
    for(const point of objectives){
      expect(botPositionEmbedded(dustwater.cover,point)).toBe(false);
      expect(dustwater.regions?.some(r=>Math.abs(point[0]-r.x)<=r.w/2&&Math.abs(point[2]-r.z)<=r.d/2)).toBe(true);
    }
  });
  test("mode defaults use the specified competitive match limits",()=>{
    expect(DEFAULT_CONFIG("searchdestroy",8)).toMatchObject({scoreLimit:0,timeLimit:0});
    expect(DEFAULT_CONFIG("hardpoint",8)).toMatchObject({scoreLimit:200,timeLimit:600});
    expect(DEFAULT_CONFIG("frontier",8)).toMatchObject({scoreLimit:30,timeLimit:360});
  });
});
