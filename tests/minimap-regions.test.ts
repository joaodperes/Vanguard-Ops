import { describe,expect,test } from "bun:test";
import { unionRegionOutline,unionRegionOutlinePath } from "../src/lib/region-outline";

describe("radar region union outline",()=>{
  test("draws four edges for a single rectangle",()=>{
    expect(unionRegionOutline([{x:2,z:3,w:10,h:8}])).toHaveLength(4);
  });
  test("does not draw a shared internal seam for adjacent rectangles",()=>{
    const edges=unionRegionOutline([{x:0,z:0,w:10,h:10},{x:10,z:0,w:10,h:10}]);
    expect(edges.some(([x1,z1,x2,z2])=>x1===10&&x2===10&&z1!==z2)).toBe(false);
    expect(edges.length).toBeGreaterThan(0);
  });
  test("only draws the outside boundary of overlapping rectangles",()=>{
    const edges=unionRegionOutline([{x:0,z:0,w:60,h:60},{x:40,z:10,w:60,h:60}]);
    expect(edges.some(([x1,z1,x2,z2])=>x1===60&&x2===60&&z1<60&&z2>10)).toBe(false);
    expect(unionRegionOutlinePath([{x:0,z:0,w:60,h:60},{x:40,z:10,w:60,h:60}])).toContain("M");
  });
  test("skips invalid and empty regions",()=>{
    expect(unionRegionOutline([{x:0,z:0,w:0,h:3}])).toEqual([]);
    expect(unionRegionOutline([{x:NaN,z:0,w:5,h:3}])).toEqual([]);
  });
});
