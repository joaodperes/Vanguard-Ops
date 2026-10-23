import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {mapProps,visualThemeForMap} from "../src/lib/map-visuals";

describe("Afterlight architectural maps",()=>{
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
    const harbor=MAPS.shipyard.props??[];
    for(const k of ["boat","crane","dock","container"])
      expect(harbor.some(p=>p.kind===k)).toBe(true);
    expect((MAPS.compound.props??[]).filter(p=>["tree","bush","rock","ruin","temple"].includes(p.kind)).length).toBeGreaterThan(10);
    expect((MAPS.skybridge.props??[]).filter(p=>["tree","rock"].includes(p.kind)).length).toBeGreaterThan(10);
  });
});
