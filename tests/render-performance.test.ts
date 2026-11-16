import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {CoverSpatialIndex} from "../src/lib/cover-spatial-index";
import {botAnimationIntervalMs,cityDetailDistance,partitionCoverIntoRenderCells,pixelRatioCap} from "../src/lib/render-performance";

describe("render-only performance budget",()=>{
  test("castle broadphase matches exact cover AABBs for movement and line of sight",()=>{
    const castle=Object.values(MAPS).find(m=>m.biome==="volcanic_castle");
    expect(castle).toBeDefined();
    const cover=castle!.cover,index=new CoverSpatialIndex(cover);
    for(const [x,z] of [[0,0],[20,30],[-45,15],[70,-60],[-90,-85]]){
      const near=index.near(x,z,3);
      const exact=cover.filter(c=>
        c.pos[0]+c.size[0]>=x-3&&c.pos[0]-c.size[0]<=x+3&&
        c.pos[2]+c.size[2]>=z-3&&c.pos[2]-c.size[2]<=z+3);
      expect(new Set(near)).toEqual(new Set(exact));
    }
    for(const [x,z,x2,z2] of [[-70,-50,80,30],[10,10,17,16],[0,0,110,-20]]){
      const nearby=index.along(x,z,x2,z2,2);
      const exact=cover.filter(c=>
        c.pos[0]+c.size[0]>=Math.min(x,x2)-2&&c.pos[0]-c.size[0]<=Math.max(x,x2)+2&&
        c.pos[2]+c.size[2]>=Math.min(z,z2)-2&&c.pos[2]-c.size[2]<=Math.max(z,z2)+2);
      expect(new Set(nearby)).toEqual(new Set(exact));
    }
  });
  test("spatial instance cells preserve cover references and boundary crossings",()=>{
    const boxes=[-64,-0.1,0,63.9,64,128].map(x=>({
      pos:[x,1,0] as [number,number,number],size:[15,2,3],
    }));
    const cells=partitionCoverIntoRenderCells(boxes);
    expect(cells.length).toBe(4);
    expect(cells.flat().length).toBe(boxes.length);
    expect(new Set(cells.flat())).toEqual(new Set(boxes));
    expect(partitionCoverIntoRenderCells([])).toEqual([]);
    expect(()=>partitionCoverIntoRenderCells(boxes,0)).toThrow();
  });
  test("city and high bot counts get a lower resolution ceiling",()=>{
    expect(pixelRatioCap("performance",true,true)).toBeLessThan(pixelRatioCap("balanced",true,true));
    expect(pixelRatioCap("balanced",true,true)).toBeLessThan(pixelRatioCap("quality",true,true));
    expect(pixelRatioCap("balanced",false,true)).toBeLessThan(pixelRatioCap("balanced",false,false));
    expect(pixelRatioCap("quality",true,true)).toBe(pixelRatioCap("quality",true,false));
  });
  test("distant detail is optional, active nearby opponents are not throttled",()=>{
    expect(cityDetailDistance("performance")).toBeLessThan(cityDetailDistance("balanced"));
    expect(cityDetailDistance("balanced")).toBeLessThan(cityDetailDistance("quality"));
    expect(botAnimationIntervalMs("performance",false,false)).toBe(0);
    expect(botAnimationIntervalMs("performance",false,true)).toBeGreaterThan(botAnimationIntervalMs("quality",false,true));
    expect(botAnimationIntervalMs("balanced",true,false)).toBeGreaterThan(0);
  });
});
