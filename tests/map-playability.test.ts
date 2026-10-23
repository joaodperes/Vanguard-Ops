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

  test("all staircase crests have a walkable landing; emit useful map diagnostics",()=>{
    for(const map of MAP_LIST){
      const steps=map.cover.filter(c=>c.kind==="stair");
      for(const box of steps){
        const top=box.pos[1]+box.size[1];
        const higher=steps.some(other=>other!==box&&other.pos[1]+other.size[1]>top+.15&&
          other.pos[1]+other.size[1]<top+.7&&
          Math.hypot(other.pos[0]-box.pos[0],other.pos[2]-box.pos[2])<2.1);
        if(higher)continue;
        const supported=map.cover.some(o=>o.kind!=="stair"&&o.kind!=="accent"&&
          Math.abs(o.pos[1]+o.size[1]-top)<.65&&
          Math.hypot(Math.max(0,Math.abs(o.pos[0]-box.pos[0])-o.size[0]),
            Math.max(0,Math.abs(o.pos[2]-box.pos[2])-o.size[2]))<1.1);
        if(!supported)throw new Error(map.id+" unsupported stair crest at "+JSON.stringify(box));
      }
    }
  });
  test("every solid decorative prop has collision and stays clear of spawns",()=>{
    for(const map of MAP_LIST){
      const solid=new Set(["tree","rock","ruin","temple","shop","container"]);
      const spawns=Object.values(map.spawns).flat();
      for(const prop of map.props??[]){
        if(!solid.has(prop.kind))continue;
        const blocks=map.cover.filter(c=>c.kind==="cover"&&
          Math.abs(c.pos[0]-prop.x)<.65&&Math.abs(c.pos[2]-prop.z)<.65);
        expect(blocks.length).toBeGreaterThan(0);
        for(const p of spawns)
          expect(blocks.every(c=>!(Math.abs(p[0]-c.pos[0])<c.size[0]+1.1&&
            Math.abs(p[2]-c.pos[2])<c.size[2]+1.1))).toBe(true);
      }
    }
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
