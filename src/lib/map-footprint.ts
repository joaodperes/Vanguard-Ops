/**
 * Scale the legacy central geometry while composing distinct JSON-authored
 * connected districts around it. The region union (not map.size) defines the
 * playable outline; map.size remains a bounding-square broadphase for legacy
 * physics, network and radar coordinates.
 */
import type { MapDef, MapId, Vec3, EnvironmentObject } from "./game-protocol";
import { MAP_BLUEPRINTS, featureBoxes, regionBoundary } from "./map-blueprints";
import { visualThemeForMap, paletteToGameTheme, mapProps, propColliders } from "./map-visuals";

export type MapPace = "compact" | "balanced" | "tactical";
export const MAP_FOOTPRINT: Record<MapId, { scale: number; pace: MapPace; description: string }> = {
  bunker: {scale:0.72,pace:"compact",description:"Tight vault rooms and rapid circular flanks"},
  shipyard: {scale:0.88,pace:"compact",description:"Short dockside brawls around crane and market cover"},
  compound: {scale:0.98,pace:"balanced",description:"Mossy jungle courtyards, rocks and temple flanks"},
  terminal: {scale:1.00,pace:"balanced",description:"Transit plazas, shops and street-level crossfires"},
  skybridge: {scale:1.07,pace:"tactical",description:"Mountain ridges, alpine overlooks and rocky cover"},
  arena_neon: {scale:1.02,pace:"tactical",description:"Downtown markets, vibrant shopfronts and rooftop fighting"},
};
const scaled=(p:Vec3,s:number):Vec3=>[Math.round(p[0]*s*1000)/1000,p[1],Math.round(p[2]*s*1000)/1000];
function scaleEnvironment(o:EnvironmentObject,s:number):EnvironmentObject {
  const pos=scaled(o.pos,s),size=scaled(o.size,s);
  if(o.type==="moving_platform")return {...o,pos,size,to:scaled(o.to,s)};
  if(o.type==="jump_pad")return {...o,pos,size,launch:scaled(o.launch,s)};
  return {...o,pos,size};
}
export function applyMapFootprint(base:MapDef):MapDef {
  const factor=MAP_FOOTPRINT[base.id]?.scale ?? 1;
  // Re-entrant use (including old test fixtures) should not stamp districts twice.
  const plan=(!base.regions?.length && base.size>=40)?MAP_BLUEPRINTS.maps[base.id]:null;
  const environment=base.environment?.map(o=>scaleEnvironment(o,factor));
  const scaledBase:MapDef={
    ...base,size:Math.round(base.size*factor*1000)/1000,
    // Old maps included a full rectangular perimeter. Leaving these walls
    // behind turns the new outdoor districts into inaccessible rings.
    // Region-union walls replace these, without blocking core-to-flank travel.
    cover:base.cover.filter(c=>{
      const longX=c.size[0] > base.size*.7 && c.size[2]<2.5 && Math.abs(c.pos[2])>base.size*.8;
      const longZ=c.size[2] > base.size*.7 && c.size[0]<2.5 && Math.abs(c.pos[0])>base.size*.8;
      // Elevated walkways must remain: only ground-level perimeter barriers
      // are redundant. Removing a walkway strands its approach staircase.
      return !(c.kind === "cover" && (longX||longZ));
    }).map(c=>({...c,pos:scaled(c.pos,factor),size:scaled(c.size,factor)})),
    spawns:{
      ffa:base.spawns.ffa.map(p=>scaled(p,factor)),
      red:base.spawns.red.map(p=>scaled(p,factor)),
      blue:base.spawns.blue.map(p=>scaled(p,factor)),
    },
    environment,
    lights:base.lights?.map(l=>({...l,pos:scaled(l.pos,factor),distance:l.distance*factor})),
    theme:{...base.theme,fogNear:base.theme.fogNear*factor,fogFar:base.theme.fogFar*factor},
    ...(base.regions?{regions:base.regions.map(r=>({...r,x:r.x*factor,z:r.z*factor,w:r.w*factor,d:r.d*factor}))}:{}),
  };
  if(!plan)return scaledBase;
  const regions=plan.regions.map(r=>({...r}));
  const visuals=visualThemeForMap(base.id,plan.templateMapId);
  const props=mapProps(base.id,plan,visuals);
  const allSpawns=[...scaledBase.spawns.ffa,...scaledBase.spawns.red,...scaledBase.spawns.blue,
    ...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue];
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
    return [...old.slice(0,-outerLen),...plan.spawns[team].map(p=>[...p] as Vec3),...old.slice(-outerLen)];
  };
  return {
    ...scaledBase,name:plan.name,shortName:plan.shortName,description:plan.description,
    size:Math.max(scaledBase.size,Math.ceil(halfExtent)),wallHeight:Math.max(base.wallHeight,11),
    regions,
    cover:[...scaledBase.cover,...flankFeatures.flatMap(featureBoxes),
      ...propColliders(props,allSpawns),
      ...regionBoundary(regions)],
    spawns:{ffa:addSpawns("ffa"),red:addSpawns("red"),blue:addSpawns("blue")},
    props,biome:visuals.biome,accentColor:visuals.palette.accent,
    theme:{...paletteToGameTheme(visuals,scaledBase.theme),fogNear:Math.max(35,scaledBase.theme.fogNear),
      fogFar:Math.max(scaledBase.theme.fogFar,halfExtent*2.5+60)},
  };
}
