import {describe,expect,test} from "bun:test";
import {compileMapStudioDraft,getMap} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {visualThemeForMap} from "../src/lib/map-visuals";

describe("Map Studio unsaved offline playtests",()=>{
  test("compiles real gameplay geometry without changing the published map",()=>{
    const id="arena_neon";
    const blueprint=structuredClone(MAP_BLUEPRINTS.maps[id]);
    const theme=structuredClone(visualThemeForMap(id));
    const before=getMap(id);
    const preview=compileMapStudioDraft(id,blueprint,theme);
    expect(preview.regions).toEqual(before.regions);
    expect(preview.spawns).toEqual(before.spawns);
    expect(preview.cover).toEqual(before.cover);
    expect(preview.props).toEqual(before.props);
    blueprint.features.push({id:"draft_block",kind:"cover",x:120,z:110,w:6,d:6,h:3});
    const modified=compileMapStudioDraft(id,blueprint,theme);
    expect(modified.cover.length).toBeGreaterThan(preview.cover.length);
    expect(getMap(id)).toBe(before);
    expect(getMap(id).cover).toEqual(preview.cover);
  });
  test("uses the chosen day/night appearance with matching draft collisions",()=>{
    const blueprint=structuredClone(MAP_BLUEPRINTS.maps.arena_neon);
    const night=compileMapStudioDraft("arena_neon",blueprint,structuredClone(visualThemeForMap("arena_neon")));
    const day=compileMapStudioDraft("terminal",blueprint,structuredClone(visualThemeForMap("terminal")));
    expect(day.cover).toEqual(night.cover);
    expect(day.spawns).toEqual(night.spawns);
    expect(day.theme.sky).not.toEqual(night.theme.sky);
  });
});
