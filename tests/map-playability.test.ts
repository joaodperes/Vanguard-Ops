import {describe,expect,test} from "bun:test";
import {MAP_LIST} from "../src/lib/game-protocol";
import {makeEnvironmentMap} from "../src/lib/dynamic-environment";
import {botPositionEmbedded} from "../src/lib/bot-physics";
import {insideRegions} from "../src/lib/map-blueprints";

describe("map scale and route accessibility",()=>{
  test("compact, medium and enormous layouts coexist",()=>{
    const byId=Object.fromEntries(MAP_LIST.map(m=>[m.id,m]));
    expect(byId.bunker.size*2).toBeLessThan(140);
    expect(byId.shipyard.size*2).toBeLessThan(170);
    expect(byId.compound.size*2).toBeGreaterThan(240);
    expect(byId.skybridge.size*2).toBeGreaterThan(380);
    expect(byId.arena_neon.size*2).toBeGreaterThan(380);
  });
  test("every authored and inherited spawn clears hard geometry",()=>{
    for(const map of MAP_LIST){
      const cover=makeEnvironmentMap(map).cover;
      for(const team of ["ffa","red","blue"] as const){
        for(const p of map.spawns[team]){
          if(botPositionEmbedded(cover,p)){
            const near=cover.filter(c=>Math.abs(p[0]-c.pos[0])<c.size[0]+3&&Math.abs(p[2]-c.pos[2])<c.size[2]+3);
            throw new Error(map.id+" "+team+" spawn ["+p+"] is blocked by "+JSON.stringify(near.slice(0,3)));
          }
        }
      }
    }
  });
  test("every blueprint flank has an open, multi-unit connection",()=>{
    for(const map of MAP_LIST){
      const regions=map.regions??[];
      for(let i=1;i<regions.length;i++){
        const r=regions[i];
        const overlap=regions.slice(0,i).some(other=>{
          const w=Math.min(r.x+r.w/2,other.x+other.w/2)-Math.max(r.x-r.w/2,other.x-other.w/2);
          const d=Math.min(r.z+r.d/2,other.z+other.d/2)-Math.max(r.z-r.d/2,other.z-other.d/2);
          return w>7&&d>7;
        });
        expect(overlap).toBe(true);
      }
      for(const p of Object.values(map.spawns).flat()){
        if(!insideRegions(p[0],p[2],regions,0)){
          // Inherited templates may retain a few out-of-bounds spawns;
          // these need relocation rather than an invisible playable square.
          throw new Error(map.id+" spawn ["+p+"] outside connected region union");
        }
      }
    }
  });
});
