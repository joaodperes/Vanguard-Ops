import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {cityBuildingBoxes,cityHasUsableInteriorStairs} from "../src/lib/map-visuals";
import {cityHighGroundGoals,chooseCityHighGroundGoal,cityHighGroundStep} from "../src/lib/city-high-ground";
describe("Afterlight roof safety and bot high-ground anchors",()=>{
  const props=MAPS.arena_neon.props??[];
  test("every unusable interior staircase has a completely sealed rooftop slab",()=>{
    let sealed=0;
    for(const p of props.filter(p=>p.kind==="building")){
      const boxes=cityBuildingBoxes(p);
      const roofY=(p.y??0)+(p.h??6.4)+.16;
      const roof=boxes.filter(c=>c.kind==="platform"&&Math.abs(c.pos[1]-roofY)<.1);
      expect(roof.length).toBeGreaterThan(0);
      if(p.shape!=="round"&&!cityHasUsableInteriorStairs(p)){
        sealed++;
        const center=roof.filter(c=>Math.abs(c.pos[0]-p.x)<.1&&Math.abs(c.pos[2]-p.z)<.1);
        expect(center.length).toBeGreaterThan(0);
        expect(center[0].size[0]*2).toBeCloseTo(p.w??20);
        expect(center[0].size[2]*2).toBeCloseTo(p.d??20);
      }
    }
    expect(sealed).toBeGreaterThan(6);
  });
  test("high-ground patrol goals include an actual bandstand and multiple accessible roof stairs",()=>{
    const goals=cityHighGroundGoals(props);
    expect(goals.some(g=>g.kind==="bandstand")).toBe(true);
    expect(goals.filter(g=>g.kind==="roof").length).toBeGreaterThan(4);
    for(const goal of goals){
      const nearby=MAPS.arena_neon.cover.filter(c=>c.kind==="stair"&&
        Math.hypot(goal.entry[0]-c.pos[0],goal.entry[2]-c.pos[2])<1.2);
      expect(nearby.some(c=>Math.abs(goal.entry[1]-(c.pos[1]+c.size[1]))<.1)).toBe(true);
      expect(goal.roof[1]).toBeGreaterThan(goal.entry[1]+1);
      const selected=chooseCityHighGroundGoal(
        [goal.entry[0]+13,0,goal.entry[2]+5],goals,0);
      expect(selected).not.toBeNull();
      const waypoint=cityHighGroundStep([goal.entry[0]+6,0,goal.entry[2]],goal,MAPS.arena_neon.cover);
      expect(waypoint.every(Number.isFinite)).toBe(true);
    }
  });
});
