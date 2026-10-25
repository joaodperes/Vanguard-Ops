import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {mapProps,visualThemeForMap,cityBuildingBoxes,cityBandstandBoxes} from "../src/lib/map-visuals";
import {botMoveBlocked,botPositionEmbedded} from "../src/lib/bot-physics";

describe("Afterlight architectural maps",()=>{
  test("day and night share every region, spawn and collision surface",()=>{
    expect(MAPS.terminal.regions).toEqual(MAPS.arena_neon.regions);
    expect(MAPS.terminal.spawns).toEqual(MAPS.arena_neon.spawns);
    expect(MAPS.terminal.cover).toEqual(MAPS.arena_neon.cover);
    expect(MAPS.terminal.props).toEqual(MAPS.arena_neon.props);
    expect(MAPS.terminal.theme.sky).not.toBe(MAPS.arena_neon.theme.sky);
  });
  test("block density, entry openings and interior roof stairs are real",()=>{
    const props=MAPS.arena_neon.props??[];
    const buildings=props.filter(p=>p.kind==="building");
    const shops=props.filter(p=>p.kind==="shop");
    expect(buildings.length+shops.length).toBeGreaterThanOrEqual(23);
    expect(buildings.length).toBeGreaterThanOrEqual(6);
    for(const p of buildings.slice(0,8)){
      const boxes=cityBuildingBoxes(p);
      const h=p.h??6.4;
      const inside=boxes.filter(c=>c.kind==="stair"&&c.pos[0]>p.x);
      const outside=boxes.filter(c=>c.kind==="stair"&&c.pos[0]<p.x-(p.w??26)/2);
      expect(inside.length).toBeGreaterThanOrEqual(16);
      expect(outside.length).toBeGreaterThanOrEqual(16);
      expect(boxes.filter(c=>c.kind==="platform").length).toBeGreaterThanOrEqual(5);
      const front:[number,number,number]=[p.x,0,p.z+(p.d??26)/2+3];
      const doorway:[number,number,number]=[p.x,0,p.z+(p.d??26)/2-3];
      expect(botMoveBlocked(boxes,front,doorway,0)).toBe(false);
      const northOutside:[number,number,number]=[p.x,0,p.z-(p.d??26)/2-4];
      const northInside:[number,number,number]=[p.x,0,p.z-(p.d??26)/2+4];
      expect(botMoveBlocked(boxes,northOutside,northInside,0)).toBe(true);
      const crest=inside[inside.length-1];
      expect(Math.abs(crest.pos[1]+crest.size[1]-h)).toBeLessThan(.1);
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
