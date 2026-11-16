/** Unified, versioned per-map JSON authoring sources, used by the client and server.
 * Add new static imports here when publishing new maps. */
import floodgate from "../data/maps/floodgate.json";
import whiteout_depot from "../data/maps/whiteout_depot.json";
import bunker from "../data/maps/bunker.json";
import shipyard from "../data/maps/shipyard.json";
import compound from "../data/maps/compound.json";
import terminal from "../data/maps/terminal.json";
import skybridge from "../data/maps/skybridge.json";
import orbital_nexus from "../data/maps/orbital_nexus.json";
import arena_neon from "../data/maps/arena_neon.json";
import emberhold from "../data/maps/emberhold.json";
import type { MapBlueprint } from "./map-blueprints";
import type { MapVisualTheme } from "./map-visuals";
import {validateObjectives} from "./map-objectives";
import {validateMapTheme} from "./map-theme-contract";
import {BALLISTIC_MATERIALS} from "./cover-penetration";

export interface MapDocument {
  version: 2;
  id: string;
  blueprint: MapBlueprint;
  theme: MapVisualTheme;
}
export const MAP_DOCUMENTS: Record<string, MapDocument> = {
  floodgate: floodgate as unknown as MapDocument,
  whiteout_depot: whiteout_depot as unknown as MapDocument,
  orbital_nexus: orbital_nexus as unknown as MapDocument,
  bunker: bunker as unknown as MapDocument,
  shipyard: shipyard as unknown as MapDocument,
  compound: compound as unknown as MapDocument,
  terminal: terminal as unknown as MapDocument,
  skybridge: skybridge as unknown as MapDocument,
  arena_neon: arena_neon as unknown as MapDocument,
  emberhold: emberhold as unknown as MapDocument,
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
    issues.push(...validateObjectives(plan));
    if (!Array.isArray(plan.features)) issues.push("Missing features array");
    for (const team of ["ffa","red","blue"] as const)
      if (!Array.isArray(plan.spawns?.[team])) issues.push("Missing "+team+" spawns");
    if(Array.isArray(plan.regions))for(const r of plan.regions)
      if(!r||![r.x,r.z,r.w,r.d].every(Number.isFinite)||r.w<8||r.d<8)issues.push("Invalid region geometry");
    if(Array.isArray(plan.features))for(const f of plan.features)
      if(!f||typeof f.id!=="string"||!["cover","platform","stairs","accent"].includes(f.kind)||
        ![f.x,f.z,f.y??0,f.w,f.d,f.h].every(Number.isFinite)||f.w<=0||f.d<=0||f.h<=0)issues.push("Invalid feature geometry");
    if(Array.isArray(plan.features))for(const f of plan.features){
      if(f?.kind==="cover"&&!f.material)
        issues.push("Missing ballistic material on cover "+(f?.id??"?"));
      else if(f?.material!==undefined && (f.kind!=="cover" ||
        !BALLISTIC_MATERIALS.includes(f.material as typeof BALLISTIC_MATERIALS[number])))
        issues.push("Invalid ballistic material on feature "+(f?.id??"?"));
    }
  }
  if(!doc.theme || typeof doc.theme!=="object") issues.push("Missing theme");
  else issues.push(...validateMapTheme(doc.theme));
  return issues;
}
