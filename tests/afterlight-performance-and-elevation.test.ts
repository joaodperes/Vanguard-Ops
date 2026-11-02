import {describe,test,expect} from "bun:test";
import {MAPS, type CoverBox} from "../src/lib/game-protocol";
import {CoverSpatialIndex} from "../src/lib/cover-spatial-index";
import {cityHighGroundGoals,chooseCityHighGroundGoal,cityHighGroundStep} from "../src/lib/city-high-ground";
import {cityHasUsableInteriorStairs,cityBuildingBoxes} from "../src/lib/map-visuals";
import {botMoveBlocked,botGroundHeight} from "../src/lib/bot-physics";

describe("Afterlight efficient physical collision",()=>{
  const map=MAPS.arena_neon;
  const cover=map.cover;
  test("spatial broadphase retains exact obstacles at player and bot positions",()=>{
    const index=new CoverSpatialIndex(cover);
    const positions:[[number,number],...[number,number][]]=[[0,0],[44,55],[142,-80],[-150,-140],[168,22]];
    for(const [x,z] of positions){
      const local=index.near(x,z,3);
      const expected=cover.filter(c=>
        c.pos[0]+c.size[0]>=x-3&&c.pos[0]-c.size[0]<=x+3&&
        c.pos[2]+c.size[2]>=z-3&&c.pos[2]-c.size[2]<=z+3);
      expect(new Set(local)).toEqual(new Set(expected));
      expect(botGroundHeight(local,x,z,0)).toBe(botGroundHeight(cover,x,z,0));
    }
    const from:[number,number,number]=[30,0,30],to:[number,number,number]=[38,0,42];
    const nearby=index.along(from[0],from[2],to[0],to[2],2);
    expect(botMoveBlocked(nearby,from,to,0)).toBe(botMoveBlocked(cover,from,to,0));
  });
  test("interior roof hatches exist only for safe, climbable stair footprints",()=>{
    const buildings=(map.props??[]).filter(p=>p.kind==="building");
    const sealed=buildings.filter(p=>p.roofAccess&&p.shape!=="round"&&!cityHasUsableInteriorStairs(p));
    const open=buildings.filter(p=>cityHasUsableInteriorStairs(p));
    expect(sealed.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    for(const p of sealed){
      const roof=cityBuildingBoxes(p).filter(c=>c.kind==="platform"&&
        Math.abs(c.pos[1]-(p.y??0)-(p.h??6.4)-.16)<.05);
      expect(roof.some(c=>
        Math.abs(c.pos[0]-p.x)<.1&&Math.abs(c.pos[2]-p.z)<.1&&
        c.size[0]>=(p.w??20)/2-.1&&c.size[2]>=(p.d??20)/2-.1)).toBe(true);
      expect(cityBuildingBoxes(p).filter(c=>c.kind==="stair").length).toBeGreaterThan(0);
    }
    for(const p of open){
      const flight=cityBuildingBoxes(p).filter(c=>c.kind==="stair"&&
        Math.abs(c.pos[0]-p.x)<(p.w??20)/2);
      expect(flight.length).toBeGreaterThan(5);
    }
  });
  test("bots have physical bandstand and rooftop objectives, not imaginary jump targets",()=>{
    const props=map.props??[];
    const goals=cityHighGroundGoals(props);
    expect(goals.some(g=>g.kind==="bandstand")).toBe(true);
    expect(goals.filter(g=>g.kind==="roof").length).toBeGreaterThan(4);
    const goal=chooseCityHighGroundGoal([5,0,28],goals,0);
    expect(goal).not.toBeNull();
    const waypoint=cityHighGroundStep(goal!.entry,goal!,map.cover);
    expect(Number.isFinite(waypoint[0])&&Number.isFinite(waypoint[1])&&Number.isFinite(waypoint[2])).toBe(true);
    // Every planned entry lies on a real stair tread.
    for(const g of goals){
      expect(map.cover.some(c=>c.kind==="stair"&&
        Math.abs(c.pos[0]-g.entry[0])<.001&&
        Math.abs(c.pos[2]-g.entry[2])<.001&&
        Math.abs(c.pos[1]+c.size[1]-g.entry[1])<.001)).toBe(true);
    }
  });
  test("daytime and nighttime city share collision and elevated patrol anchors",()=>{
    expect(MAPS.terminal.cover).toEqual(MAPS.arena_neon.cover);
    expect(cityHighGroundGoals(MAPS.terminal.props??[])).toEqual(cityHighGroundGoals(map.props??[]));
  });
});
