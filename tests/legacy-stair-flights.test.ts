import {describe,expect,test} from "bun:test";
import {stairs,MAPS,type CoverBox} from "../src/lib/game-protocol";
import {detectLegacyStairFlights,stairFlightBounds,transformStairFlight,
  maxLegacyFlightRise} from "../src/lib/legacy-stair-flights";

describe("logical stair flights in Map Studio",()=>{
  const first=stairs(12,20,4,8,3,7,"z",1);
  const second=stairs(-12,-20,3,6,3,6,"z",-1);
  test("detects one selection per complete flight, never a tread",()=>{
    const cover:CoverBox[]=[{pos:[0,1,0],size:[1,1,1],kind:"cover"},...first,...second,
      {pos:[2,1,4],size:[1,1,1],kind:"cover"}];
    const flights=detectLegacyStairFlights(cover);
    expect(flights).toHaveLength(2);
    expect(flights[0].start).toBe(1);
    expect(flights[0].indices).toHaveLength(first.length);
    expect(flights[1].start).toBe(first.length+1);
    expect(flights[1].indices).toHaveLength(second.length);
  });
  test("geometry is transformed in a single batch, retaining step heights",()=>{
    const flight=detectLegacyStairFlights(first)[0];
    const bounds=stairFlightBounds(first);
    const moved={...bounds,x:bounds.x+10,y:bounds.y+2,z:bounds.z-4,w:bounds.w*1.4,d:bounds.d*1.3};
    const updates=transformStairFlight(first,flight.indices,{...moved,turns:0});
    expect(Object.keys(updates)).toHaveLength(first.length);
    const boxes=first.map((b,i)=>{
      const e=updates[i];
      return {...b,pos:[e.x,e.y,e.z] as [number,number,number],
        size:[e.w/2,e.h/2,e.d/2] as [number,number,number]};
    });
    const actual=stairFlightBounds(boxes);
    expect(actual.x).toBeCloseTo(moved.x);
    expect(actual.y).toBeCloseTo(moved.y);
    expect(actual.z).toBeCloseTo(moved.z);
    expect(actual.w).toBeCloseTo(moved.w);
    expect(actual.h).toBeCloseTo(moved.h);
    expect(actual.d).toBeCloseTo(moved.d);
    expect(first[0].pos[1]).toBeLessThan(boxes[0].pos[1]);
  });
  test("90-degree rotation swaps the flight run and width",()=>{
    const flight=detectLegacyStairFlights(first)[0];
    const before=stairFlightBounds(first);
    const updates=transformStairFlight(first,flight.indices,
      {...before,w:before.d,d:before.w,turns:1});
    const boxes=first.map((b,i)=>({...b,
      pos:[updates[i].x,updates[i].y,updates[i].z] as [number,number,number],
      size:[updates[i].w/2,updates[i].h/2,updates[i].d/2] as [number,number,number]}));
    const after=stairFlightBounds(boxes);
    expect(after.w).toBeCloseTo(before.d);
    expect(after.d).toBeCloseTo(before.w);
    expect(after.h).toBeCloseTo(before.h);
  });
  test("original maps publish stable group indices for gameplay-safe overrides",()=>{
    const map=MAPS.compound;
    const groups=map.editorLegacyStairFlights??[];
    expect(groups.length).toBeGreaterThan(3);
    expect(groups.some(g=>g.indices.length>=6)).toBe(true);
    for(const g of groups){
      expect(g.start).toBe(g.indices[0]);
      expect(g.indices.every(i=>map.cover[i]?.kind==="stair")).toBe(true);
      expect(g.indices.every((i,n)=>n===0||i===g.indices[n-1]+1)).toBe(true);
    }
    expect(maxLegacyFlightRise(first.length)).toBe(first.length*.5);
  });
});
