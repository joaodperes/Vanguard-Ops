import {describe,expect,test} from "bun:test";
import {getMap} from "../src/lib/game-protocol";
import {makeEnvironmentMap,breakEnvironmentWall} from "../src/lib/dynamic-environment";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {visualThemeForMap} from "../src/lib/map-visuals";
import {damBreachStatus,whiteoutWeatherStatus} from "../src/lib/map-event-status";
import {FLOODGATE_CORE_ID,FLOODGATE_DAM_PANELS,floodgateBreached,floodgateBreachTargets,
  whiteoutIntensity,whiteoutVisibility,whiteoutExposure,whiteoutWindow,WHITEOUT_CYCLE_SECONDS}
  from "../src/lib/map-battle-events";

describe("Floodgate one-time Levolution",()=>{
  test("center core and four adjoining shutters have matching physics",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const walls=(map.environment??[]).filter(o=>o.type==="destructible_wall");
    const ids=[FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS];
    for(const id of ids){
      expect(walls.some(o=>o.id===id)).toBe(true);
      expect(map.cover.some(c=>c.environmentId===id)).toBe(true);
    }
    expect(floodgateBreachTargets("not_the_dam")).toHaveLength(0);
    expect(floodgateBreachTargets(FLOODGATE_CORE_ID)).toHaveLength(4);
    const state=new Map(walls.filter(o=>ids.includes(o.id)).map(o=>[o.id,o.hp]));
    expect(floodgateBreached(state)).toBe(false);
    state.set(FLOODGATE_CORE_ID,0);
    expect(floodgateBreached(state)).toBe(true);
    for(const id of ids)breakEnvironmentWall(map,id);
    for(const id of ids)expect(map.cover.some(c=>c.environmentId===id)).toBe(false);
    expect(damBreachStatus(true,map.environment??[],60)?.label).toContain("DAM BREACHED");
  });
  test("32-player rear spawn zones are separated by team",()=>{
    const map=getMap("floodgate","tdm");
    expect(map.spawns.red).toHaveLength(16);
    expect(map.spawns.blue).toHaveLength(16);
    expect(map.spawns.red.every(p=>p[0]<-120)).toBe(true);
    expect(map.spawns.blue.every(p=>p[0]>120)).toBe(true);
    const platforms=MAP_BLUEPRINTS.maps.floodgate.features.filter(f=>
      f.kind==="platform"&&f.id.includes("overlook"));
    expect(platforms.length).toBeGreaterThanOrEqual(8);
  });
});

describe("Whiteout tactical storm",()=>{
  test("storm and HUD loop are repeatable",()=>{
    expect(whiteoutIntensity(0)).toBe(0);
    expect(whiteoutWindow(15).phase).toBe("idle");
    expect(whiteoutWeatherStatus(15).label).toBe("Clear skies");
    expect(whiteoutWindow(25).phase).toBe("warning");
    expect(whiteoutIntensity(29.99)).toBe(0);
    expect(whiteoutIntensity(30.01)).toBeGreaterThan(0);
    expect(whiteoutWindow(40).phase).toBe("active");
    expect(whiteoutIntensity(40)).toBe(1);
    expect(whiteoutIntensity(80)).toBe(0);
    expect(whiteoutIntensity(40+WHITEOUT_CYCLE_SECONDS)).toBe(1);
    expect(whiteoutWeatherStatus(25).label).toContain("arriving");
    expect(whiteoutWindow(29).secondsLeft).toBe(1);
    expect(whiteoutWindow(10).phase).toBe("idle");
    expect(whiteoutWindow(20).phase).toBe("warning");
    expect(whiteoutWeatherStatus(40).label).toContain("BLIZZARD");
  });
  test("weather restricts outdoor sightlines but rewards sheltered flanks",()=>{
    expect(whiteoutVisibility(40)).toBeLessThan(45);
    expect(whiteoutExposure(0,-46)).toBe(1);
    expect(whiteoutExposure(40,0)).toBeLessThan(1);
    expect(whiteoutExposure(40,45)).toBeLessThan(1);
    expect(whiteoutVisibility(40,[40,0,45])).toBeGreaterThan(whiteoutVisibility(40,[0,0,-46]));
  });
  test("both maps remove in-world instructional sign props",()=>{
    for(const id of ["whiteout_depot","floodgate"])
      expect(visualThemeForMap(id).props.filter(p=>p.kind==="sign")).toHaveLength(0);
  });
});
