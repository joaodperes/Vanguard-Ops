import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {mapProps,visualThemeForMap,cityBuildingBoxes,cityBandstandBoxes,cityInteriorFixtures,cityHasUsableInteriorStairs} from "../src/lib/map-visuals";
import {botMoveBlocked,botPositionEmbedded} from "../src/lib/bot-physics";

describe("Afterlight architectural maps",()=>{
  test("day and night share every region, spawn and collision surface",()=>{
    expect(MAPS.terminal.regions).toEqual(MAPS.arena_neon.regions);
    expect(MAPS.terminal.spawns).toEqual(MAPS.arena_neon.spawns);
    expect(MAPS.terminal.cover).toEqual(MAPS.arena_neon.cover);
    expect(MAPS.terminal.props).toEqual(MAPS.arena_neon.props);
    expect(MAPS.terminal.theme.sky).not.toBe(MAPS.arena_neon.theme.sky);
  });
  test("Afterlight lots have diverse purposes, footprints, heights and stairs",()=>{
    const props=MAPS.arena_neon.props??[];
    const buildings=props.filter(p=>p.kind==="building");
    expect(buildings.length).toBeGreaterThanOrEqual(30);
    expect(new Set(buildings.map(p=>p.use)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(buildings.map(p=>p.facade)).size).toBeGreaterThanOrEqual(4);
    expect(buildings.some(p=>p.roofAccess === false)).toBe(true);
    expect(buildings.some(p=>p.roofAccess === true)).toBe(true);
    expect(new Set(buildings.map(p=>p.shape)).size).toBe(3);
    expect(new Set(buildings.map(p=>p.w+"x"+p.d)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(buildings.map(p=>p.h)).size).toBeGreaterThanOrEqual(5);
    expect(buildings.some(p=>(p.h??0)>9)).toBe(true);
    expect(buildings.some(p=>p.stairSide==="east")).toBe(true);
    expect(buildings.some(p=>p.stairSide==="west")).toBe(true);
    for(const use of ["house","cafe","supermarket","apartments","office"])
      expect(buildings.some(p=>p.use===use)).toBe(true);
    // Infill touches all four sides of the park with small residences, without
    // placing solid footprints in the 80x80 grass square.
    const infill=buildings.filter(p=>p.use==="house" && p.w===14 && p.d===15);
    expect(infill.length).toBeGreaterThanOrEqual(4);
    expect(infill.some(p=>p.x>45&&Math.abs(p.z)<30)).toBe(true);
    expect(infill.some(p=>p.x< -45&&Math.abs(p.z)<30)).toBe(true);
    expect(infill.some(p=>p.z>45&&Math.abs(p.x)<30)).toBe(true);
    expect(infill.some(p=>p.z< -45&&Math.abs(p.x)<30)).toBe(true);
    for(const p of buildings){
      const w=p.w??20,d=p.d??20,h=p.h??6.4;
      expect(Math.abs(p.x)>40+w/2 || Math.abs(p.z)>40+d/2).toBe(true);
      const boxes=cityBuildingBoxes(p);
      const outer=boxes.filter(c=>c.kind==="stair"&&
        (p.stairSide==="east" ? c.pos[0]>p.x+w/2 : c.pos[0]<p.x-w/2));
      const inner=boxes.filter(c=>c.kind==="stair" && c.pos[0]>p.x && c.pos[0]<p.x+w/2);
      if(p.roofAccess){
        expect(outer.length).toBeGreaterThanOrEqual(11);
        expect(inner.length).toBe(cityHasUsableInteriorStairs(p)?Math.ceil(h/.39):0);
        if(!cityHasUsableInteriorStairs(p)){
          // No interior staircase means a solid roof: never a lethal hole.
          expect(boxes.some(c=>c.kind==="platform"&&
            Math.abs(c.pos[0]-p.x)<.01&&Math.abs(c.pos[2]-p.z)<.01&&
            c.size[0]>=(p.w??20)/2-.1&&c.size[2]>=(p.d??20)/2-.1)).toBe(p.shape!=="round");
        }
        expect(boxes.filter(c=>c.kind==="platform").length).toBeGreaterThanOrEqual(p.shape==="round"?4:cityHasUsableInteriorStairs(p)?6:2);
        const crest=outer[outer.length-1];
        expect(Math.abs(crest.pos[1]+crest.size[1]-h)).toBeLessThan(.1);
      }else{
        expect(outer).toHaveLength(0);
        expect(inner).toHaveLength(0);
        // The roof is still physically present and the player can enter
        // the building, but no internal/external stairway grants roof access.
        expect(boxes.filter(c=>c.kind==="platform"||c.kind==="cover")
          .some(c=>Math.abs(c.pos[1]-h-.16)<.01)).toBe(true);
      }
      const front:[number,number,number]=[p.x,0,p.z+d/2+2.5];
      const doorway:[number,number,number]=[p.x,0,p.z+d/2-2.5];
      expect(botMoveBlocked(boxes,front,doorway,0)).toBe(false);
      const northOutside:[number,number,number]=[p.x,0,p.z-d/2-3];
      const northInside:[number,number,number]=[p.x,0,p.z-d/2+3];
      expect(botMoveBlocked(boxes,northOutside,northInside,0)).toBe(true);
      const fixtures=cityInteriorFixtures(p);
      expect(fixtures.length).toBeGreaterThanOrEqual(3);
      expect(fixtures.some(f=>f.style==="partition")).toBe(true);
      expect(fixtures.some(f=>f.style!=="partition")).toBe(true);
      for(const item of fixtures){
        expect(boxes.some(c=>c.kind==="cover" &&
          Math.abs(c.pos[0]-(p.x+item.x))<.001 &&
          Math.abs(c.pos[2]-(p.z+item.z))<.001 &&
          Math.abs(c.size[1]-item.h/2)<.001)).toBe(true);
      }
    }
    // Interior styles actually distinguish the purposes rather than random crates.
    const styleFor=(use:string)=>buildings.filter(p=>p.use===use)
      .flatMap(p=>cityInteriorFixtures(p).map(f=>f.style));
    expect(styleFor("house")).toContain("bed");
    expect(styleFor("supermarket")).toContain("shelf");
    expect(styleFor("office")).toContain("desk");
    expect(styleFor("cafe")).toContain("counter");
    // A clear 3.4m center opening connects the street entrance to rear rooms.
    for(const p of buildings){
      const d=p.d??20, boxes=cityBuildingBoxes(p);
      const entry:[number,number,number]=[p.x,0,p.z+d/2-1.5];
      const rear:[number,number,number]=[p.x,0,p.z-d*.30];
      expect(botMoveBlocked(boxes,entry,rear,0)).toBe(false);
    }
    const bandstand=props.find(p=>p.kind==="bandstand")!;
    expect(cityBandstandBoxes(bandstand).filter(c=>c.kind==="cover").length).toBe(4);
    const stairs=MAPS.arena_neon.cover.filter(c=>c.kind==="stair");
    for(const p of props.filter(p=>["tree","bush"].includes(p.kind)))
      expect(stairs.some(c=>Math.abs(c.pos[0]-p.x)<c.size[0]+1&&
        Math.abs(c.pos[2]-p.z)<c.size[2]+1)).toBe(false);
  });
    test("night and day scenes contain no gameplay hazards or legacy arena debris",()=>{
    for(const id of ["arena_neon","terminal"]){
      const m=MAPS[id];
      expect(m.environment ?? []).toEqual([]);
      expect(MAP_BLUEPRINTS.maps[id].features).toEqual([]);
      expect(m.props?.some(p=>p.kind==="garden")).toBe(true);
      expect(m.props?.some(p=>p.kind==="bandstand")).toBe(true);
      expect(m.props?.some(p=>p.kind==="building"||p.kind==="shop")).toBe(true);
    }
    expect(MAPS.terminal.name).toBe("Afterlight City (Day)");
  });
  test("day/night reuse one city grammar when given the same blueprint",()=>{
    const blueprint=MAP_BLUEPRINTS.maps.arena_neon;
    const night=mapProps("arena_neon",blueprint,visualThemeForMap("arena_neon"));
    const day=mapProps("terminal",blueprint,visualThemeForMap("terminal"));
    const architecture=(props:typeof night)=>props.filter(p=>["building","shop","garden","bandstand","lamp"].includes(p.kind));
    expect(architecture(day)).toEqual(architecture(night));
    expect(MAPS.terminal.theme.sky).not.toBe(MAPS.arena_neon.theme.sky);
  });
  test("urban interiors and the park platform have real walkable geometry",()=>{
    const city=MAPS.arena_neon;
    expect(city.props?.filter(p=>p.kind==="building").length).toBeGreaterThan(0);
    expect(city.cover.some(c=>c.kind==="platform" && c.pos[0]===0 && c.pos[2]===0)).toBe(true);
    expect(city.cover.some(c=>c.kind==="stair" && Math.abs(c.pos[0])<15 && Math.abs(c.pos[2])<23)).toBe(true);
  });
  test("harbor has boats, cranes and docks; jungle and highlands have more native scenery",()=>{
    expect(MAPS.shipyard.cover.filter(c=>c.kind==="solid").every(c=>c.size[1]<=.61)).toBe(true);
    expect(MAPS.shipyard.environment?.some(e=>e.type==="fire"||e.type==="jump_pad")).toBe(false);
    expect(MAPS.compound.environment?.some(e=>["fire","jump_pad","moving_platform"].includes(e.type))).toBe(false);
    const harbor=MAPS.shipyard.props??[];
    const painted=harbor.filter(p=>p.kind==="container"&&!!p.color);
    expect(painted.length).toBeGreaterThanOrEqual(6);
    expect(new Set(painted.map(p=>p.color)).size).toBeGreaterThanOrEqual(3);
    for(const k of ["boat","crane","dock","container"])
      expect(harbor.some(p=>p.kind===k)).toBe(true);
    expect((MAPS.compound.props??[]).filter(p=>["tree","bush","rock","ruin","temple"].includes(p.kind)).length).toBeGreaterThan(10);
    expect(MAPS.skybridge.biome).toBe("factory_interior");
    expect((MAPS.skybridge.props??[]).filter(p=>["crane","container","lamp","terminal"].includes(p.kind)).length).toBeGreaterThan(14);
    expect((MAPS.skybridge.props??[]).some(p=>p.kind==="tree")).toBe(false);
  });
});
