/** Unified, versioned per-map JSON authoring sources, used by the client and server.
 * Add new static imports here when publishing new maps. */
import bunker from "../data/maps/bunker.json";
import shipyard from "../data/maps/shipyard.json";
import compound from "../data/maps/compound.json";
import terminal from "../data/maps/terminal.json";
import skybridge from "../data/maps/skybridge.json";
import arena_neon from "../data/maps/arena_neon.json";
import type { MapBlueprint } from "./map-blueprints";
import type { MapVisualTheme } from "./map-visuals";

export interface MapDocument {
  version: 2;
  id: string;
  blueprint: MapBlueprint;
  theme: MapVisualTheme;
}
export const MAP_DOCUMENTS: Record<string, MapDocument> = {
  bunker: bunker as MapDocument,
  shipyard: shipyard as MapDocument,
  compound: compound as MapDocument,
  terminal: terminal as MapDocument,
  skybridge: skybridge as MapDocument,
  arena_neon: arena_neon as MapDocument,
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
  }
  return issues;
}
