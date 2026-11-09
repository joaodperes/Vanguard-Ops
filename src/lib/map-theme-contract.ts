/**
 * Single source of truth for authored map-theme/prop validation.
 *
 * Map Studio imports call validateMapDocument(); published maps call the same
 * schema via content validation. The checked-in JSON Schema is generated from
 * MAP_THEME_SCHEMA and verified in CI rather than independently maintained.
 */
import { z } from "zod";
import { MAP_TEXTURES } from "./map-textures";

export const MAP_PROP_KINDS = [
  "tree","bush","rock","ruin","temple","shop","lamp","container","crane",
  "terminal","sign","antenna","building","boat","dock","garden","bench",
  "bandstand","sarcophagus","furnace","conveyor","hydraulic_press","generator",
  "storage_rack","vent_stack","industrial_pipe","steel_coil","cargo_pallet",
] as const;

export const CITY_BUILDING_USES = [
  "house","cafe","supermarket","bakery","apartments","office","hotel",
  "library","diner","clinic","workshop","gallery","florist","gym",
] as const;
export const CITY_BUILDING_SHAPES = ["rect","narrow","round"] as const;
export const CITY_BUILDING_FACADES = ["brick","stucco","concrete","glass","timber","industrial"] as const;
export const MAP_SURFACE_PATTERNS = [
  "concrete","metal","grate","planks","rust","moss","brick","stone",
  "pavers","snow","asphalt","grass",
] as const;
export const MAP_SURFACE_SLOTS = ["floor","wall","cover","stair","platform"] as const;

const number = z.number().finite();
const positive = number.positive();
const unit = number.min(0).max(1);
const label = z.string().min(1);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// IDs are already registered by the texture pack; do not introduce a separate
// list of valid IDs or allow arbitrary URLs through map imports.
const textureId = z.enum(MAP_TEXTURES.map(t=>t.id) as [string,...string[]]);

export const MAP_PROP_SCHEMA = z.strictObject({
  kind:z.enum(MAP_PROP_KINDS),
  x:number,z:number,y:number.optional(),
  w:positive.optional(),d:positive.optional(),h:positive.optional(),
  text:label.optional(),color:color.optional(),
  use:z.enum(CITY_BUILDING_USES).optional(),
  shape:z.enum(CITY_BUILDING_SHAPES).optional(),
  stairSide:z.enum(["east","west"]).optional(),
  roofAccess:z.boolean().optional(),
  facade:z.enum(CITY_BUILDING_FACADES).optional(),
  lotId:z.string().regex(/^city:-?[0-9]+:-?[0-9]+$/).optional(),
  turns:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]).optional(),
});
const surface = z.strictObject({
  pattern:z.enum(MAP_SURFACE_PATTERNS),
  tileSize:positive.max(100),
  roughness:unit,
  textureId:textureId.optional(),
});
const palette = z.strictObject({
  floor:color,wall:color,cover:color,accent:color,platform:color,
  stair:color,sky:color,fog:color,grid:color,
});
export const MAP_THEME_SCHEMA = z.strictObject({
  biome:label,label,
  inheritPropsFrom:label.optional(),
  palette,
  ambient:positive,
  vegetation:unit,
  props:z.array(MAP_PROP_SCHEMA),
  surfaces:z.strictObject({
    floor:surface,wall:surface,cover:surface,stair:surface,platform:surface,
  }).optional(),
});

export type PropKind = z.infer<typeof MAP_PROP_SCHEMA>["kind"];
export type MapProp = z.infer<typeof MAP_PROP_SCHEMA>;
export type MapVisualTheme = z.infer<typeof MAP_THEME_SCHEMA>;
export type SurfacePattern = (typeof MAP_SURFACE_PATTERNS)[number];
export type SurfaceSlot = (typeof MAP_SURFACE_SLOTS)[number];
export type SurfaceRecipe = NonNullable<MapVisualTheme["surfaces"]>["floor"];

export function validateMapTheme(value:unknown):string[] {
  const checked = MAP_THEME_SCHEMA.safeParse(value);
  return checked.success?[]:checked.error.issues.map(problem=>
    // Preserve the established import error used by Map Studio and clients,
    // while keeping the texture allowlist owned by this one Zod contract.
    problem.path[0]==="surfaces" && problem.path.at(-1)==="textureId"
      ? "Unknown bundled texture ID"
      : "theme ["+problem.path.join(".")+"]: "+problem.message);
}
