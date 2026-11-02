import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS,insideRegions} from "../src/lib/map-blueprints";
import {cityBuildingBoxes,cityInteriorFixtures} from "../src/lib/map-visuals";

describe("Afterlight street repair and purpose-built interiors",()=>{
  const night=MAPS.arena_neon,day=MAPS.terminal;
  const buildings=(night.props??[]).filter(p=>p.kind==="building");
  test("night and day retain the exact same buildings, light poles and colliders",()=>{
    expect(day.props).toEqual(night.props);
    expect(day.cover).toEqual(night.cover);
    const lamps=(night.props??[]).filter(p=>p.kind==="lamp");
    expect(lamps.length).toBeGreaterThanOrEqual(22);
    for(const light of lamps){
      expect(insideRegions(light.x,light.z,MAP_BLUEPRINTS.maps.arena_neon.regions,1)).toBe(true);
      expect(buildings.every(p=>Math.abs(light.x-p.x)>=(p.w??20)/2+1 ||
        Math.abs(light.z-p.z)>=(p.d??20)/2+1)).toBe(true);
    }
  });
  test("slender edge shops and houses occupy formerly empty wall-side streets safely",()=>{
    const small=buildings.filter(p=>(p.w??99)<=11.5&&(p.d??99)<=14.5);
    expect(small.length).toBeGreaterThanOrEqual(8);
    expect(new Set(small.map(p=>p.use)).size).toBeGreaterThanOrEqual(3);
    const regions=MAP_BLUEPRINTS.maps.arena_neon.regions;
    for(const p of small) {
      expect(p.roofAccess).toBe(false);
      for(const sx of [-1,1])for(const sz of [-1,1])
        expect(insideRegions(p.x+sx*(p.w??10)/2,p.z+sz*(p.d??13)/2,regions,1)).toBe(true);
    }
    for(const [team,spawns] of Object.entries(night.spawns))
      for(const spawn of spawns){
        expect(small.every(p=>cityBuildingBoxes(p).every(c=>
          !(Math.abs(spawn[0]-c.pos[0])<c.size[0]+1.2&&
            Math.abs(spawn[2]-c.pos[2])<c.size[2]+1.2&&
            spawn[1]<c.pos[1]+c.size[1]&&spawn[1]+1.8>c.pos[1]-c.size[1])))).toBe(true);
      }
  });
  test("shops, houses, clinics and workshops use distinct reproducible interior arrangements",()=>{
    const layouts=new Set<string>(),styles=new Set<string>();
    for(const p of buildings){
      const f=cityInteriorFixtures(p);
      expect(f).toEqual(cityInteriorFixtures(p));
      for(const part of f)styles.add(part.style);
      layouts.add(f.map(part=>part.style+":"+part.x.toFixed(1)+":"+part.z.toFixed(1)).join("/"));
    }
    expect(layouts.size).toBeGreaterThanOrEqual(18);
    expect(styles.size).toBeGreaterThanOrEqual(12);
    for(const use of ["house","cafe","supermarket","office","clinic","workshop","gym"]){
      expect(buildings.some(p=>p.use===use&&cityInteriorFixtures(p).some(f=>f.style!=="partition"))).toBe(true);
    }
  });
});

describe("Ridgefall unblocked breakable freight door",()=>{
  test("only authored security gate is destructible, located outside every staircase",()=>{
    const map=MAPS.skybridge;
    const gates=(map.environment??[]).filter(e=>e.type==="destructible_wall");
    expect(gates).toHaveLength(1);
    expect(gates[0].id).toBe("factory-blast-door");
    const gate=gates[0];
    for(const c of map.cover.filter(c=>c.kind==="stair")){
      const overlaps=Math.abs(gate.pos[0]-c.pos[0])<gate.size[0]+c.size[0] &&
        Math.abs(gate.pos[2]-c.pos[2])<gate.size[2]+c.size[2] &&
        Math.abs(gate.pos[1]-c.pos[1])<gate.size[1]+c.size[1];
      expect(overlaps).toBe(false);
    }
    expect(gate.hp).toBeLessThanOrEqual(180);
    const frames=MAP_BLUEPRINTS.maps.skybridge.features.filter(f=>f.id.startsWith("shipping-security")||f.id.startsWith("freight-security"));
    expect(frames).toHaveLength(4);
    expect(frames.every(f=>Math.abs(f.z-gate.pos[2])<.01)).toBe(true);
  });
  test("removes floating room labels but retains control consoles and machinery",()=>{
    const props=MAPS.skybridge.props??[];
    expect(props.some(p=>p.kind==="sign")).toBe(false);
    expect(props.filter(p=>p.kind==="industrial_pipe").length).toBeGreaterThanOrEqual(18);
    expect(props.filter(p=>p.kind==="terminal").length).toBeGreaterThanOrEqual(8);
    expect(props.some(p=>p.kind==="furnace")).toBe(true);
  });
});
