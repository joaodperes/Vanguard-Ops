import {describe,expect,test} from "bun:test";
import {elevationSpan,yAtElevationFace,horizontalSnap} from "../src/lib/map-studio-elevation";

describe("Map Studio exact elevation placement",()=>{
  test("author-created walls use their base as Y and preserve H when positioning the top",()=>{
    const wall=elevationSpan(5.25,2.5,"bottom");
    expect(wall.bottom).toBe(5.25);
    expect(wall.top).toBe(7.75);
    const y=yAtElevationFace(11.125,2.5,"bottom","top");
    expect(y).toBeCloseTo(8.625);
    expect(elevationSpan(y,2.5,"bottom").top).toBeCloseTo(11.125);
  });
  test("legacy collision boxes and hazards store the center, not the bottom",()=>{
    const box=elevationSpan(3.25,2.5,"center");
    expect(box.bottom).toBe(2);
    expect(box.top).toBe(4.5);
    expect(yAtElevationFace(6.375,2.5,"center","bottom")).toBe(7.625);
    expect(yAtElevationFace(10.125,2.5,"center","top")).toBe(8.875);
  });
  test("both faces of stair flights shift together without changing total rise",()=>{
    const before=elevationSpan(3,6,"center");
    const shift=yAtElevationFace(9.75,6,"center","top");
    const after=elevationSpan(shift,6,"center");
    expect(after.top).toBeCloseTo(9.75);
    expect(after.top-after.bottom).toBeCloseTo(before.height);
  });
  test("player spawn Y is a point, without artificial vertical thickness",()=>{
    expect(elevationSpan(4.125,2,"point")).toEqual({
      bottom:4.125,top:4.125,center:4.125,height:0,
    });
    expect(yAtElevationFace(1.333,0,"point","top")).toBe(1.333);
  });
  test("horizontal grid can snap by 2 units without restricting precise Y",()=>{
    expect(horizontalSnap(5.25,2)).toBe(6);
    expect(horizontalSnap(-5.25,2)).toBe(-6);
    expect(horizontalSnap(5.25,0)).toBe(5.25);
    // Y should never be run through horizontalSnap in TransformControls.
    const preciseY=5.375;
    expect(elevationSpan(preciseY,3,"bottom").bottom).toBe(preciseY);
  });
});
