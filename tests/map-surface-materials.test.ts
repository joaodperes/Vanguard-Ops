import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {MAP_LIST,MAPS} from "../src/lib/game-protocol";
import {SURFACE_PATTERNS} from "../src/lib/map-visuals";
import {mapBoxUV,mapFloorUV} from "../src/lib/map-materials";

describe("JSON-authored art material recipes",()=>{
  test("all maps have a complete, valid, visually distinct material set",()=>{
    const expected=["floor","wall","cover","stair","platform"] as const;
    const patterns=new Set<string>();
    for(const map of MAP_LIST){
      expect(map.surfaces).toBeDefined();
      for(const key of expected){
        const s=map.surfaces![key];
        expect(SURFACE_PATTERNS).toContain(s.pattern);
        expect(s.tileSize).toBeGreaterThan(0);
        expect(s.roughness).toBeGreaterThanOrEqual(0);
        expect(s.roughness).toBeLessThanOrEqual(1);
        patterns.add(s.pattern);
      }
      expect(map.surfaces!.floor.pattern).not.toBe(map.surfaces!.wall.pattern);
      expect(map.theme.floor).not.toBe(map.theme.wall);
    }
    expect(patterns.size).toBeGreaterThanOrEqual(7);
    expect(MAPS.compound.surfaces?.floor.pattern).toBe("moss");
    expect(MAPS.skybridge.surfaces?.floor.pattern).toBe("snow");
    expect(MAPS.shipyard.surfaces?.floor.pattern).toBe("planks");
    expect(MAPS.bunker.surfaces?.stair.pattern).toBe("grate");
    expect(MAPS.arena_neon.surfaces?.floor.pattern).toBe("asphalt");
    expect(MAPS.terminal.surfaces?.floor.pattern).toBe("pavers");
  });

  test("ground texture scales with physical metres instead of region size",()=>{
    const small=new THREE.PlaneGeometry(4,4);
    const large=new THREE.PlaneGeometry(64,64);
    mapFloorUV(small,10,20,8);
    mapFloorUV(large,10,20,8);
    const uvSpan=(g:THREE.PlaneGeometry)=>{
      const u=g.getAttribute("uv");
      return Math.max(...Array.from({length:u.count},(_,i)=>u.getX(i)))-
             Math.min(...Array.from({length:u.count},(_,i)=>u.getX(i)));
    };
    expect(uvSpan(small)).toBeCloseTo(.5);
    expect(uvSpan(large)).toBeCloseTo(8);
    small.dispose();large.dispose();
  });
  test("cover faces use world-sized texture coordinates without geometry changes",()=>{
    const geo=new THREE.BoxGeometry(10,5,6);
    const before=Array.from(geo.getAttribute("position").array);
    mapBoxUV(geo,15,20,5);
    const after=Array.from(geo.getAttribute("position").array);
    expect(after).toEqual(before);
    const uv=geo.getAttribute("uv");
    expect(uv.getX(0)).toBeGreaterThan(0);
    expect(Math.max(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBeGreaterThan(3);
    geo.dispose();
  });
});
