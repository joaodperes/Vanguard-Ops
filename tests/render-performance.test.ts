import {describe,expect,test} from "bun:test";
import {botAnimationIntervalMs,cityDetailDistance,partitionCoverIntoRenderCells,pixelRatioCap} from "../src/lib/render-performance";

describe("render-only performance budget",()=>{
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
