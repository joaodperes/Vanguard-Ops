/** Unified, versioned per-map JSON authoring sources, used by the client and server.
 * Add new static imports here when publishing new maps. */
import bunker from "../data/maps/bunker.json";
import shipyard from "../data/maps/shipyard.json";
import compound from "../data/maps/compound.json";
import terminal from "../data/maps/terminal.json";
import skybridge from "../data/maps/skybridge.json";
import orbital_nexus from "../data/maps/orbital_nexus.json";
import arena_neon from "../data/maps/arena_neon.json";
import type { MapBlueprint } from "./map-blueprints";
import type { MapVisualTheme } from "./map-visuals";
import {mapTexture} from "./map-textures";

export interface MapDocument {
  version: 2;
  id: string;
  blueprint: MapBlueprint;
  theme: MapVisualTheme;
}
export const MAP_DOCUMENTS: Record<string, MapDocument> = {
  orbital_nexus: orbital_nexus as unknown as MapDocument,
  bunker: bunker as unknown as MapDocument,
  shipyard: shipyard as unknown as MapDocument,
  compound: compound as unknown as MapDocument,
  terminal: terminal as unknown as MapDocument,
  skybridge: skybridge as unknown as MapDocument,
  arena_neon: arena_neon as unknown as MapDocument,
};

/** Lightweight import validation; gameplay validation runs as a second pass. */
export function validateMapDocument(value: unknown): string[] {
  const issues: string[] = [];
  if (!value || typeof value !== "object") return ["Expected an object"];
  const doc = value as Partial<MapDocument>;
  if (doc.version !== 2) issues.push("Expected map document version 2");
  if (typeof doc.id !== "string" || !/^[a-z][a-z0-9_:-]*$/.test(doc.id))
    issues.push("Invalid map ID (lowercase letters, numbers, _, : or -; starts with a letter)");
  const plan = doc.blueprint;
  if (!plan || typeof plan !== "object") issues.push("Missing blueprint");
  else {
    if (!Array.isArray(plan.regions) || plan.regions.length === 0) issues.push("Missing walkable regions");
    if (!Array.isArray(plan.features)) issues.push("Missing features array");
    for (const team of ["ffa","red","blue"] as const)
      if (!Array.isArray(plan.spawns?.[team])) issues.push("Missing "+team+" spawns");
    if(Array.isArray(plan.regions))for(const r of plan.regions)
      if(!r||![r.x,r.z,r.w,r.d].every(Number.isFinite)||r.w<8||r.d<8)issues.push("Invalid region geometry");
    if(Array.isArray(plan.features))for(const f of plan.features)
      if(!f||typeof f.id!=="string"||!["cover","platform","stairs","accent"].includes(f.kind)||
        ![f.x,f.z,f.y??0,f.w,f.d,f.h].every(Number.isFinite)||f.w<=0||f.d<=0||f.h<=0)issues.push("Invalid feature geometry");
  }
  const theme = doc.theme;
  if (!theme || typeof theme !== "object") issues.push("Missing theme");
  else {
    for (const color of ["floor","wall","cover","accent","platform","stair","sky","fog","grid"] as const)
      if (!/^#[0-9a-f]{6}$/i.test(theme.palette?.[color] ?? "")) issues.push("Invalid palette color "+color);
    if (!Number.isFinite(theme.ambient) || theme.ambient < 0) issues.push("Invalid ambient intensity");
    if (!Number.isFinite(theme.vegetation) || theme.vegetation < 0 || theme.vegetation > 1)
      issues.push("Vegetation must be within 0–1");
    if (!Array.isArray(theme.props)) issues.push("Missing props array");
    else for(const p of theme.props){
      if(!p||typeof p.kind!=="string"||![p.x,p.z,p.y??0,p.w??5,p.h??5,p.d??5].every(Number.isFinite)||
        (p.w??5)<=0||(p.h??5)<=0||(p.d??5)<=0||p.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(p.color))issues.push("Invalid prop geometry or color");
    }
    for(const recipe of Object.values(theme.surfaces??{}))if(recipe?.textureId!==undefined&&!mapTexture(recipe.textureId))issues.push("Unknown bundled texture ID");
  }
  return issues;
}
