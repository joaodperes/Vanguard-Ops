/**
 * Scale the legacy central geometry while composing distinct JSON-authored
 * connected districts around it. The region union (not map.size) defines the
 * playable outline; map.size remains a bounding-square broadphase for legacy
 * physics, network and radar coordinates.
 */
import type { MapDef, MapId, Vec3, EnvironmentObject } from "./game-protocol";
import { MAP_BLUEPRINTS, featureBoxes, regionBoundary, authoredHazardEnvironment, compileVisibleLegacyBoxes, type MapBlueprint } from "./map-blueprints";
import { visualThemeForMap, paletteToGameTheme, mapProps, propColliders, type MapVisualTheme } from "./map-visuals";
import { detectLegacyStairFlights } from "./legacy-stair-flights";

export type MapPace = "compact" | "balanced" | "tactical";
export const MAP_FOOTPRINT: Record<MapId, { scale: number; pace: MapPace; description: string }> = {
  bunker: {scale:0.72,pace:"compact",description:"Tight vault rooms and rapid circular flanks"},
  shipyard: {scale:0.88,pace:"compact",description:"Short dockside brawls around crane and market cover"},
  compound: {scale:0.98,pace:"balanced",description:"Mossy jungle courtyards, rocks and temple flanks"},
  terminal: {scale:1.02,pace:"tactical",description:"Afterlight City shared neighborhood in natural daylight"},
  skybridge: {scale:1.07,pace:"tactical",description:"Enclosed steelworks with machinery lanes, freight bays and elevated gantries"},
  arena_neon: {scale:1.02,pace:"tactical",description:"Downtown markets, vibrant shopfronts and rooftop fighting"},
};
const scaled=(p:Vec3,s:number):Vec3=>[Math.round(p[0]*s*1000)/1000,p[1],Math.round(p[2]*s*1000)/1000];
function scaleEnvironment(o:EnvironmentObject,s:number):EnvironmentObject {
  const pos=scaled(o.pos,s),size=scaled(o.size,s);
  if(o.type==="moving_platform")return {...o,pos,size,to:scaled(o.to,s)};
  if(o.type==="jump_pad")return {...o,pos,size,launch:scaled(o.launch,s)};
  return {...o,pos,size};
}
export function applyMapFootprint(base:MapDef,draft?:{blueprint:MapBlueprint;theme:MapVisualTheme}):MapDef {
  const factor=MAP_FOOTPRINT[base.id]?.scale ?? 1;
  // Re-entrant use (including old test fixtures) should not stamp districts twice.
  const plan=draft?.blueprint??((!base.regions?.length && base.size>=40)?MAP_BLUEPRINTS.maps[base.id]:null);
  const environment=(base.id==="arena_neon"||base.id==="terminal"||base.id==="skybridge"?[]:base.environment??[]).map(o=>scaleEnvironment(o,factor));
  const scaledBase:MapDef={
    ...base,size:Math.round(base.size*factor*1000)/1000,
    // Old maps included a full rectangular perimeter. Leaving these walls
    // behind turns the new outdoor districts into inaccessible rings.
    // Region-union walls replace these, without blocking core-to-flank travel.
    cover:(base.id==="arena_neon"||base.id==="terminal"||base.id==="skybridge"?[]:base.cover).filter(c=>{
      const longX=c.size[0] > base.size*.7 && c.size[2]<2.5 && Math.abs(c.pos[2])>base.size*.8;
      const longZ=c.size[2] > base.size*.7 && c.size[0]<2.5 && Math.abs(c.pos[0])>base.size*.8;
      // Elevated walkways must remain: only ground-level perimeter barriers
      // are redundant. Removing a walkway strands its approach staircase.
      return !(c.kind === "cover" && (longX||longZ));
    }).map(c=>({...c,pos:scaled(c.pos,factor),size:scaled(c.size,factor)})),
    spawns:{
      // Ridgefall is now a factory inside a completely new walkable footprint.
      // Old outdoor spawn coordinates must not leak into the new hall.
      ffa:base.id==="skybridge"?[]:base.spawns.ffa.map(p=>scaled(p,factor)),
      red:base.id==="skybridge"?[]:base.spawns.red.map(p=>scaled(p,factor)),
      blue:base.id==="skybridge"?[]:base.spawns.blue.map(p=>scaled(p,factor)),
    },
    environment,
    lights:base.lights?.map(l=>({...l,pos:scaled(l.pos,factor),distance:l.distance*factor})),
    theme:{...base.theme,fogNear:base.theme.fogNear*factor,fogFar:base.theme.fogFar*factor},
    ...(base.regions?{regions:base.regions.map(r=>({...r,x:r.x*factor,z:r.z*factor,w:r.w*factor,d:r.d*factor}))}:{}),
  };
  if(!plan)return scaledBase;
  const regions=plan.regions.map(r=>({...r}));
  const visuals=draft?.theme??visualThemeForMap(base.id,plan.templateMapId);
  // Afterlight's predecessor was a small 128x128 arena with spawn points
  // clustered immediately around the central plaza. Those inherited spawns
  // forced every proposed park-edge house to disappear. The authored city
  // already provides neighbourhood spawns; retain only its legacy OUTER
  // fallbacks, not the obsolete central arena positions.
  const isAfterlight=base.id==="arena_neon"||base.id==="terminal";
  const activeLegacySpawns={
    ffa:isAfterlight?scaledBase.spawns.ffa.slice(-6):scaledBase.spawns.ffa,
    red:isAfterlight?scaledBase.spawns.red.slice(-3):scaledBase.spawns.red,
    blue:isAfterlight?scaledBase.spawns.blue.slice(-3):scaledBase.spawns.blue,
  };
  const allSpawns=[...activeLegacySpawns.ffa,...activeLegacySpawns.red,...activeLegacySpawns.blue,
    ...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue];
  const props=mapProps(base.id,plan,visuals,allSpawns);
  const obstructsSpawn=(c:import("./game-protocol").CoverBox)=>allSpawns.some(p=>
    Math.abs(p[0]-c.pos[0]) < c.size[0]+1.25 &&
    Math.abs(p[2]-c.pos[2]) < c.size[2]+1.25 &&
    p[1]+1.8>c.pos[1]-c.size[1] && p[1]<c.pos[1]+c.size[1]+.3);
  // Preserve all spawn choices. A cover island or its approach stairs must
  // not strand the surrounding playable district or spawn-kill a player.
  const flankFeatures=plan.features.filter(f=>!featureBoxes(f).some(obstructsSpawn));
  const halfExtent=Math.max(...regions.flatMap(r=>[Math.abs(r.x)+r.w/2,Math.abs(r.z)+r.d/2]))+3;
  // Older inner-circle spawn sets remain as fallbacks; larger districts receive
  // many additional spawns so players do not endlessly recycle the center.
  // Preserve the source outer-ring entries as the final entries for diagnostics.
  const addSpawns=(team:"ffa"|"red"|"blue")=>{
    const old=scaledBase.spawns[team], outerLen=team==="ffa"?6:3;
    if(base.id==="skybridge")return plan.spawns[team].map(p=>[...p] as Vec3);
    if(isAfterlight)return [...plan.spawns[team].map(p=>[...p] as Vec3),...old.slice(-outerLen)];
    return [...old.slice(0,-outerLen),...plan.spawns[team].map(p=>[...p] as Vec3),...old.slice(-outerLen)];
  };
  const legacyCoverSource=scaledBase.cover.filter(c=>{
    if(base.id!=="shipyard"||c.kind!=="cover")return true;
    const stairs=scaledBase.cover.filter(b=>b.kind==="stair"&&
      (Math.abs(b.pos[0])>24||Math.abs(b.pos[2])>24));
    return !stairs.some(b=>{
      const stairTop=b.pos[1]+b.size[1],coverTop=c.pos[1]+c.size[1];
      return stairTop>2.5 && coverTop>stairTop+1.2 &&
        Math.abs(c.pos[0]-b.pos[0])<c.size[0]+b.size[0]+.1 &&
        Math.abs(c.pos[2]-b.pos[2])<c.size[2]+b.size[2]+.1;
    });
  });
  // Detect flights before spatial overrides, so groups remain stable even when
  // a user modifies an individual tread's position or elevation.
  const editorLegacyStairFlights=detectLegacyStairFlights(legacyCoverSource);
  const legacyCover=compileVisibleLegacyBoxes(
    legacyCoverSource,plan.legacyCoverDisabled,plan.legacyCoverOverrides);
  // Ridgefall replaces the old skybridge arena. The inherited breakable wall
  // at (0,-28) sat inside the new central staircase, could absorb shots and
  // was not a usable doorway. Keep only authored factory hazards instead.
  const legacyEnvironmentSource=base.id==="skybridge"
    ?(scaledBase.environment??[]).filter(o=>o.id!=="skybridge_wall")
    :scaledBase.environment??[];
  const legacyEnvironment=compileVisibleLegacyBoxes(
    legacyEnvironmentSource,plan.legacyEnvironmentDisabled,plan.legacyEnvironmentOverrides);
  return {
    ...scaledBase,name:plan.name,shortName:plan.shortName,description:plan.description,
    editorLegacyCoverCount:legacyCover.length,
    editorLegacyCoverSource:legacyCoverSource,
    editorLegacyStairFlights,
    editorLegacyEnvironmentSource:legacyEnvironmentSource,
    editorLegacyEnvironmentCount:legacyEnvironment.length,
    size:Math.max(scaledBase.size,Math.ceil(halfExtent)),wallHeight:base.id==="skybridge"?18:Math.max(base.wallHeight,11),
    regions,
    environment:[...legacyEnvironment,...(plan.hazards??[]).map(authoredHazardEnvironment)],
    cover:[...legacyCover,...flankFeatures.flatMap(featureBoxes),
      ...propColliders(props,allSpawns),
      ...regionBoundary(regions,base.id==="shipyard"?1.2:base.id==="skybridge"?18:11)],
    spawns:{ffa:addSpawns("ffa"),red:addSpawns("red"),blue:addSpawns("blue")},
    props,biome:visuals.biome,surfaces:visuals.surfaces,accentColor:visuals.palette.accent,
    theme:{...paletteToGameTheme(visuals,scaledBase.theme),fogNear:Math.max(35,scaledBase.theme.fogNear),
      fogFar:Math.max(scaledBase.theme.fogFar,halfExtent*2.5+60)},
  };
}
