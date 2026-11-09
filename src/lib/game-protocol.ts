// ============================================================================
// VANGUARD OPS — Shared game protocol & map catalog
// Imported by BOTH the Next.js client (`@/lib/game-protocol`) and the
// socket.io game-server mini-service (relative path). Keep in sync.
// ============================================================================
import {supportsMapMode,type ObjectiveMap} from "./map-objectives";
import type { ClusterVolley } from "./cluster-grenades";
import { TACTICAL_COVER, OUTER_SPAWNS } from "./map-tactics";
import type { SurvivalTier } from "./survival";
import type { SurvivalUpgradeId, SurvivalUpgradeOffer, SurvivalUpgradeRanks } from "./survival-upgrades";
import { applyMapFootprint } from "./map-footprint";
import { MAP_BLUEPRINTS, type MapBlueprint } from "./map-blueprints";
import type { MapVisualTheme } from "./map-visuals";
import { FOREST_SPAWNS, FOREST_WARFARE_COVER, FOREST_REGIONS, FOREST_HALF_EXTENT } from "./forest-warfare";
import type { CtfFlags } from "./ctf-rules";

export type Vec3 = [number, number, number];
export type GameMode = "ffa" | "tdm" | "survival" | "gungame" | "killconfirmed" | "ctf";
export type MapId = "compound" | "skybridge" | "bunker" | "shipyard" | "terminal" | "arena_neon" | "forest_warfare" | "orbital_nexus" | "floodgate" | "whiteout_depot" | "emberhold";

// ---- Room lobby system -------------------------------------------------------
// Per-team player count options for the "Create a Room" flow.
export const TEAM_SIZES = [3, 4, 5, 7, 9, 12, 16] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

/** The Afterlight editions share their city layout and room-size options. */
export function isAfterlightCityMap(mapId: MapId | string): boolean {
  return mapId === "terminal" || mapId === "arena_neon";
}
export function teamSizesForMap(mapId: MapId | string, mode: GameMode = "tdm"): readonly TeamSize[] {
  if (mapId === "bunker") return mode === "ffa" || mode === "gungame" ? [3,4] : [3,5];
  if (isAfterlightCityMap(mapId)) return [5,7,9,16];
  // Castle is dense at 32 operatives: cap every supported mode at 12 per side / 24 total.
  if (mapId === "emberhold") return [5,7,9,12];
  if (mapId === "floodgate") return [5,7,9,16];
  if (mapId === "compound" || mapId === "skybridge") return [3,5,7,9];
  return [3,5,7];
}
export function recommendedTeamSize(mapId: MapId | string, mode: GameMode = "tdm"): TeamSize {
  if(mapId==="bunker")return 3;
  // 9 per side = 18 operatives in both day and night Afterlight editions.
  if(isAfterlightCityMap(mapId))return 9;
  if(mapId==="floodgate"||mapId==="compound"||mapId==="skybridge"||mapId==="emberhold")return 7;
  return 5;
}
export function teamSizeAllowed(mapId: MapId | string, teamSize: number, mode: GameMode = "tdm"): teamSize is TeamSize {
  return teamSizesForMap(mapId,mode).some(size => size === teamSize);
}

// Total combatant capacity for a room given mode + team size.
// FFA: teamSize*2 total slots (no teams, just a player cap).
// TDM: teamSize per side → teamSize*2 total.
// Survival: configurable solo or duo lobby; wave bots are independent of capacity.
export function roomCapacity(mode: GameMode, teamSize: TeamSize, survivalPlayers: 1 | 2 = 1): number {
  if (mode === "survival") return survivalPlayers;
  return teamSize * 2;
}

// Public-facing summary of a room — broadcast in the room browser list.
export interface RoomSummary {
  id: string;
  name: string;
  hostName: string;
  mode: GameMode;
  mapId: MapId;
  mapName: string;
  teamSize: TeamSize;
  fillWithBots: boolean;
  hasPassword: boolean;
  humans: number;       // current human player count
  capacity: number;     // total slots
  hasStarted: boolean;  // match in progress (always true once created)
  survivalTier?: SurvivalTier;
  state?: "lobby" | "playing";  // current room phase (lobby = waiting for host to start)
  createdAt: number;    // epoch ms
}

// Configuration payload sent by the host when creating a room.
// Bot difficulty tiers. "mixed" rolls a random tier per bot at spawn (room-level
// setting only — individual bots resolve to one of the four fixed tiers).
export type BotDifficulty = "easy" | "normal" | "hard" | "veteran" | "mixed";

// Difficulty of a specific kill — used for per-kill XP/credit scaling. Enemy
// players always count as "veteran" for reward purposes.
export type KillDifficulty = "easy" | "normal" | "hard" | "veteran" | "enemy_player";

export interface CreateRoomConfig {
  mode: GameMode;
  mapId: MapId;
  teamSize: TeamSize;
  fillWithBots: boolean;
  password: string | null;  // null/empty = no password
  roomName?: string;        // optional display name; defaults to "<host>'s Room"
  botDifficulty: BotDifficulty;
  // Custom match limits for FFA/TDM/Kill Confirmed. If omitted, defaults are used.
  // Survival and Gun Game ignore these (survival is endless; gungame uses the
  // progression length as the score limit).
  scoreLimit?: number;      // kills to win (FFA/TDM) or tags confirmed (Kill Confirmed)
  timeLimit?: number;       // seconds (0 = no time limit)
  tagLifetimeMs?: number;   // Kill Confirmed dogtag lifetime, configured by host
  ctfFlagResetMs?: number;  // CTF dropped flag return timer; -1 means never
  denialScoreEnabled?: boolean; // +1 team/player point for recovering friendly dogtags
  gungamePreset?: "all" | "cqc" | "long_range";
  gungameMultiplier?: number; // whole list 1–5 times; default 1
  survivalPlayers?: 1 | 2; // max human co-op partners, defaults to solo
  survivalTier?: SurvivalTier; // default / hard / elite / nightmare
}

// ---- Combat constants -------------------------------------------------------
// MAX_HEALTH lowered from 150 → 100 to reduce overall TTK now that the bots
// are properly humanized (they miss + react slower, so the player survives
// longer engagements even at lower HP). With 100 HP the TTK at chest-shot
// range is roughly: AR ~0.45s, SMG ~0.5s, DMR ~0.4s (2 shots), Sniper 1-shot
// body or head. This is the snappier arcade feel the user asked for.
export const MAX_HEALTH = 100;
export const RESPAWN_DELAY_MS = 3500; // 3.5s respawn timer

// ---- Cover / map geometry ---------------------------------------------------
export interface CoverBox {
  pos: Vec3;     // center
  size: Vec3;    // half-extents
  kind?: "solid" | "cover" | "accent" | "platform" | "stair";
  /** Author-assigned ballistic material; missing = fully protective. */
  material?: import("./cover-penetration").BallisticMaterial;
  /** Stable Map Studio feature ID used by cover hit/damage replication. */
  ballisticId?: string;
  environmentId?: string; // dynamically updated solid; not part of the static map geometry
}

// Staircase builder: steps rise along ±z (or ±x) axis.
// `axis` "z" means stairs go along z direction; `sign` +1/-1 is direction.
// Auto-ensures each step is <= 0.5 high (walkable without jumping) by increasing
// the step count if the caller's `steps` parameter would produce taller steps.
// The total footprint (depth) is unchanged — only the step count + per-step depth adjust.
export function stairs(
  x: number, z: number, topY: number, steps: number, width: number, depth: number, axis: "z" | "x", sign: 1 | -1
): CoverBox[] {
  const out: CoverBox[] = [];
  // Auto-increase step count so no individual step is taller than 0.5 units.
  // This prevents the "stairs require jumping" bug across all maps.
  const minStepsForHeight = Math.ceil(Math.abs(topY) / 0.5);
  const actualSteps = Math.max(steps, minStepsForHeight);
  const stepHeight = topY / actualSteps;
  const stepDepth = depth / actualSteps;
  for (let i = 0; i < actualSteps; i++) {
    const stepTop = stepHeight * (i + 1);
    const cy = stepTop / 2;
    // step i (0=bottom) is farthest from origin in the direction of `sign*axis`
    // We start at (x,z) and steps ascend moving in direction -sign*axis (so bottom step is at +sign*axis far end)
    if (axis === "z") {
      const sz = z + sign * (stepDepth * (actualSteps - 1 - i) + stepDepth / 2);
      out.push({ pos: [x, cy, sz], size: [width / 2, cy + 0.001, stepDepth / 2 + 0.001], kind: "stair" });
    } else {
      const sx = x + sign * (stepDepth * (actualSteps - 1 - i) + stepDepth / 2);
      out.push({ pos: [sx, cy, z], size: [stepDepth / 2 + 0.001, cy + 0.001, width / 2], kind: "stair" });
    }
  }
  return out;
}

// ---- Map definitions --------------------------------------------------------
// The base templates below contain legacy geometry, not the canonical player-
// facing identities. Map names, codes and descriptions are authored in
// src/data/maps/*.json and read through MAP_BLUEPRINTS (including fallbacks).

export interface MapTheme {
  floor: number;
  floorPattern: number;
  wall: number;
  cover: number;
  coverAccent: number;
  stair: number;
  platform: number;
  sky: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ambient: number;       // hemisphere intensity multiplier
  gridColor: number;
}

export interface MapAccentLight {
  pos: Vec3;
  color: number;      // hex color (e.g. 0xff8c1a)
  intensity: number;  // point-light intensity, typically 1.5–3
  distance: number;   // attenuation radius, typically 12–20
}

/** Map-authored interactive objects. Coordinates follow CoverBox half-extents. */
export type EnvironmentObject =
  | { id: string; type: "fire"; pos: Vec3; size: Vec3; dps: number }
  | { id: string; type: "lava"; pos: Vec3; size: Vec3 }
  | { id: string; type: "spikes"; pos: Vec3; size: Vec3; damage: number; period: number; activeFor: number; offset?: number; warningFor?: number; visual?: "spikes" | "steam" }
  | { id: string; type: "jump_pad"; pos: Vec3; size: Vec3; launch: Vec3 }
  | { id: string; type: "moving_platform"; pos: Vec3; size: Vec3; to: Vec3; period: number }
  | { id: string; type: "destructible_wall"; pos: Vec3; size: Vec3; hp: number };

export type MapModeSpawns=Partial<Record<GameMode,{red:Vec3[];blue:Vec3[]}>>;
export interface MapDef extends ObjectiveMap {
  modeSpawns?:MapModeSpawns;
  id: MapId;
  name: string;
  shortName: string;
  description: string;
  size: number;          // broadphase half-extents; regions determine the playable footprint
  regions?: import("./map-blueprints").MapRegion[]; // union of rectangles, circles or triangles (stepped boundary collision)
  wallHeight: number;
  cover: CoverBox[];
  /** Stable prefix length of engine-authored cover after legacy filtering. Map Studio
   * can address and edit these objects without modifying generated boundaries. */
  editorLegacyCoverCount?: number;
  /** Pre-override collision boxes, indexed identically to editorLegacyStairFlights. */
  editorLegacyCoverSource?: CoverBox[];
  /** Pre-override environment sources indexed for deletion, copy and restore. */
  editorLegacyEnvironmentSource?: EnvironmentObject[];
  editorLegacyStairFlights?: import("./legacy-stair-flights").LegacyStairFlight[];
  editorLegacyEnvironmentCount?: number;
  environment?: EnvironmentObject[];
  spawns: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] };
  theme: MapTheme;
  /** Authored map palette, props and rendered landmarks (see JSON map theme). */
  props?: import("./map-visuals").MapProp[];
  biome?: string;
  surfaces?: import("./map-visuals").MapSurfaceRecipes;
  accentColor: string;   // for UI badge
  lights?: MapAccentLight[]; // optional per-map accent point lights
}

// ===== MAP 1: COMPOUND — symmetric, central tower + corners, mid-cover =====
const COMPOUND_COVER: CoverBox[] = [
  {pos:[-7,1.5,34],size:[4,1.5,.5],kind:"cover"},
  {pos:[7,1.5,34],size:[4,1.5,.5],kind:"cover"},
  // Central raised platform (top at y=2.5) — dominates map center
  { pos: [0, 1.25, 0], size: [4, 1.25, 4], kind: "platform" },
  // Stairs up to platform (south side, ascending north)
  ...stairs(0, 4, 2.5, 5, 3, 5, "z", 1),
  // Stairs up to platform (north side, ascending south)
  ...stairs(0, -4, 2.5, 5, 3, 5, "z", -1),
  // 4 corner bunkers (L-shaped, walkable tops at y=3)
  // NW corner
  { pos: [-14, 1.5, -14], size: [4, 1.5, 1], kind: "cover" },
  { pos: [-14, 1.5, -14], size: [1, 1.5, 4], kind: "cover" },
  // NE corner
  { pos: [14, 1.5, -14], size: [4, 1.5, 1], kind: "cover" },
  { pos: [14, 1.5, -14], size: [1, 1.5, 4], kind: "cover" },
  // SW corner
  { pos: [-14, 1.5, 14], size: [4, 1.5, 1], kind: "cover" },
  { pos: [-14, 1.5, 14], size: [1, 1.5, 4], kind: "cover" },
  // SE corner
  { pos: [14, 1.5, 14], size: [4, 1.5, 1], kind: "cover" },
  { pos: [14, 1.5, 14], size: [1, 1.5, 4], kind: "cover" },
  // Stairs to NW bunker top
  ...stairs(-18, -14, 3, 6, 3, 6, "x", -1),
  // Stairs to NE bunker top
  ...stairs(18, -14, 3, 6, 3, 6, "x", 1),
  // Stairs to SW bunker top
  ...stairs(-18, 14, 3, 6, 3, 6, "x", -1),
  // Stairs to SE bunker top
  ...stairs(18, 14, 3, 6, 3, 6, "x", 1),
  // Mid-lane crates (low cover, jumpable)
  { pos: [-9, 0.6, 0], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [9, 0.6, 0], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [0, 0.6, -9], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [0, 0.6, 9], size: [1.2, 0.6, 1.2], kind: "cover" },
  // Mid cover walls (chest-high)
  { pos: [-12, 0.75, 0], size: [0.5, 0.75, 4], kind: "cover" },
  { pos: [12, 0.75, 0], size: [0.5, 0.75, 4], kind: "cover" },
  { pos: [0, 0.75, -12], size: [4, 0.75, 0.5], kind: "cover" },
  { pos: [0, 0.75, 12], size: [4, 0.75, 0.5], kind: "cover" },
  // Side ramps to elevated catwalks (small)
  { pos: [-22, 0.5, 0], size: [1.5, 0.5, 5], kind: "platform" },
  { pos: [22, 0.5, 0], size: [1.5, 0.5, 5], kind: "platform" },
  { pos: [0, 0.5, -22], size: [5, 0.5, 1.5], kind: "platform" },
  { pos: [0, 0.5, 22], size: [5, 0.5, 1.5], kind: "platform" },
  // ---- M1 (Maps Expansion): outer ring + multi-level cover (size 32 -> 64) ----
  // Tall "building" boxes at NE/SW outer corners (top at y=5, 4x4 footprint)
  { pos: [42, 2.5, -42], size: [2, 2.5, 2], kind: "cover" },
  { pos: [-42, 2.5, 42], size: [2, 2.5, 2], kind: "cover" },
  // Stairs up to each new building's roof (top at y=5)
  ...stairs(42, -40, 5, 10, 3, 5, "z", 1),
  ...stairs(-42, 40, 5, 10, 3, 5, "z", -1),
  // Elevated platform (top at y=3) at SE outer corner + stair access
  { pos: [42, 3, 42], size: [4, 0.3, 4], kind: "platform" },
  ...stairs(42, 38, 3, 6, 3, 5, "z", -1),
  // ---- Verticality: elevated cross-map walkway at y=4 connecting the buildings ----
  // Players can traverse the map from up high, accessing all 4 corners.
  { pos: [0, 4, -42], size: [42, 0.3, 1.2], kind: "platform" },
  { pos: [0, 4, 42], size: [42, 0.3, 1.2], kind: "platform" },
  ...stairs(0, -40.8, 4, 8, 2, 5, "z", 1),
  ...stairs(0, 40.8, 4, 8, 2, 5, "z", -1),
  // Central elevated catwalk (y=3) over the central platform — a mid-level perch
  { pos: [0, 3, 0], size: [10, 0.25, 1.2], kind: "platform" },
  ...stairs(7, 1.2, 3, 6, 1.5, 4, "z", 1),
  ...stairs(-7, -1.2, 3, 6, 1.5, 4, "z", -1),
  // Accent lights on building tops (emissive stripes for art direction)
  { pos: [42, 5.05, -42], size: [2, 0.03, 2], kind: "accent" },
  { pos: [-42, 5.05, 42], size: [2, 0.03, 2], kind: "accent" },
  // Perimeter walls (tall thin boxes around the expanded arena edge)
  { pos: [0, 3, -62], size: [62, 3, 0.5], kind: "cover" },
  { pos: [0, 3, 62], size: [62, 3, 0.5], kind: "cover" },
  { pos: [62, 3, 0], size: [0.5, 3, 62], kind: "cover" },
  { pos: [-62, 3, 0], size: [0.5, 3, 62], kind: "cover" },
  // Scattered low crates filling the expanded outer ring
  { pos: [30, 0.6, 0], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-30, 0.6, 0], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [0, 0.6, 30], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [0, 0.6, -30], size: [1.2, 0.6, 1.2], kind: "cover" },
  // ---- Round 16-b: density pass — break open mid + outer scatter + sight blockers ----
  // 4 diagonal chest-high walls between corner bunkers (break long mid sightlines)
  { pos: [24, 1.0, 22], size: [3, 1.0, 0.5], kind: "cover" },
  { pos: [-24, 1.0, 22], size: [3, 1.0, 0.5], kind: "cover" },
  { pos: [24, 1.0, -22], size: [3, 1.0, 0.5], kind: "cover" },
  { pos: [-24, 1.0, -22], size: [3, 1.0, 0.5], kind: "cover" },
  // 4 tall sight-blocking pillars at outer mid-corners
  { pos: [32, 3.0, 32], size: [0.6, 3.0, 0.6], kind: "cover" },
  { pos: [-32, 3.0, 32], size: [0.6, 3.0, 0.6], kind: "cover" },
  { pos: [32, 3.0, -32], size: [0.6, 3.0, 0.6], kind: "cover" },
  { pos: [-32, 3.0, -32], size: [0.6, 3.0, 0.6], kind: "cover" },
  // 8 low crates along the mid-ring (rotation scatter cover)
  { pos: [25, 0.6, 12], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-25, 0.6, 12], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [25, 0.6, -12], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-25, 0.6, -12], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [12, 0.6, 25], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-12, 0.6, 25], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [12, 0.6, -25], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-12, 0.6, -25], size: [1.2, 0.6, 1.2], kind: "cover" },
  // 6 low crates clustered near the central platform (close-quarters scatter)
  { pos: [7, 0.5, 7], size: [1.0, 0.5, 1.0], kind: "cover" },
  { pos: [-7, 0.5, 7], size: [1.0, 0.5, 1.0], kind: "cover" },
  { pos: [7, 0.5, -7], size: [1.0, 0.5, 1.0], kind: "cover" },
  { pos: [-7, 0.5, -7], size: [1.0, 0.5, 1.0], kind: "cover" },
  { pos: [7, 0.5, 15], size: [1.0, 0.5, 1.0], kind: "cover" },
  { pos: [-7, 0.5, -15], size: [1.0, 0.5, 1.0], kind: "cover" },
  // 4 chest-high walls in outer mid-lanes (peek cover between mid and edge)
  { pos: [38, 1.0, 8], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [-38, 1.0, 8], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [38, 1.0, -8], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [-38, 1.0, -8], size: [0.5, 1.0, 3], kind: "cover" },
  // 4 stacked chest-high crates in outer corners (cubby cover)
  { pos: [18, 1.2, 28], size: [1.2, 1.2, 1.2], kind: "cover" },
  { pos: [-18, 1.2, 28], size: [1.2, 1.2, 1.2], kind: "cover" },
  { pos: [18, 1.2, -28], size: [1.2, 1.2, 1.2], kind: "cover" },
  { pos: [-18, 1.2, -28], size: [1.2, 1.2, 1.2], kind: "cover" },
];

const COMPOUND_SPAWNS: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] } = {
  ffa: [
    [-26, 0, -26], [26, 0, -26], [-26, 0, 26], [26, 0, 26],
    [0, 0, -28], [0, 0, 28], [-28, 0, 0], [28, 0, 0],
    [-15, 0, -8], [15, 0, 8], [-15, 0, 8], [15, 0, -8],
    [-20, 0, 0], [20, 0, 0], [0, 0, -20], [0, 0, 20],
    [-8, 0, -22], [8, 0, 22], [-22, 0, 8], [22, 0, -8],
  ],
  red: [
    [-28, 0, -20], [-28, 0, 0], [-28, 0, 20], [-22, 0, -28], [-22, 0, 28],
    [-18, 0, -10], [-18, 0, 10], [-24, 0, -14], [-24, 0, 14], [-20, 0, 0],
  ],
  blue: [
    [28, 0, -20], [28, 0, 0], [28, 0, 20], [22, 0, -28], [22, 0, 28],
    [18, 0, -10], [18, 0, 10], [24, 0, -14], [24, 0, 14], [20, 0, 0],
  ],
};

// ===== MAP 2: SKYBRIDGE — vertical-heavy, elevated catwalks + towers =====
const SKYBRIDGE_COVER: CoverBox[] = [
  // Central tower (tall, accessible top at y=6)
  { pos: [0, 3, 0], size: [3, 3, 3], kind: "platform" },
  // Stairs to central tower top (south side)
  ...stairs(0, 3, 6, 12, 3, 8, "z", 1),
  // Stairs to central tower top (north side)
  ...stairs(0, -3, 6, 12, 3, 8, "z", -1),
  // East-west elevated catwalk at y=4
  { pos: [0, 4, -10], size: [14, 0.4, 1.5], kind: "platform" },
  { pos: [0, 4, 10], size: [14, 0.4, 1.5], kind: "platform" },
  // North-south elevated catwalk
  { pos: [-10, 4, 0], size: [1.5, 0.4, 14], kind: "platform" },
  { pos: [10, 4, 0], size: [1.5, 0.4, 14], kind: "platform" },
  // 4 corner towers (top at y=8) — sniper perches
  { pos: [-22, 4, -22], size: [3, 4, 3], kind: "platform" },
  { pos: [22, 4, -22], size: [3, 4, 3], kind: "platform" },
  { pos: [-22, 4, 22], size: [3, 4, 3], kind: "platform" },
  { pos: [22, 4, 22], size: [3, 4, 3], kind: "platform" },
  // Ramps to corner towers (stairs)
  ...stairs(-22, -19, 8, 16, 3, 6, "z", 1),
  ...stairs(22, -19, 8, 16, 3, 6, "z", 1),
  ...stairs(-22, 19, 8, 16, 3, 6, "z", -1),
  ...stairs(22, 19, 8, 16, 3, 6, "z", -1),
  // Stairs up to east-west catwalks
  ...stairs(-6, -11.5, 4, 8, 2, 6, "z", -1),
  ...stairs(6, -11.5, 4, 8, 2, 6, "z", -1),
  ...stairs(-6, 11.5, 4, 8, 2, 6, "z", 1),
  ...stairs(6, 11.5, 4, 8, 2, 6, "z", 1),
  // Stairs up to north-south catwalks
  ...stairs(-11.5, -6, 4, 8, 2, 6, "x", -1),
  ...stairs(-11.5, 6, 4, 8, 2, 6, "x", -1),
  ...stairs(11.5, -6, 4, 8, 2, 6, "x", 1),
  ...stairs(11.5, 6, 4, 8, 2, 6, "x", 1),
  // Lower-level cover (crates and walls)
  { pos: [-6, 0.6, -6], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [6, 0.6, 6], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-6, 0.6, 6], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [6, 0.6, -6], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-12, 0.75, -4], size: [0.5, 0.75, 3], kind: "cover" },
  { pos: [12, 0.75, 4], size: [0.5, 0.75, 3], kind: "cover" },
  { pos: [-4, 0.75, -12], size: [3, 0.75, 0.5], kind: "cover" },
  { pos: [4, 0.75, 12], size: [3, 0.75, 0.5], kind: "cover" },
  // ---- M1 (Maps Expansion): outer ring + multi-level cover (size 36 -> 64) ----
  // Two additional tall sniper towers (top at y=10) at outer E/W midpoints
  { pos: [40, 5, 0], size: [2, 5, 2], kind: "platform" },
  { pos: [-40, 5, 0], size: [2, 5, 2], kind: "platform" },
  // Stairs up to the new outer towers (to y=10)
  ...stairs(40, 2, 10, 20, 3, 6, "z", 1),
  ...stairs(-40, -2, 10, 20, 3, 6, "z", -1),
  // Outer elevated catwalks at y=6 (east-west, longer than the originals)
  { pos: [0, 6, -40], size: [40, 0.4, 1.5], kind: "platform" },
  { pos: [0, 6, 40], size: [40, 0.4, 1.5], kind: "platform" },
  // Stairs up to the outer catwalks
  ...stairs(0, -38.5, 6, 12, 4, 6, "z", 1),
  ...stairs(0, 38.5, 6, 12, 4, 6, "z", -1),
  // Perimeter walls (tall thin boxes)
  { pos: [0, 4, -62], size: [62, 4, 0.5], kind: "cover" },
  { pos: [0, 4, 62], size: [62, 4, 0.5], kind: "cover" },
  { pos: [62, 4, 0], size: [0.5, 4, 62], kind: "cover" },
  { pos: [-62, 4, 0], size: [0.5, 4, 62], kind: "cover" },
  // Scattered low crates in the expanded arena
  { pos: [30, 0.6, -30], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-30, 0.6, 30], size: [1.2, 0.6, 1.2], kind: "cover" },
  // ---- Round 16-b: density pass — under-catwalk cover + sight blockers + perch cover ----
  // 8 low crates under/around the inner catwalks (landing-zone scatter cover)
  { pos: [0, 0.6, 10], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [0, 0.6, -10], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [8, 0.6, 0], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-8, 0.6, 0], size: [1.2, 0.6, 1.2], kind: "cover" },
  // 4 low crates in the outer ring (east-west scatter)
  { pos: [35, 0.6, 10], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-35, 0.6, -10], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [35, 0.6, -10], size: [1.2, 0.6, 1.2], kind: "cover" },
  { pos: [-35, 0.6, 10], size: [1.2, 0.6, 1.2], kind: "cover" },
  // 4 chest-high walls on the inner mid axes (peek cover between center and corners)
  { pos: [15, 1.0, 0], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [-15, 1.0, 0], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [0, 1.0, 15], size: [3, 1.0, 0.5], kind: "cover" },
  { pos: [0, 1.0, -15], size: [3, 1.0, 0.5], kind: "cover" },
  // 6 tall sight-blocking pillars between towers at ground level
  { pos: [18, 3.0, 0], size: [0.5, 3.0, 0.5], kind: "cover" },
  { pos: [-18, 3.0, 0], size: [0.5, 3.0, 0.5], kind: "cover" },
  { pos: [0, 3.0, 18], size: [0.5, 3.0, 0.5], kind: "cover" },
  { pos: [0, 3.0, -18], size: [0.5, 3.0, 0.5], kind: "cover" },
  { pos: [28, 3.0, 18], size: [0.5, 3.0, 0.5], kind: "cover" },
  { pos: [-28, 3.0, -18], size: [0.5, 3.0, 0.5], kind: "cover" },
  // 4 low crates on the inner catwalk mid-spans (perch cover for catwalk fighters)
  { pos: [0, 4.75, 10], size: [0.8, 0.3, 0.8], kind: "cover" },
  { pos: [0, 4.75, -10], size: [0.8, 0.3, 0.8], kind: "cover" },
  { pos: [10, 4.75, 0], size: [0.8, 0.3, 0.8], kind: "cover" },
  { pos: [-10, 4.75, 0], size: [0.8, 0.3, 0.8], kind: "cover" },
];

const SKYBRIDGE_SPAWNS: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] } = {
  ffa: [
    [-30, 0, -30], [30, 0, -27], [-30, 0, 27], [30, 0, 30],
    [0, 0, -32], [0, 0, 32], [-32, 0, 0], [32, 0, 0],
    [-15, 0, -15], [15, 0, 15], [-15, 0, 15], [15, 0, -15],
    [-25, 0, 0], [25, 0, 0], [0, 0, -25], [0, 0, 25],
    // Elevated spawns on tower tops
    [-22, 8.05, -22], [22, 8.05, -22], [-22, 8.05, 22], [22, 8.05, 22],
  ],
  red: [
    [-32, 0, -20], [-32, 0, 0], [-32, 0, 20], [-26, 0, -30], [-26, 0, 30],
    [-22, 8.05, -22], [-22, 8.05, 22], [-20, 0, -10], [-20, 0, 10], [-26, 0, -14],
  ],
  blue: [
    [32, 0, -20], [32, 0, 0], [32, 0, 20], [26, 0, -30], [26, 0, 30],
    [22, 8.05, -22], [22, 8.05, 22], [20, 0, -10], [20, 0, 10], [26, 0, -14],
  ],
};

// ===== MAP 3: BUNKER — enclosed CQC, perimeter walkway, central bunker =====
const BUNKER_COVER: CoverBox[] = [
  // Central bunker (square, walkable roof at y=4)
  { pos: [0, 2, 0], size: [3.5, 2, 3.5], kind: "platform" },
  // Stairs to central bunker roof (south)
  ...stairs(0, 3.5, 4, 8, 3, 5, "z", 1),
  // Stairs to central bunker roof (north)
  ...stairs(0, -3.5, 4, 8, 3, 5, "z", -1),
  // Perimeter upper walkway at y=3.5 (4 sides)
  { pos: [0, 3.5, -22], size: [22, 0.4, 1.5], kind: "platform" },
  { pos: [0, 3.5, 22], size: [22, 0.4, 1.5], kind: "platform" },
  { pos: [-22, 3.5, 0], size: [1.5, 0.4, 22], kind: "platform" },
  { pos: [22, 3.5, 0], size: [1.5, 0.4, 22], kind: "platform" },
  // Stairs to perimeter walkway (4 corners)
  ...stairs(-18, -20.5, 3.5, 7, 3, 5, "z", 1),
  ...stairs(18, -20.5, 3.5, 7, 3, 5, "z", 1),
  ...stairs(-18, 20.5, 3.5, 7, 3, 5, "z", -1),
  ...stairs(18, 20.5, 3.5, 7, 3, 5, "z", -1),
  // Inner walls (corridors)
  { pos: [-8, 1.5, -10], size: [0.5, 1.5, 6], kind: "cover" },
  { pos: [8, 1.5, 10], size: [0.5, 1.5, 6], kind: "cover" },
  { pos: [-10, 1.5, 8], size: [6, 1.5, 0.5], kind: "cover" },
  { pos: [10, 1.5, -8], size: [6, 1.5, 0.5], kind: "cover" },
  // Crates
  { pos: [-5, 0.6, -5], size: [1, 0.6, 1], kind: "cover" },
  { pos: [5, 0.6, 5], size: [1, 0.6, 1], kind: "cover" },
  { pos: [-5, 0.6, 5], size: [1, 0.6, 1], kind: "cover" },
  { pos: [5, 0.6, -5], size: [1, 0.6, 1], kind: "cover" },
  // Pillars
  { pos: [-12, 2, -12], size: [0.6, 2, 0.6], kind: "cover" },
  { pos: [12, 2, -12], size: [0.6, 2, 0.6], kind: "cover" },
  { pos: [-12, 2, 12], size: [0.6, 2, 0.6], kind: "cover" },
  { pos: [12, 2, 12], size: [0.6, 2, 0.6], kind: "cover" },
  // ---- M1 (Maps Expansion): outer ring + multi-level cover (size 28 -> 60) ----
  // Outer perimeter upper walkway at y=5 (wider + taller than the original y=3.5 walkway)
  { pos: [0, 5, -50], size: [50, 0.4, 1.5], kind: "platform" },
  { pos: [0, 5, 50], size: [50, 0.4, 1.5], kind: "platform" },
  { pos: [-50, 5, 0], size: [1.5, 0.4, 50], kind: "platform" },
  { pos: [50, 5, 0], size: [1.5, 0.4, 50], kind: "platform" },
  // Stairs up to the outer walkway (4 corners)
  ...stairs(-44, -48.5, 5, 10, 3, 5, "z", 1),
  ...stairs(44, -48.5, 5, 10, 3, 5, "z", 1),
  ...stairs(-44, 48.5, 5, 10, 3, 5, "z", -1),
  ...stairs(44, 48.5, 5, 10, 3, 5, "z", -1),
  // Two tall "bunker" boxes (top at y=4, 3x3 footprint) at outer midpoints
  { pos: [40, 2, 0], size: [1.5, 2, 1.5], kind: "cover" },
  { pos: [-40, 2, 0], size: [1.5, 2, 1.5], kind: "cover" },
  // Stairs to the new bunker tops
  ...stairs(40, 1.5, 4, 8, 3, 5, "z", 1),
  // ---- Verticality: central elevated bridge at y=4 connecting east and west bunkers ----
  // A high perch overlooking the central bunker — accessible from both sides.
  { pos: [0, 4, 0], size: [30, 0.25, 1.2], kind: "platform" },
  ...stairs(15, 1.2, 4, 8, 1.5, 5, "z", 1),
  ...stairs(-15, -1.2, 4, 8, 1.5, 5, "z", -1),
  // Accent stripes on the bunker tops (emissive — art direction)
  { pos: [40, 4.05, 0], size: [1.5, 0.03, 1.5], kind: "accent" },
  { pos: [-40, 4.05, 0], size: [1.5, 0.03, 1.5], kind: "accent" },
  ...stairs(-40, -1.5, 4, 8, 3, 5, "z", -1),
  // Outer perimeter walls (solid, taller than the walkway)
  { pos: [0, 4, -58], size: [58, 4, 0.5], kind: "cover" },
  { pos: [0, 4, 58], size: [58, 4, 0.5], kind: "cover" },
  { pos: [58, 4, 0], size: [0.5, 4, 58], kind: "cover" },
  { pos: [-58, 4, 0], size: [0.5, 4, 58], kind: "cover" },
  // Scattered low crates in the expanded arena
  { pos: [25, 0.6, 25], size: [1, 0.6, 1], kind: "cover" },
  { pos: [-25, 0.6, -25], size: [1, 0.6, 1], kind: "cover" },
  // ---- Round 16-b: density pass — corner scatter + mid dividers + cubby crates ----
  // 4 low crates in the corners (extra spawn-side scatter)
  { pos: [20, 0.6, 20], size: [1, 0.6, 1], kind: "cover" },
  { pos: [-20, 0.6, -20], size: [1, 0.6, 1], kind: "cover" },
  { pos: [20, 0.6, -20], size: [1, 0.6, 1], kind: "cover" },
  { pos: [-20, 0.6, 20], size: [1, 0.6, 1], kind: "cover" },
  // 4 chest-high walls dividing the mid (between central bunker and perimeter)
  { pos: [8, 1.0, 0], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [-8, 1.0, 0], size: [0.5, 1.0, 3], kind: "cover" },
  { pos: [0, 1.0, 8], size: [3, 1.0, 0.5], kind: "cover" },
  { pos: [0, 1.0, -8], size: [3, 1.0, 0.5], kind: "cover" },
  // 4 tall (2.5-high) crates forming cubby corners near the inner pillars
  { pos: [20, 1.25, 22], size: [1.2, 1.25, 1.2], kind: "cover" },
  { pos: [-20, 1.25, -22], size: [1.2, 1.25, 1.2], kind: "cover" },
  { pos: [20, 1.25, -22], size: [1.2, 1.25, 1.2], kind: "cover" },
  { pos: [-20, 1.25, 22], size: [1.2, 1.25, 1.2], kind: "cover" },
];

const BUNKER_SPAWNS: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] } = {
  ffa: [
    [-27, 0, -24], [24, 0, -24], [-24, 0, 24], [27, 0, 24],
    [0, 0, -26], [0, 0, 26], [-26, 0, 0], [26, 0, 0],
    [-15, 0, -12], [15, 0, 12], [-15, 0, 12], [15, 0, -12],
    [-16, 0, 0], [16, 0, 0], [0, 0, -16], [0, 0, 16],
    // Elevated spawns on walkway
    [0, 3.95, -22], [0, 3.95, 22], [-22, 3.95, 0], [22, 3.95, 0],
  ],
  red: [
    [-26, 0, -16], [-26, 0, 0], [-26, 0, 16], [-22, 0, -26], [-22, 0, 26],
    [-22, 3.95, 0], [-15, 0, -16], [-15, 0, 16], [-20, 0, -10], [-20, 0, 10],
  ],
  blue: [
    [26, 0, -16], [26, 0, 0], [26, 0, 16], [22, 0, -26], [22, 0, 26],
    [22, 3.95, 0], [15, 0, -16], [15, 0, 16], [20, 0, -10], [20, 0, 10],
  ],
};

// ===== MAP 4: SHIPYARD — chaotic CQC, industrial docks (CoD Shipyard-inspired) =====
const SHIPYARD_COVER: CoverBox[] = [
  // ---- Central drydock: a raised walkable platform with clear ramps on all 4 sides.
  // Previously this was a "pit" (lowered) which the engine can't model (groundHeightAt
  // returns the TOP of boxes, not the bottom). The old design also had 4 small crates
  // at (±3, 0.5, 0) + (0, 0.5, ±3) forming a plus-shaped blockade that made the center
  // feel impenetrable. Now it's a clean raised platform with wide-open ramps.
  { pos: [0, 0.6, 0], size: [5, 0.6, 8], kind: "platform" },
  // Wide ramps up to the central platform from all 4 directions (walkable, no jumping)
  ...stairs(0, 8, 1.2, 5, 8, 7, "z", 1),
  ...stairs(0, -8, 1.2, 5, 8, 7, "z", -1),
  ...stairs(5, 0, 1.2, 5, 8, 7, "x", 1),
  ...stairs(-5, 0, 1.2, 5, 8, 7, "x", -1),
  // Shipping containers (rust-orange). Some stacked 2-high to create vertical play.
  // West row (3 containers, middle one stacked)
  { pos: [-12, 1.2, -10], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-12, 1.2, 0], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-12, 3.6, 0], size: [2.5, 1.2, 6], kind: "cover" },   // stacked
  { pos: [-12, 1.2, 10], size: [2.5, 1.2, 6], kind: "cover" },
  // East row (3 containers, middle one stacked)
  { pos: [12, 1.2, -10], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [12, 1.2, 0], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [12, 3.6, 0], size: [2.5, 1.2, 6], kind: "cover" },    // stacked
  { pos: [12, 1.2, 10], size: [2.5, 1.2, 6], kind: "cover" },
  // North + south container clusters (perpendicular, narrower corridors)
  { pos: [-5, 1.2, -16], size: [6, 1.2, 2.5], kind: "cover" },
  { pos: [5, 1.2, -16], size: [6, 1.2, 2.5], kind: "cover" },
  { pos: [-5, 1.2, 16], size: [6, 1.2, 2.5], kind: "cover" },
  { pos: [5, 1.2, 16], size: [6, 1.2, 2.5], kind: "cover" },
  // Stairs up onto the stacked containers (west + east) — container-top sniper perches
  ...stairs(-14.5, 0, 4.8, 10, 2.5, 8, "x", -1),
  ...stairs(14.5, 0, 4.8, 10, 2.5, 8, "x", 1),
  // Elevated crane walkway crossing east-west at y=5
  { pos: [0, 5, 0], size: [20, 0.3, 1.2], kind: "platform" },
  // Crane walkway crossing north-south at y=5
  { pos: [0, 5, 0], size: [1.2, 0.3, 20], kind: "platform" },
  // Stairs up to crane walkway (NW + SE corners)
  ...stairs(-7, -1.2, 5, 10, 1.5, 6, "z", -1),
  ...stairs(7, 1.2, 5, 10, 1.5, 6, "z", 1),
  // Crane tower support (visual + walkable top) at the walkway intersection
  { pos: [0, 2.5, 0], size: [0.6, 2.5, 0.6], kind: "cover" },
  // Industrial hazard stripes on container tops (emissive accent)
  { pos: [-12, 4.85, 0], size: [2.5, 0.05, 6], kind: "accent" },
  { pos: [12, 4.85, 0], size: [2.5, 0.05, 6], kind: "accent" },
  // ---- M1 (Maps Expansion): outer ring + multi-level cover (size 30 -> 62) ----
  // Additional shipping container stacks (stacked 2-high) at outer east/west
  { pos: [40, 1.2, -20], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [40, 3.6, -20], size: [2.5, 1.2, 6], kind: "cover" },   // stacked
  { pos: [-40, 1.2, 20], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-40, 3.6, 20], size: [2.5, 1.2, 6], kind: "cover" },   // stacked
  // Stairs up onto the new stacked containers
  ...stairs(42.5, -20, 4.8, 10, 2.5, 8, "x", 1),
  ...stairs(-42.5, 20, 4.8, 10, 2.5, 8, "x", -1),
  // Tall crane tower (top at y=6, 3x3 footprint) at outer NE corner
  { pos: [45, 3, -45], size: [1.5, 3, 1.5], kind: "platform" },
  ...stairs(45, -43.5, 6, 12, 2, 5, "z", 1),
  // Outer elevated crane walkway at y=5 (east-west, longer span)
  { pos: [0, 5, -45], size: [45, 0.3, 1.2], kind: "platform" },
  // Stairs up to the outer walkway
  ...stairs(0, -43.8, 5, 10, 2, 5, "z", 1),
  // Second outer walkway (north side, y=5) for more vertical connectivity
  { pos: [0, 5, 45], size: [45, 0.3, 1.2], kind: "platform" },
  ...stairs(0, 43.8, 5, 10, 2, 5, "z", -1),
  // Perimeter walls
  { pos: [0, 4, -60], size: [60, 4, 0.5], kind: "cover" },
  { pos: [0, 4, 60], size: [60, 4, 0.5], kind: "cover" },
  { pos: [60, 4, 0], size: [0.5, 4, 60], kind: "cover" },
  { pos: [-60, 4, 0], size: [0.5, 4, 60], kind: "cover" },
  // Scattered low crates (scattered for cover, not blocking center)
  { pos: [25, 0.5, 0], size: [0.8, 0.5, 0.8], kind: "cover" },
  { pos: [-25, 0.5, 0], size: [0.8, 0.5, 0.8], kind: "cover" },
  { pos: [25, 0.5, -15], size: [0.8, 0.5, 0.8], kind: "cover" },
  { pos: [-25, 0.5, 15], size: [0.8, 0.5, 0.8], kind: "cover" },
  // ---- Round 16-b: density pass — more containers + peek walls + spawn scatter + crane legs ----
  // 10 additional shipping containers (rust-orange, varied positions; some stacked 2-high)
  { pos: [45, 1.2, 25], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-45, 1.2, -25], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [40, 1.2, 30], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-40, 1.2, -30], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [20, 1.2, -30], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-20, 1.2, 30], size: [2.5, 1.2, 6], kind: "cover" },
  // Offset to z=±10 (off the x=±28 spawn axis) so FFA spawns at (±28,0,0) keep clearance.
  { pos: [38, 1.2, 10], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-38, 1.2, -10], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [15, 1.2, 30], size: [2.5, 1.2, 6], kind: "cover" },
  { pos: [-15, 1.2, -30], size: [2.5, 1.2, 6], kind: "cover" },
  // 6 chest-high walls between container rows (peek cover for engagements)
  { pos: [-22, 1.0, 5], size: [4, 1.0, 0.5], kind: "cover" },
  { pos: [-22, 1.0, -5], size: [4, 1.0, 0.5], kind: "cover" },
  { pos: [22, 1.0, 5], size: [4, 1.0, 0.5], kind: "cover" },
  { pos: [22, 1.0, -5], size: [4, 1.0, 0.5], kind: "cover" },
  { pos: [-5, 1.0, 22], size: [0.5, 1.0, 4], kind: "cover" },
  { pos: [5, 1.0, -22], size: [0.5, 1.0, 4], kind: "cover" },
  // 4 low crates near spawns (small scatter for spawn-side cover)
  { pos: [-30, 0.5, 10], size: [0.8, 0.5, 0.8], kind: "cover" },
  { pos: [30, 0.5, 10], size: [0.8, 0.5, 0.8], kind: "cover" },
  { pos: [0, 0.5, -32], size: [0.8, 0.5, 0.8], kind: "cover" },
  { pos: [0, 0.5, 32], size: [0.8, 0.5, 0.8], kind: "cover" },
  // 4 tall crane-leg pillars at the outer corners (sight blockers + visual anchor)
  { pos: [50, 2.0, 50], size: [0.6, 2.0, 0.6], kind: "cover" },
  { pos: [-50, 2.0, -50], size: [0.6, 2.0, 0.6], kind: "cover" },
  { pos: [50, 2.0, -50], size: [0.6, 2.0, 0.6], kind: "cover" },
  { pos: [-50, 2.0, 50], size: [0.6, 2.0, 0.6], kind: "cover" },
];

const SHIPYARD_SPAWNS: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] } = {
  ffa: [
    [-26, 0, -26], [26, 0, -26], [-26, 0, 26], [26, 0, 26],
    [0, 0, -28], [0, 0, 28], [-28, 0, 0], [28, 0, 0],
    [-16, 0, -16], [16, 0, 16], [-16, 0, 16], [16, 0, -16],
    [-20, 0, -8], [20, 0, 8], [-8, 0, -20], [8, 0, 20],
    // Elevated: container tops + crane walkway
    [-12, 4.85, -4], [12, 4.85, 4], [0, 5.15, -10], [0, 5.15, 10],
  ],
  red: [
    [-26, 0, -20], [-31, 0, 0], [-26, 0, 20], [-22, 0, -26], [-27, 0, 26],
    [-12, 4.85, -4], [-16, 0, -16], [-16, 0, 16], [-20, 0, -10], [-20, 0, 10],
  ],
  blue: [
    [26, 0, -20], [31, 0, 0], [26, 0, 20], [27, 0, -26], [22, 0, 26],
    [12, 4.85, 4], [16, 0, -16], [16, 0, 16], [20, 0, -10], [20, 0, 10],
  ],
};

const SHIPYARD_LIGHTS: MapAccentLight[] = [
  // Orange industrial lights atop container stacks
  { pos: [-12, 4, 0], color: 0xff8c1a, intensity: 2.4, distance: 16 },
  { pos: [12, 4, 0], color: 0xff8c1a, intensity: 2.4, distance: 16 },
  { pos: [-12, 4, -10], color: 0xff8c1a, intensity: 2.0, distance: 14 },
  { pos: [12, 4, 10], color: 0xff8c1a, intensity: 2.0, distance: 14 },
  // Crane walkway lights (high)
  { pos: [0, 6.5, -10], color: 0xffa84a, intensity: 1.8, distance: 14 },
  { pos: [0, 6.5, 10], color: 0xffa84a, intensity: 1.8, distance: 14 },
  // Teal accent lights at the drydock pit
  { pos: [0, 1, 0], color: 0x18b0c0, intensity: 1.8, distance: 12 },
  { pos: [0, 0.5, -4], color: 0x18b0c0, intensity: 1.4, distance: 10 },
];

// ===== MAP 6: TERMINAL — classic CoD airport terminal (mid-range engagements) =====
const TERMINAL_COVER: CoverBox[] = [
  // Central planter row (low wide, accent kind for greenery feel)
  { pos: [0, 0.5, 0], size: [1.5, 0.5, 10], kind: "accent" },
  // Benches around the planter
  { pos: [-3, 0.4, 0], size: [0.6, 0.4, 4], kind: "cover" },
  { pos: [3, 0.4, 0], size: [0.6, 0.4, 4], kind: "cover" },
  // East-side shop kiosks (4)
  { pos: [20, 1.5, -16], size: [2, 1.5, 2], kind: "cover" },
  { pos: [20, 1.5, -6], size: [2, 1.5, 2], kind: "cover" },
  { pos: [20, 1.5, 6], size: [2, 1.5, 2], kind: "cover" },
  { pos: [20, 1.5, 16], size: [2, 1.5, 2], kind: "cover" },
  // West-side shop kiosks (4)
  { pos: [-20, 1.5, -16], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-20, 1.5, -6], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-20, 1.5, 6], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-20, 1.5, 16], size: [2, 1.5, 2], kind: "cover" },
  // Second-level walkway crossing east-west at y=5
  { pos: [0, 5, 0], size: [16, 0.3, 2], kind: "platform" },
  // Glass railing on walkway (small accent boxes on either side)
  { pos: [0, 5.6, -1.2], size: [16, 0.5, 0.1], kind: "accent" },
  { pos: [0, 5.6, 1.2], size: [16, 0.5, 0.1], kind: "accent" },
  // Stairs up to walkway (east + west ends)
  ...stairs(16, 0, 5, 10, 2, 6, "x", 1),
  ...stairs(-16, 0, 5, 10, 2, 6, "x", -1),
  // 6 pillars along the central spine
  { pos: [-6, 1.5, -6], size: [0.6, 1.5, 0.6], kind: "cover" },
  { pos: [6, 1.5, -6], size: [0.6, 1.5, 0.6], kind: "cover" },
  { pos: [-6, 1.5, 6], size: [0.6, 1.5, 0.6], kind: "cover" },
  { pos: [6, 1.5, 6], size: [0.6, 1.5, 0.6], kind: "cover" },
  { pos: [0, 1.5, -10], size: [0.6, 1.5, 0.6], kind: "cover" },
  { pos: [0, 1.5, 10], size: [0.6, 1.5, 0.6], kind: "cover" },
  // Luggage carts (low cover)
  { pos: [-3, 0.6, -4], size: [1.5, 0.6, 0.8], kind: "cover" },
  { pos: [3, 0.6, 4], size: [1.5, 0.6, 0.8], kind: "cover" },
  // Chair rows (small cover)
  { pos: [-10, 0.4, -14], size: [0.4, 0.4, 2], kind: "cover" },
  { pos: [10, 0.4, 14], size: [0.4, 0.4, 2], kind: "cover" },
  // Accent: blue glowing advertisement panels on kiosk fronts
  { pos: [22, 1.5, -16], size: [0.05, 1.0, 1.5], kind: "accent" },
  { pos: [22, 1.5, 16], size: [0.05, 1.0, 1.5], kind: "accent" },
  { pos: [-22, 1.5, -16], size: [0.05, 1.0, 1.5], kind: "accent" },
  { pos: [-22, 1.5, 16], size: [0.05, 1.0, 1.5], kind: "accent" },
  // ---- M1 (Maps Expansion): outer ring + multi-level cover (size 34 -> 64) ----
  // Outer second-level walkway extensions at y=5 (longer east-west spans)
  { pos: [0, 5, -45], size: [50, 0.3, 2], kind: "platform" },
  { pos: [0, 5, 45], size: [50, 0.3, 2], kind: "platform" },
  // Stairs up to the outer walkway extensions
  ...stairs(0, -43, 5, 10, 3, 6, "z", 1),
  ...stairs(0, 43, 5, 10, 3, 6, "z", -1),
  // Tall kiosk "buildings" (top at y=4, 3x3 footprint) at outer NE/SW
  { pos: [42, 2, -42], size: [1.5, 2, 1.5], kind: "cover" },
  { pos: [-42, 2, 42], size: [1.5, 2, 1.5], kind: "cover" },
  ...stairs(42, -40.5, 4, 8, 2, 5, "z", 1),
  ...stairs(-42, 40.5, 4, 8, 2, 5, "z", -1),
  // Outer shop kiosk rows (4 each on east and west outer edges)
  { pos: [50, 1.5, -30], size: [2, 1.5, 2], kind: "cover" },
  { pos: [50, 1.5, -10], size: [2, 1.5, 2], kind: "cover" },
  { pos: [50, 1.5, 10], size: [2, 1.5, 2], kind: "cover" },
  { pos: [50, 1.5, 30], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-50, 1.5, -30], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-50, 1.5, -10], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-50, 1.5, 10], size: [2, 1.5, 2], kind: "cover" },
  { pos: [-50, 1.5, 30], size: [2, 1.5, 2], kind: "cover" },
  // Perimeter glass walls
  { pos: [0, 4, -62], size: [62, 4, 0.5], kind: "cover" },
  { pos: [0, 4, 62], size: [62, 4, 0.5], kind: "cover" },
  { pos: [62, 4, 0], size: [0.5, 4, 62], kind: "cover" },
  { pos: [-62, 4, 0], size: [0.5, 4, 62], kind: "cover" },
  // Luggage cart cover (low)
  { pos: [25, 0.6, 0], size: [1.5, 0.6, 0.8], kind: "cover" },
  { pos: [-25, 0.6, 0], size: [1.5, 0.6, 0.8], kind: "cover" },
  // ---- Round 16-b: density pass — benches + planters + luggage carts + pillars + info kiosks ----
  // 8 benches (low 0.5-high, long thin) along the outer concourse
  { pos: [36, 0.25, 0], size: [0.3, 0.25, 1.5], kind: "cover" },
  { pos: [-36, 0.25, 0], size: [0.3, 0.25, 1.5], kind: "cover" },
  { pos: [10, 0.25, 30], size: [1.5, 0.25, 0.3], kind: "cover" },
  { pos: [-10, 0.25, -30], size: [1.5, 0.25, 0.3], kind: "cover" },
  { pos: [40, 0.25, 25], size: [1.5, 0.25, 0.3], kind: "cover" },
  { pos: [-40, 0.25, -25], size: [1.5, 0.25, 0.3], kind: "cover" },
  { pos: [40, 0.25, -25], size: [1.5, 0.25, 0.3], kind: "cover" },
  { pos: [-40, 0.25, 25], size: [1.5, 0.25, 0.3], kind: "cover" },
  // 6 planters (chest-high 1.0-high, square 1.2) between kiosks and central
  { pos: [15, 0.5, 0], size: [0.6, 0.5, 0.6], kind: "cover" },
  { pos: [-15, 0.5, 0], size: [0.6, 0.5, 0.6], kind: "cover" },
  { pos: [0, 0.5, 18], size: [0.6, 0.5, 0.6], kind: "cover" },
  { pos: [0, 0.5, -18], size: [0.6, 0.5, 0.6], kind: "cover" },
  { pos: [15, 0.5, 20], size: [0.6, 0.5, 0.6], kind: "cover" },
  { pos: [-15, 0.5, -20], size: [0.6, 0.5, 0.6], kind: "cover" },
  // 4 luggage carts (low 0.7-high) along the outer concourse
  { pos: [25, 0.35, 10], size: [0.75, 0.35, 0.4], kind: "cover" },
  { pos: [-25, 0.35, 10], size: [0.75, 0.35, 0.4], kind: "cover" },
  { pos: [25, 0.35, -10], size: [0.75, 0.35, 0.4], kind: "cover" },
  { pos: [-25, 0.35, -10], size: [0.75, 0.35, 0.4], kind: "cover" },
  // 4 tall structural pillars (3.5-high) along the concourse between inner & outer kiosk rows
  { pos: [35, 1.75, 25], size: [0.5, 1.75, 0.5], kind: "cover" },
  { pos: [-35, 1.75, 25], size: [0.5, 1.75, 0.5], kind: "cover" },
  { pos: [35, 1.75, -25], size: [0.5, 1.75, 0.5], kind: "cover" },
  { pos: [-35, 1.75, -25], size: [0.5, 1.75, 0.5], kind: "cover" },
  // 2 info kiosks (chest-high 1.2-high, square 1.5) flanking the central planter
  { pos: [10, 0.6, 0], size: [0.75, 0.6, 0.75], kind: "cover" },
  { pos: [-10, 0.6, 0], size: [0.75, 0.6, 0.75], kind: "cover" },
];

const TERMINAL_SPAWNS: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] } = {
  ffa: [
    [-30, 0, -30], [30, 0, -30], [-30, 0, 30], [30, 0, 30],
    [0, 0, -32], [0, 0, 32], [-32, 0, 0], [32, 0, 0],
    [-16, 0, -16], [16, 0, 16], [-16, 0, 16], [16, 0, -16],
    [-26, 0, -8], [26, 0, 8], [-8, 0, -22], [8, 0, 22],
    [-30, 0, 0], [30, 0, 0], [0, 0, -24], [0, 0, 24],
    // Elevated: walkway
    [0, 5.15, -10], [0, 5.15, 10], [-10, 5.15, 0], [10, 5.15, 0],
  ],
  red: [
    [-30, 0, -20], [-30, 0, 0], [-30, 0, 20], [-26, 0, -30], [-26, 0, 30],
    [-10, 5.15, 0], [-22, 0, -10], [-22, 0, 10], [-24, 0, -16], [-24, 0, 16],
  ],
  blue: [
    [30, 0, -20], [30, 0, 0], [30, 0, 20], [26, 0, -30], [26, 0, 30],
    [10, 5.15, 0], [22, 0, -10], [22, 0, 10], [24, 0, -16], [24, 0, 16],
  ],
};

const TERMINAL_LIGHTS: MapAccentLight[] = [
  // Cool blue accent lights along the central spine
  { pos: [0, 8, -14], color: 0x38bdf8, intensity: 1.8, distance: 16 },
  { pos: [0, 8, -5], color: 0x38bdf8, intensity: 1.8, distance: 16 },
  { pos: [0, 8, 5], color: 0x38bdf8, intensity: 1.8, distance: 16 },
  { pos: [0, 8, 14], color: 0x38bdf8, intensity: 1.8, distance: 16 },
  // Bright white lights over the walkway stairs
  { pos: [-14, 8, 0], color: 0xffffff, intensity: 2.0, distance: 14 },
  { pos: [14, 8, 0], color: 0xffffff, intensity: 2.0, distance: 14 },
  // Side concourse lights
  { pos: [-22, 6, 0], color: 0x88c8ff, intensity: 1.4, distance: 12 },
  { pos: [22, 6, 0], color: 0x88c8ff, intensity: 1.4, distance: 12 },
];

// ===== MAP 7: ARENA_NEON — Neon Plaza (cyberpunk, very large, multi-level) =====
// Sprawling dark purple/magenta plaza built for vertical arcade-shooter gameplay:
// 2-story central tower, 4 corner platforms reachable via stair-step ramps,
// 2 elevated bridges at y=4 spanning opposite edges, tall perimeter walls,
// and scattered low cover for sprinting lanes.
const ARENA_NEON_COVER: CoverBox[] = [
  // Central 2-story tower (solid 6-high, footprint 7x7) — top at y=6 dominates the plaza
  { pos: [0, 3, 0], size: [3.5, 3, 3.5], kind: "platform" },
  // Mid-platform balcony extending south from the tower at y=3.5 (second-story ledge)
  { pos: [0, 3.5, 5], size: [3, 0.3, 2], kind: "platform" },
  // Stairs from ground up to mid-platform (south side, ascending north to y=3.5)
  ...stairs(0, 7, 3.5, 7, 3, 6, "z", 1),
  // Stairs from ground up to tower top (north side, to y=6)
  ...stairs(0, -3.5, 6, 12, 3, 8, "z", -1),
  // Stairs from ground up to tower top (east face, ascending west to y=6)
  ...stairs(3.5, 0, 6, 12, 3, 8, "x", 1),
  // 4 corner platforms at y=2.5 (walkable tops) — reachable via stair-step ramps
  { pos: [-30, 2.5, -30], size: [5, 0.4, 5], kind: "platform" },
  { pos: [30, 2.5, -30], size: [5, 0.4, 5], kind: "platform" },
  { pos: [-30, 2.5, 30], size: [5, 0.4, 5], kind: "platform" },
  { pos: [30, 2.5, 30], size: [5, 0.4, 5], kind: "platform" },
  // Stair-step ramps up to each corner platform (to y=2.5)
  ...stairs(-30, -25, 2.5, 5, 5, 5, "z", 1),
  ...stairs(30, -25, 2.5, 5, 5, 5, "z", 1),
  ...stairs(-30, 25, 2.5, 5, 5, 5, "z", -1),
  ...stairs(30, 25, 2.5, 5, 5, 5, "z", -1),
  // 2 elevated bridges at y=6 connecting opposite corners (long axis-aligned spans)
  // Bridge 1: north edge — connects NW corner platform to NE corner platform
  { pos: [0, 6, -30], size: [35, 0.3, 1.5], kind: "platform" },
  // Bridge 2: south edge — provides a separate upper crossing above the decks
  { pos: [0, 6, 30], size: [35, 0.3, 1.5], kind: "platform" },
  // Independent ground-to-bridge stair approaches; lower decks retain overhead clearance
  ...stairs(-23, -31.5, 6, 12, 2, 5, "z", -1),
  ...stairs(23, -31.5, 6, 12, 2, 5, "z", -1),
  ...stairs(-23, 31.5, 6, 12, 2, 5, "z", 1),
  ...stairs(23, 31.5, 6, 12, 2, 5, "z", 1),
  // Perimeter walls (tall thin boxes around the dense 128x128 arena)
  { pos: [0, 5, -62], size: [64, 5, 0.5], kind: "cover" },
  { pos: [0, 5, 62], size: [64, 5, 0.5], kind: "cover" },
  { pos: [62, 5, 0], size: [0.5, 5, 64], kind: "cover" },
  { pos: [-62, 5, 0], size: [0.5, 5, 64], kind: "cover" },
  // Scattered low cover (1m cubes) throughout the plaza — sprinting lanes / hardscape
  { pos: [-15, 0.5, 0], size: [1, 0.5, 1], kind: "cover" },
  { pos: [15, 0.5, 0], size: [1, 0.5, 1], kind: "cover" },
  { pos: [0, 0.5, -15], size: [1, 0.5, 1], kind: "cover" },
  { pos: [0, 0.5, 15], size: [1, 0.5, 1], kind: "cover" },
  { pos: [-50, 0.5, -50], size: [1, 0.5, 1], kind: "cover" },
  { pos: [50, 0.5, -50], size: [1, 0.5, 1], kind: "cover" },
  { pos: [-50, 0.5, 50], size: [1, 0.5, 1], kind: "cover" },
  { pos: [50, 0.5, 50], size: [1, 0.5, 1], kind: "cover" },
  // (edge-axis low cover compressed from +-60 to +-55 for denser 128x128 plaza)
  { pos: [-55, 0.5, 0], size: [1.5, 0.5, 1.5], kind: "cover" },
  { pos: [55, 0.5, 0], size: [1.5, 0.5, 1.5], kind: "cover" },
  { pos: [0, 0.5, -55], size: [1.5, 0.5, 1.5], kind: "cover" },
  { pos: [0, 0.5, 55], size: [1.5, 0.5, 1.5], kind: "cover" },
  // Neon accent strips (emissive thin boxes flanking the central tower base)
  { pos: [0, 0.05, -5], size: [4, 0.05, 0.2], kind: "accent" },
  { pos: [0, 0.05, 5], size: [4, 0.05, 0.2], kind: "accent" },
  { pos: [-5, 0.05, 0], size: [0.2, 0.05, 4], kind: "accent" },
  { pos: [5, 0.05, 0], size: [0.2, 0.05, 4], kind: "accent" },
  // ---- Round 16-b: density pass — neon pillars + holo barriers + low crates + outer cubbies + accents ----
  // 6 tall (4-high) neon pillars (sight blockers between center and corners)
  { pos: [15, 2.0, 15], size: [0.5, 2.0, 0.5], kind: "cover" },
  { pos: [-15, 2.0, 15], size: [0.5, 2.0, 0.5], kind: "cover" },
  { pos: [15, 2.0, -15], size: [0.5, 2.0, 0.5], kind: "cover" },
  { pos: [-15, 2.0, -15], size: [0.5, 2.0, 0.5], kind: "cover" },
  { pos: [45, 2.0, 0], size: [0.5, 2.0, 0.5], kind: "cover" },
  { pos: [-45, 2.0, 0], size: [0.5, 2.0, 0.5], kind: "cover" },
  // 6 holographic barriers (chest-high 1.2-high, thin) at mid-distance lanes
  { pos: [25, 0.6, 0], size: [1.5, 0.6, 0.2], kind: "cover" },
  { pos: [-25, 0.6, 0], size: [1.5, 0.6, 0.2], kind: "cover" },
  { pos: [0, 0.6, 25], size: [0.2, 0.6, 1.5], kind: "cover" },
  { pos: [0, 0.6, -25], size: [0.2, 0.6, 1.5], kind: "cover" },
  { pos: [25, 0.6, 25], size: [1.5, 0.6, 0.2], kind: "cover" },
  { pos: [-25, 0.6, -25], size: [1.5, 0.6, 0.2], kind: "cover" },
  // 8 low crates (low 0.8-high, jumpable) near corner platforms & bridge ends
  { pos: [5, 0.4, 30], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [-5, 0.4, 30], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [5, 0.4, -30], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [-5, 0.4, -30], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [30, 0.4, 5], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [-30, 0.4, 5], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [30, 0.4, -5], size: [1.0, 0.4, 1.0], kind: "cover" },
  { pos: [-30, 0.4, -5], size: [1.0, 0.4, 1.0], kind: "cover" },
  // 6 chest-high walls forming an outer ring of cubbies (compressed inward for denser 128x128 plaza)
  { pos: [50, 0.6, 20], size: [4, 0.6, 0.5], kind: "cover" },
  { pos: [-50, 0.6, 20], size: [4, 0.6, 0.5], kind: "cover" },
  { pos: [50, 0.6, -20], size: [4, 0.6, 0.5], kind: "cover" },
  { pos: [-50, 0.6, -20], size: [4, 0.6, 0.5], kind: "cover" },
  { pos: [20, 0.6, 50], size: [0.5, 0.6, 4], kind: "cover" },
  { pos: [-20, 0.6, -50], size: [0.5, 0.6, 4], kind: "cover" },
  // 3 accent strips on top of the new neon pillars (emissive caps for art direction)
  { pos: [15, 4.05, 15], size: [0.5, 0.05, 0.5], kind: "accent" },
  { pos: [-15, 4.05, 15], size: [0.5, 0.05, 0.5], kind: "accent" },
  { pos: [45, 4.05, 0], size: [0.5, 0.05, 0.5], kind: "accent" },
];

const ARENA_NEON_SPAWNS: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] } = {
  ffa: [
    // Scattered around the perimeter (compressed for 128x128 dense plaza)
    [-55, 0, -55], [55, 0, -55], [-55, 0, 55], [55, 0, 55],
    [6, 0, -54], [-6, 0, 54], [-54, 0, 6], [54, 0, -6],
    [-47, 0, -50], [47, 0, 50], [-47, 0, 50], [47, 0, -50],
    [-55, 0, -30], [55, 0, 30], [-30, 0, -55], [30, 0, 55],
    [-40, 0, 0], [40, 0, 0], [0, 0, -40], [0, 0, 40],
    // Elevated: corner platforms
    [-30, 2.95, -30], [30, 2.95, -30], [-30, 2.95, 30], [30, 2.95, 30],
  ],
  red: [
    // Red corner: NW (compressed for 128x128 dense plaza)
    [-55, 0, -55], [-55, 0, -40], [-55, 0, -25], [-54, 0, 6],
    [-47, 0, -50], [-40, 0, -55], [-30, 2.95, -30], [-45, 0, -45],
    [-50, 0, -35], [-45, 0, -50],
  ],
  blue: [
    // Blue corner: SE (opposite, compressed for 128x128 dense plaza)
    [55, 0, 55], [55, 0, 40], [55, 0, 25], [54, 0, -6],
    [47, 0, 50], [40, 0, 55], [30, 2.95, 30], [45, 0, 45],
    [50, 0, 35], [45, 0, 50],
  ],
};

const ARENA_NEON_LIGHTS: MapAccentLight[] = [
  // Hot-pink neon glow over the central tower
  { pos: [0, 7, 0], color: 0xff2d95, intensity: 2.4, distance: 22 },
  // Magenta corner accents over each corner platform
  { pos: [-30, 5, -30], color: 0xff2d95, intensity: 1.8, distance: 14 },
  { pos: [30, 5, -30], color: 0xff2d95, intensity: 1.8, distance: 14 },
  { pos: [-30, 5, 30], color: 0xff2d95, intensity: 1.8, distance: 14 },
  { pos: [30, 5, 30], color: 0xff2d95, intensity: 1.8, distance: 14 },
  // Purple bridge lights (along the elevated bridges at y=6)
  { pos: [-15, 8, -30], color: 0xb026ff, intensity: 1.6, distance: 12 },
  { pos: [15, 8, -30], color: 0xb026ff, intensity: 1.6, distance: 12 },
  { pos: [-15, 8, 30], color: 0xb026ff, intensity: 1.6, distance: 12 },
  { pos: [15, 8, 30], color: 0xb026ff, intensity: 1.6, distance: 12 },
  // Cyan accent lights scattered along the perimeter (compressed to +-55 for 128x128 dense plaza)
  { pos: [-55, 4, -55], color: 0x00e5ff, intensity: 1.4, distance: 14 },
  { pos: [55, 4, -55], color: 0x00e5ff, intensity: 1.4, distance: 14 },
  { pos: [-55, 4, 55], color: 0x00e5ff, intensity: 1.4, distance: 14 },
  { pos: [55, 4, 55], color: 0x00e5ff, intensity: 1.4, distance: 14 },
];

/** Map interactions are part of designed combat routes. Preserve stable IDs.
 * Hazard locations are not spawn sites; jump pads launch to authored surfaces.
 * Moving platforms are optional side-route props, never mandatory bot links.
 */
const ENVIRONMENTS: Record<MapId, EnvironmentObject[]> = {
  emberhold: [],
  whiteout_depot: [],
  floodgate: [],
  orbital_nexus: [],
  forest_warfare: [],
  compound: [
    // Fuel service yard east of the northern security checkpoint.
    { id: "compound_spikes_service", type: "spikes", pos: [38, 0, -28], size: [1.8, .4, 1.8], damage: 24, period: 4.5, activeFor: 1.6 },
    // Timed security crossing next to the alternate north gate.
    { id: "compound_spikes", type: "spikes", pos: [18, 0, -34], size: [1.8, 0.4, 1.8], damage: 32, period: 4.4, activeFor: 1.5 },
    // South lane launch: reaches elevated walkway at z≈42.
    { id: "compound_spikes_south", type: "spikes", pos: [22, 0, 32], size: [1.8, .4, 1.8], damage: 29, period: 5.2, activeFor: 1.8 },
    // Breachable service gate, between the new concrete checkpoint walls.
    { id: "compound_wall", type: "destructible_wall", pos: [0, 1.5, -34], size: [2.8, 1.5, 0.45], hp: 180 },
    { id:"compound_wall_south",type:"destructible_wall",pos:[0,1.5,34],size:[2.8,1.5,.45],hp:190 },
    { id:"compound_spikes_quarry",type:"spikes",pos:[84,0,-3],size:[1.6,.4,1.6],damage:26,period:5.1,activeFor:1.5 },
  ],
  skybridge: [
    // Maintenance bay faults, on opposite sides of the elevated transit structure.
    { id: "skybridge_fire", type: "fire", pos: [-26, 0, -23], size: [2.2, 1.5, 2.2], dps: 24 },
    { id: "skybridge_spikes", type: "spikes", pos: [26, 0, 23], size: [1.9, 0.4, 1.9], damage: 32, period: 4.5, activeFor: 1.6 },
    // Alternate shortcut onto the central tower; stairs remain the bot-safe way.
    { id: "skybridge_jump", type: "jump_pad", pos: [0, 0, 18], size: [1.8, 0.2, 1.8], launch: [0, 20, -13] },
    // North transit security door creates a flank only when destroyed.
    { id: "skybridge_wall", type: "destructible_wall", pos: [0, 1.5, -28], size: [2.8, 1.5, 0.45], hp: 180 },
  ],
  bunker: [
    // Damaged generator room and timed security floor; neither blocks spawns.
    { id: "bunker_fire", type: "fire", pos: [-43, 0, -33], size: [2.2, 1.5, 2.2], dps: 24 },
    { id: "bunker_spikes", type: "spikes", pos: [0, 0, -44], size: [1.8, 0.4, 1.8], damage: 32, period: 4.6, activeFor: 1.6 },
    // Breakable north bulkhead opens a short route between service corridors.
    { id: "bunker_wall", type: "destructible_wall", pos: [0, 1.5, -35], size: [2.8, 1.5, 0.45], hp: 220 },
  ],
  shipyard: [
    // Cargo/fuel handling area, separated from the original spawn grid.
    { id: "shipyard_spikes_fuel", type: "spikes", pos: [33, 0, 31], size: [2, .4, 2], damage: 27, period: 4.6, activeFor: 1.5 },
    // Moving dock machinery on the western loading route.
    { id: "shipyard_spikes", type: "spikes", pos: [-34, 0, -12], size: [1.8, 0.4, 1.8], damage: 32, period: 4.8, activeFor: 1.6 },
    // Launch towards the south container roofs; stairs provide backup access.
    { id: "shipyard_spikes_conveyor", type: "spikes", pos: [16, 0, 20], size: [1.8, .4, 1.8], damage: 24, period: 5.4, activeFor: 1.6 },
    // Removed the floating cargo platform; normal dock routes remain walkable.
    // Container-checkpoint gate with static wall wings.
    { id: "shipyard_wall", type: "destructible_wall", pos: [0, 1.5, -38], size: [2.8, 1.5, 0.45], hp: 200 },
  ],
  // Day and night city editions are hazard-free urban combat spaces.
  terminal: [],
  arena_neon: [],
};
const BASE_MAPS: Record<MapId, MapDef> = {
  emberhold: {
    id: "emberhold", name: MAP_BLUEPRINTS.maps.emberhold.name, shortName: MAP_BLUEPRINTS.maps.emberhold.shortName,
    description: MAP_BLUEPRINTS.maps.emberhold.description,
    size: 100, wallHeight: 11, cover: TACTICAL_COVER.emberhold, environment: ENVIRONMENTS.emberhold,
    spawns: OUTER_SPAWNS.emberhold, accentColor: "#ef924a",
    theme: { floor: 0x332c2c, floorPattern: 0x575052, wall: 0x4e4546, cover: 0x797069,
      coverAccent: 0xef924a, stair: 0x8c8176, platform: 0x6c6768,
      sky: "#342c3c", fog: "#463b42", fogNear: 45, fogFar: 320, ambient: 1.2, gridColor: 0x575052 },
  },
  whiteout_depot: {
    id:"whiteout_depot",name: MAP_BLUEPRINTS.maps.whiteout_depot.name,shortName: MAP_BLUEPRINTS.maps.whiteout_depot.shortName,
    description: MAP_BLUEPRINTS.maps.whiteout_depot.description,
    // Physical objects and all spawns are authored only in the blueprint/theme.
    size:128,wallHeight:14,cover:TACTICAL_COVER.whiteout_depot,environment:ENVIRONMENTS.whiteout_depot,
    spawns:OUTER_SPAWNS.whiteout_depot,biome:"snow_rail",accentColor:"#64d8dc",
    theme:{floor:0x46575b,floorPattern:0x344a50,wall:0x596b70,cover:0x73868a,
      coverAccent:0x64d8dc,stair:0xadb8b6,platform:0x4a646c,
      sky:"#263b4c",fog:"#687e87",fogNear:65,fogFar:520,ambient:1.8,gridColor:0x344a50},
    lights:[],
  },
  floodgate: {
    id:"floodgate",name: MAP_BLUEPRINTS.maps.floodgate.name,shortName: MAP_BLUEPRINTS.maps.floodgate.shortName,
    description: MAP_BLUEPRINTS.maps.floodgate.description,
    // Physical objects and all 32 spawns are authored only in the blueprint/theme.
    size:176,wallHeight:14,cover:TACTICAL_COVER.floodgate,environment:ENVIRONMENTS.floodgate,
    spawns:OUTER_SPAWNS.floodgate,biome:"hydroelectric",accentColor:"#64d8dc",
    theme:{floor:0x46575b,floorPattern:0x344a50,wall:0x596b70,cover:0x73868a,
      coverAccent:0x64d8dc,stair:0xadb8b6,platform:0x4a646c,
      sky:"#263b4c",fog:"#687e87",fogNear:65,fogFar:520,ambient:1.8,gridColor:0x344a50},
    lights:[],
  },
  orbital_nexus: {
    id:"orbital_nexus",name: MAP_BLUEPRINTS.maps.orbital_nexus.name,shortName: MAP_BLUEPRINTS.maps.orbital_nexus.shortName,
    description: MAP_BLUEPRINTS.maps.orbital_nexus.description,
    size:100,wallHeight:32,cover:TACTICAL_COVER.orbital_nexus,environment:ENVIRONMENTS.orbital_nexus,
    spawns:OUTER_SPAWNS.orbital_nexus,biome:"orbital",accentColor:"#4ce8fb",
    theme:{floor:0x202a40,floorPattern:0x305578,wall:0x323d62,cover:0x64728f,
      coverAccent:0x4ce8fb,stair:0x8596b0,platform:0x465876,
      sky:"#07091d",fog:"#151d39",fogNear:45,fogFar:400,ambient:1.62,gridColor:0x305578},
    lights:[
      {pos:[-76,8,0],color:0xff567b,intensity:2.5,distance:38},
      {pos:[76,8,0],color:0x57deff,intensity:2.5,distance:38},
      {pos:[0,13,0],color:0x9f64ff,intensity:2.7,distance:48},
    ],
  },
  forest_warfare: {
    id: "forest_warfare", name: "Forest Warfare", shortName: "FOR",
    description: "Long woodland valley with ancient climbable trees, dense cover, and raised woodland platforms.",
    size: FOREST_HALF_EXTENT, wallHeight: 10, cover: FOREST_WARFARE_COVER, spawns: FOREST_SPAWNS,
    regions: FOREST_REGIONS,
    surfaces: {
      floor: { pattern: "grass", tileSize: 7, roughness: 1 },
      wall: { pattern: "stone", tileSize: 4, roughness: 1 },
      cover: { pattern: "moss", tileSize: 4, roughness: 1 },
      stair: { pattern: "planks", tileSize: 3, roughness: 1 },
      platform: { pattern: "planks", tileSize: 5, roughness: 1 },
    },
    biome: "forest_warfare", accentColor: "#75bc5d",
    theme: { floor: 0x37532b, floorPattern: 0x284422, wall: 0x304829,
      cover: 0x656e5b, coverAccent: 0x78ae54, stair: 0x6b452b,
      platform: 0x5d3d26, sky: "#8aa99a", fog: "#8aa99a", fogNear: 90, fogFar: 450,
      ambient: 1.35, gridColor: 0x405c31 },
    lights: [
      { pos: [-94,19,0], color: 0xffc6a9, intensity: 1.5, distance: 38 },
      { pos: [94,19,0], color: 0xb6e2ff, intensity: 1.5, distance: 38 },
    ],
  },
  compound: {
    id: "compound",
    environment: ENVIRONMENTS.compound,
    name: MAP_BLUEPRINTS.maps.compound.name,
    shortName: MAP_BLUEPRINTS.maps.compound.shortName,
    description: MAP_BLUEPRINTS.maps.compound.description,
    size: 64,
    wallHeight: 10,
    cover: [...COMPOUND_COVER, ...TACTICAL_COVER.compound],
    spawns: {
      ffa: [...COMPOUND_SPAWNS.ffa, ...OUTER_SPAWNS.compound.ffa],
      red: [...COMPOUND_SPAWNS.red, ...OUTER_SPAWNS.compound.red],
      blue: [...COMPOUND_SPAWNS.blue, ...OUTER_SPAWNS.compound.blue],
    },
    accentColor: "#f59e0b",
    theme: {
      floor: 0x2a3038, floorPattern: 0x1a1f26, wall: 0x1a1f26, cover: 0x3b424c, coverAccent: 0xf59e0b,
      stair: 0x4a5260, platform: 0x2f3640, sky: "#0b0f14", fog: "#0b0f14", fogNear: 40, fogFar: 120,
      ambient: 1.0, gridColor: 0x3a4452,
    },
    lights: [
      { pos: [0, 6, 0], color: 0xf59e0b, intensity: 1.8, distance: 18 }, // amber light over central platform
      { pos: [-14, 5, -14], color: 0xff8c1a, intensity: 1.4, distance: 12 }, // corner accents
      { pos: [14, 5, -14], color: 0xff8c1a, intensity: 1.4, distance: 12 },
      { pos: [-14, 5, 14], color: 0xff8c1a, intensity: 1.4, distance: 12 },
      { pos: [14, 5, 14], color: 0xff8c1a, intensity: 1.4, distance: 12 },
    ],
  },
  skybridge: {
    id: "skybridge",
    environment: ENVIRONMENTS.skybridge,
    name: MAP_BLUEPRINTS.maps.skybridge.name,
    shortName: MAP_BLUEPRINTS.maps.skybridge.shortName,
    description: MAP_BLUEPRINTS.maps.skybridge.description,
    size: 64,
    wallHeight: 14,
    cover: [...SKYBRIDGE_COVER, ...TACTICAL_COVER.skybridge],
    spawns: {
      ffa: [...SKYBRIDGE_SPAWNS.ffa, ...OUTER_SPAWNS.skybridge.ffa],
      red: [...SKYBRIDGE_SPAWNS.red, ...OUTER_SPAWNS.skybridge.red],
      blue: [...SKYBRIDGE_SPAWNS.blue, ...OUTER_SPAWNS.skybridge.blue],
    },
    accentColor: "#06b6d4",
    theme: {
      floor: 0x1e2935, floorPattern: 0x0f1722, wall: 0x0f1722, cover: 0x334155, coverAccent: 0x06b6d4,
      stair: 0x475569, platform: 0x1e2935, sky: "#070a10", fog: "#070a10", fogNear: 35, fogFar: 110,
      ambient: 0.9, gridColor: 0x334155,
    },
    lights: [
      { pos: [0, 8, 0], color: 0x06b6d4, intensity: 1.6, distance: 20 }, // cyan light at central tower
      { pos: [-22, 11, -22], color: 0x38bdf8, intensity: 1.4, distance: 14 }, // tower-top lights
      { pos: [22, 11, -22], color: 0x38bdf8, intensity: 1.4, distance: 14 },
      { pos: [-22, 11, 22], color: 0x38bdf8, intensity: 1.4, distance: 14 },
      { pos: [22, 11, 22], color: 0x38bdf8, intensity: 1.4, distance: 14 },
    ],
  },
  bunker: {
    id: "bunker",
    environment: ENVIRONMENTS.bunker,
    name: MAP_BLUEPRINTS.maps.bunker.name,
    shortName: MAP_BLUEPRINTS.maps.bunker.shortName,
    description: MAP_BLUEPRINTS.maps.bunker.description,
    size: 60,
    wallHeight: 9,
    cover: [...BUNKER_COVER, ...TACTICAL_COVER.bunker],
    spawns: {
      ffa: [...BUNKER_SPAWNS.ffa, ...OUTER_SPAWNS.bunker.ffa],
      red: [...BUNKER_SPAWNS.red, ...OUTER_SPAWNS.bunker.red],
      blue: [...BUNKER_SPAWNS.blue, ...OUTER_SPAWNS.bunker.blue],
    },
    accentColor: "#ef4444",
    theme: {
      floor: 0x2a2020, floorPattern: 0x1a1414, wall: 0x1a1414, cover: 0x3b2c2c, coverAccent: 0xef4444,
      stair: 0x4a3838, platform: 0x2f2020, sky: "#0d0808", fog: "#0d0808", fogNear: 30, fogFar: 90,
      ambient: 1.1, gridColor: 0x4a3030,
    },
    lights: [
      { pos: [0, 6, 0], color: 0xef4444, intensity: 1.8, distance: 16 }, // red light over central bunker
      { pos: [-22, 5, 0], color: 0xff6464, intensity: 1.3, distance: 12 }, // perimeter accent lights
      { pos: [22, 5, 0], color: 0xff6464, intensity: 1.3, distance: 12 },
      { pos: [0, 5, -22], color: 0xff6464, intensity: 1.3, distance: 12 },
      { pos: [0, 5, 22], color: 0xff6464, intensity: 1.3, distance: 12 },
    ],
  },
  shipyard: {
    id: "shipyard",
    environment: ENVIRONMENTS.shipyard,
    name: MAP_BLUEPRINTS.maps.shipyard.name,
    shortName: MAP_BLUEPRINTS.maps.shipyard.shortName,
    description: MAP_BLUEPRINTS.maps.shipyard.description,
    size: 62,
    wallHeight: 11,
    cover: [...SHIPYARD_COVER, ...TACTICAL_COVER.shipyard],
    spawns: {
      ffa: [...SHIPYARD_SPAWNS.ffa, ...OUTER_SPAWNS.shipyard.ffa],
      red: [...SHIPYARD_SPAWNS.red, ...OUTER_SPAWNS.shipyard.red],
      blue: [...SHIPYARD_SPAWNS.blue, ...OUTER_SPAWNS.shipyard.blue],
    },
    accentColor: "#ff8c1a",
    theme: {
      floor: 0x1c2128, floorPattern: 0x10141a, wall: 0x14181f, cover: 0x3a3026, coverAccent: 0xff8c1a,
      stair: 0x4a3a28, platform: 0x2a2418, sky: "#0a0d12", fog: "#0a0d12", fogNear: 28, fogFar: 95,
      ambient: 0.95, gridColor: 0x3a3026,
    },
    lights: SHIPYARD_LIGHTS,
  },
  terminal: {
    id: "terminal",
    environment: ENVIRONMENTS.terminal,
    name: MAP_BLUEPRINTS.maps.terminal.name,
    shortName: MAP_BLUEPRINTS.maps.terminal.shortName,
    description: MAP_BLUEPRINTS.maps.terminal.description,
    size: 64,
    wallHeight: 12,
    cover: [...TERMINAL_COVER, ...TACTICAL_COVER.terminal],
    spawns: {
      ffa: [...TERMINAL_SPAWNS.ffa, ...OUTER_SPAWNS.terminal.ffa],
      red: [...TERMINAL_SPAWNS.red, ...OUTER_SPAWNS.terminal.red],
      blue: [...TERMINAL_SPAWNS.blue, ...OUTER_SPAWNS.terminal.blue],
    },
    accentColor: "#38bdf8",
    theme: {
      floor: 0x2c3036, floorPattern: 0x1e2228, wall: 0x1c2026, cover: 0x3c424c, coverAccent: 0x38bdf8,
      stair: 0x4a525c, platform: 0x30363c, sky: "#0c1014", fog: "#0c1014", fogNear: 38, fogFar: 115,
      ambient: 1.05, gridColor: 0x3c424c,
    },
    lights: TERMINAL_LIGHTS,
  },
  arena_neon: {
    id: "arena_neon",
    environment: ENVIRONMENTS.arena_neon,
    name: MAP_BLUEPRINTS.maps.arena_neon.name,
    shortName: MAP_BLUEPRINTS.maps.arena_neon.shortName,
    description: MAP_BLUEPRINTS.maps.arena_neon.description,
    size: 64,
    wallHeight: 14,
    cover: [...ARENA_NEON_COVER, ...TACTICAL_COVER.arena_neon],
    spawns: {
      ffa: [...ARENA_NEON_SPAWNS.ffa, ...OUTER_SPAWNS.arena_neon.ffa],
      red: [...ARENA_NEON_SPAWNS.red, ...OUTER_SPAWNS.arena_neon.red],
      blue: [...ARENA_NEON_SPAWNS.blue, ...OUTER_SPAWNS.arena_neon.blue],
    },
    accentColor: "#ff2d95",
    theme: {
      floor: 0x1a0a2e, floorPattern: 0x0f0518, wall: 0x120829, cover: 0x2a1147, coverAccent: 0xff2d95,
      stair: 0x4a2070, platform: 0x1f0d3a, sky: "#0a0014", fog: "#0a0014", fogNear: 45, fogFar: 150,
      ambient: 1.0, gridColor: 0x4a2070,
    },
    lights: ARENA_NEON_LIGHTS,
  },
};

/** Expose fully scaled layouts consistently to solo and multiplayer clients. */
export const MAPS: Record<string, MapDef> = {
  whiteout_depot: applyMapFootprint(BASE_MAPS.whiteout_depot),
  orbital_nexus: applyMapFootprint(BASE_MAPS.orbital_nexus),
  forest_warfare: applyMapFootprint(BASE_MAPS.forest_warfare),
  compound: applyMapFootprint(BASE_MAPS.compound),
  skybridge: applyMapFootprint(BASE_MAPS.skybridge),
  bunker: applyMapFootprint(BASE_MAPS.bunker),
  shipyard: applyMapFootprint(BASE_MAPS.shipyard),
  emberhold: applyMapFootprint(BASE_MAPS.emberhold),
  terminal: applyMapFootprint({
    ...BASE_MAPS.arena_neon,
    id:"terminal",name:BASE_MAPS.terminal.name,shortName:BASE_MAPS.terminal.shortName,
    description:BASE_MAPS.terminal.description,theme:BASE_MAPS.terminal.theme,
    accentColor:BASE_MAPS.terminal.accentColor,
    lights:BASE_MAPS.terminal.lights,environment:[],
  }),
  arena_neon: applyMapFootprint(BASE_MAPS.arena_neon),
  floodgate: applyMapFootprint(BASE_MAPS.floodgate),
};
// Any additional JSON blueprint becomes a selectable map automatically. The
// template chooses a tested 3D theme/core; the new blueprint owns its regions,
// battle spaces, geometry and spawns. Rebuild/restart to publish editor exports.
for (const [id, blueprint] of Object.entries(MAP_BLUEPRINTS.maps)) {
  if (id in MAPS) continue;
  const template = blueprint.templateMapId && blueprint.templateMapId in BASE_MAPS
    ? blueprint.templateMapId as MapId : "compound";
  MAPS[id] = applyMapFootprint({...BASE_MAPS[template], id:id as MapId});
}

export const MAP_LIST: MapDef[] = Object.values(MAPS);
export const CTF_MAP_IDS: readonly MapId[] = MAP_LIST.filter(m=>supportsMapMode(m,"ctf")).map(m=>m.id).sort((a,b)=>{
  const priority=["forest_warfare","orbital_nexus","floodgate","compound","skybridge","whiteout_depot"];
  const rank=(id:string)=>{const i=priority.indexOf(id);return i<0?priority.length:i;};
  return rank(a)-rank(b);
});
export const mapAllowedForMode = (mode: GameMode, id: MapId | string): boolean =>
  !!MAPS[id] && supportsMapMode(MAPS[id],mode);

/** Resolve the map and room-size together. Switching to a mode without support
 * for the selected map must not send the old map's team size to the server. */
export function resolveRoomSelection(mode: GameMode, mapId: MapId, teamSize: TeamSize): { mapId: MapId; teamSize: TeamSize } {
  const effectiveMapId: MapId = mapAllowedForMode(mode, mapId)
    ? mapId : mode === "ctf" ? "forest_warfare" : "compound";
  return {
    mapId: effectiveMapId,
    // Direct/invalid room selections reset to the effective map recommendation.
    // The menu separately preserves the nearest legal size on a mode-only switch.
    teamSize: teamSizeAllowed(effectiveMapId, teamSize, mode)
      ? teamSize : recommendedTeamSize(effectiveMapId, mode),
  };
}

export function mapForMode(map:MapDef,mode?:GameMode):MapDef {
  const pools=mode?map.modeSpawns?.[mode]:undefined;
  return pools?{...map,spawns:{...map.spawns,red:pools.red,blue:pools.blue}}:map;
}

export function getMap(id: MapId | string | undefined, mode?: GameMode): MapDef {
  const map = id && id in MAPS ? MAPS[id as MapId] : MAPS.compound;
  return mapForMode(map,mode);
}

/** Client-side, offline-only compilation for unsaved Map Studio drafts.
 * Never modifies MAPS or the server map catalog and cannot affect matchmaking. */
export function compileMapStudioDraft(mapId:string,blueprint:MapBlueprint,theme:MapVisualTheme,mode?:GameMode):MapDef {
  // Shipped maps can have an old fallback template ID (Orbital used bunker).
  // Their draft must start from the SAME native base as the published map.
  const templateId=(mapId in BASE_MAPS?mapId:(blueprint.templateMapId||mapId)) as MapId;
  const template=BASE_MAPS[templateId]??BASE_MAPS.compound;
  const base=templateId==="terminal"?{
    ...BASE_MAPS.arena_neon,id:"terminal" as MapId,theme:BASE_MAPS.terminal.theme,
    accentColor:BASE_MAPS.terminal.accentColor,lights:BASE_MAPS.terminal.lights,environment:[],
  }:template;
  return mapForMode(applyMapFootprint({...base,id:mapId as MapId},{blueprint,theme}),mode);
}

// Legacy single-map exports (default to compound) for backward compat
// where older code still imports ARENA/COVER/SPAWN_POINTS directly.
export const ARENA = { size: MAPS.compound.size, wallHeight: MAPS.compound.wallHeight, floorY: 0 };
export const COVER: CoverBox[] = MAPS.compound.cover;
export const SPAWN_POINTS = MAPS.compound.spawns;

// ---- Network protocol -------------------------------------------------------
export interface LoadoutWire {
  perkId?: import("./perks").PerkId;
  /** Owned Wonder available only when the Wonder Weapon perk is equipped. */
  wonderWeaponId?: string;
  wonderModuleId?: string;
  wonderSkinId?: string;
  wonderKillEffectId?: string;
  /** Persisted tactical selection; validated against the player's saved loadout. */
  equipmentId?: import("./equipment").EquipmentId;
  weaponId: string;
  // Secondary (sidearm, or an additional primary with Well Prepared) and melee ids — used by the engine to support
  // in-match weapon swapping (keys 1/2/3, or on-screen buttons on mobile).
  secondaryWeaponId?: string;
  meleeWeaponId?: string;
  // Per-weapon skins (mirrors the per-slot attachment model). The primary
  // weapon's skin is `weaponSkinId`; secondary and melee get their own fields
  // so changing a skin on one weapon doesn't affect the others.
  weaponSkinId: string;
  secondaryWeaponSkinId?: string;
  meleeWeaponSkinId?: string;
  playerSkinId: string;
  /** Chosen cosmetics; ignored for combat stats. */
  primaryReticleId?: string;
  secondaryReticleId?: string;
  primaryCharmId?: string;
  secondaryCharmId?: string;
  meleeCharmId?: string;
  nameplateId?: string;
  // Primary-slot attachments. Always present (defaults to all-null on the server).
  attachments: { sight: string | null; barrel: string | null; grip: string | null; magazine: string | null };
  // Secondary-slot attachments (sidearms support attachments just like primaries).
  // Defaults to all-null when not supplied.
  secondaryAttachments?: { sight: string | null; barrel: string | null; grip: string | null; magazine: string | null };
  // Melee-slot attachments. Melee weapons don't take attachments — this is
  // included for forward-compat and defaults to all-null.
  meleeAttachments?: { sight: string | null; barrel: string | null; grip: string | null; magazine: string | null };
}

export interface PlayerNet {
  id: string;
  name: string;
  team: "red" | "blue" | "ffa";
  isBot: boolean;
  pos: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  alive: boolean;
  weaponId: string;
  weaponSkinId: string;
  playerSkinId: string;
  charmId?: string;
  nameplateId?: string;
  bossMaxHealth?: number;
  eliteMaxHealth?: number;
  kills: number;
  deaths: number;
  lastShotAt: number;
  // Spawn protection: timestamp (ms) until which this player cannot be damaged.
  // Set on initial spawn + each respawn so players have a brief grace period to
  // orient themselves before bots start shooting. 0 = no protection active.
  riotShieldHp?: number;
  riotShieldRaised?: boolean;
  /** Authoritative epoch-ms time of a broken Bulwark shield rebuild (0 if active). */
  riotShieldReadyAt?: number;
  spawnProtectedUntil?: number;
}

// ---- Client -> Server events ----
export type C2S =
  | { t: "joinMatch"; playerKey: string; name: string; mode: GameMode; botCount: number; loadout: LoadoutWire; team?: "red" | "blue"; mapId?: MapId }
  | { t: "leaveMatch" }
  | { t: "state"; pos: Vec3; yaw: number; pitch: number; aiming: boolean; firing: boolean; reloading: boolean; alive: boolean; sprinting?: boolean }
  | { t: "shot"; origin: Vec3; dir: Vec3; weaponId: string; skinId: string; aiming?: boolean }   // server-side raycast; shotgun ADS is sampled at fire-time
  | { t: "reload" }
  | { t: "deployTurret" } // a placed device, not a bullet ray / ordinary shot
  | { t: "recoverBolt"; boltId: string }
  | { t: "quickMelee" }
  | { t: "collectScavenger"; id: string }
  | { t: "useEquipment" } // intent only; server validates the item, aim and stock
  | { t: "chooseSurvivalUpgrade"; upgradeId: SurvivalUpgradeId }
  | { t: "rerollSurvivalUpgrade" }
  | { t: "setSurvivalPause"; paused: boolean }
  | { t: "chat"; text: string }
  | { t: "weaponSwap"; slot: "primary" | "secondary" | "melee" | "wonder" }   // player changed weapon slot
  | { t: "queueLoadout"; loadout: LoadoutWire }  // validated by server; equips on next respawn
  // ---- Room lobby system ----
  | { t: "listRooms" }
  | { t: "createRoom"; playerKey: string; name: string; loadout: LoadoutWire; config: CreateRoomConfig }
  | { t: "joinRoom"; playerKey: string; name: string; loadout: LoadoutWire; roomId: string; password: string | null; team?: "red" | "blue" | "auto" }
  | { t: "startMatch" }   // host-only: transitions a lobby room to playing
  | { t: "leaveRoom" };

// ---- Server -> Client events ----
// Kill Confirmed dogtags are created on every death and expire after 25s.
// Pickups are authoritative on the server; offline play uses the same rules.
export const KC_TAG_LIFETIME_MS = 25000;
export const KC_PICKUP_RADIUS = 2.25;
/** Match points for a pickup; an unscored denial still prevents the opponent scoring. */
export function killConfirmedPickupPoints(action: "confirm" | "deny", denialScoreEnabled: boolean): 0 | 1 {
  return action === "confirm" || denialScoreEnabled ? 1 : 0;
}
export interface KillConfirmedTag {
  id: string;
  victimId: string;
  victimTeam: "red" | "blue";
  pos: Vec3;
  expiresAt: number;
}

export interface KillFeedEntry {
  killer: string; victim: string; weapon: string; headshot: boolean; killerTeam: string; victimTeam: string;
  botDifficulty?: KillDifficulty;
  attachments?: string[];
}

export interface SnapshotPlayer {
  id: string; name: string; team: string; isBot: boolean;
  pos: Vec3; yaw: number; pitch: number; health: number; alive: boolean;
  weaponId: string; weaponSkinId: string; playerSkinId: string;
  charmId?: string; nameplateId?: string;
  /** Optional Survival boss HUD/armor metadata sent by the server. */
  bossMaxHealth?: number;
  eliteMaxHealth?: number;
  bossCharge?: number;
  downed?: boolean;
  kills: number; deaths: number; aiming: boolean; reloading: boolean;
  perkId?: import("./perks").PerkId;
  // Round 19e: Spawn protection timestamp (ms, Date.now()) — client shows a
  // shield aura while this is in the future. 0/undefined = no protection.
  riotShieldHp?: number;
  riotShieldRaised?: boolean;
  /** Authoritative epoch-ms time of a broken Bulwark shield rebuild (0 if active). */
  riotShieldReadyAt?: number;
  spawnProtectedUntil?: number;
}

export interface LobbyPlayer {
  id: string; name: string; team: string; isBot: boolean; isHost: boolean;
}

export interface MaterialCoverImpact {
  coverId: string;
  material: import("./cover-penetration").BallisticMaterial;
  point: Vec3;
  /** Remaining integrity on breakable materials; null on permanent sheet metal. */
  hp: number | null;
  destroyed: boolean;
}

export type S2C =
  | { t: "materialCoverImpact"; impact: MaterialCoverImpact }
  | { t: "clusterVolley"; volley: ClusterVolley; serverNow: number }
  | { t: "gravityWell"; id: string; ownerId: string; ownerTeam: string; pos: Vec3; radius: number; activatesAt: number; expiresAt: number; serverNow?: number }
  | { t: "gravityDetonate"; id: string; pos: Vec3; radius?: number }
  | { t: "turretPlaced"; id: string; ownerId: string; pos: Vec3; yaw: number; expiresAt: number }
  | { t: "turretRejected"; reason: string }
  | { t: "turretFired"; id: string; target: Vec3 }
  | { t: "turretRemoved"; id: string }
  | { t: "survivalDowned"; playerId: string; weaponId: string; selfReviveUntil?: number }
  | { t: "survivalReviveExpired"; playerId: string }
  | { t: "survivalRecovered"; playerId: string; pos: Vec3; health: number }
  | { t: "survivalUpgradeOffer"; offer: SurvivalUpgradeOffer; ranks: SurvivalUpgradeRanks }
  | { t: "survivalUpgradeChosen"; upgradeId: SurvivalUpgradeId; ranks: SurvivalUpgradeRanks }
  | { t: "deathBomb"; id: string; ownerId: string; pos: Vec3; explodesAt: number }
  | { t: "deathBombExplode"; id: string; pos: Vec3 }
  | { t: "scavengerDrop"; id: string; pos: Vec3; expiresAt: number }
  | { t: "scavengerRemove"; id: string }
  | { t: "scavengerCollected"; id: string }
  | { t: "equipmentFx"; equipmentId: import("./equipment").EquipmentId; position: Vec3; ownerId: string; mineId?: string; mineState?: "placed" | "triggered"; path?: Vec3[]; pathTimesMs?: number[]; flightMs?: number }
  | { t: "equipmentStatus"; effect: "flash" | "taser"; durationMs: number; visualDurationMs?: number }
  | { t: "equipmentStatusFx"; effect: "flash" | "taser"; victimId: string; durationMs: number }
  | { t: "equipmentState"; remaining: number; nextRechargeMs?: number }
  | { t: "equipmentRejected"; reason: string }
  | { t: "deployedCoverPlaced"; cover: import("./deployable-cover").DeployedCover }
  | { t: "deployedCoverDamaged"; id: string; hp: number }
  | { t: "deployedCoverRemoved"; id: string }
  | { t: "equipmentMineRemoved"; mineId: string }
  | { t: "joined"; matchId: string; selfId: string; mode: GameMode; team: string; config: MatchConfig; mapId: MapId; players: SnapshotPlayer[] }
  | { t: "snapshot"; survivalPaused?: boolean; survivalUpgradePendingCount?: number; survivalUpgradeSecondsLeft?: number; deployedCovers?: import("./deployable-cover").DeployedCover[]; clusterVolleys?: ClusterVolley[]; poisoned?: { id: string; expiresAt: number }[]; burning?: { id: string; expiresAt: number }[]; wonderFields?: { id: string; ownerId: string; ownerTeam: string; weaponId: string; kind: "flame" | "sludge"; pos: Vec3; radius: number; expiresAt: number }[]; stormMines?: { id: string; pos: Vec3; expiresAt: number }[]; serverNow?: number; environmentTime?: number; environmentWalls?: Record<string, number>; materialCoverDestroyed?: string[]; materialCoverHp?: Record<string, number>; floodgateRulesVersion?: number; floodgateBreachAt?: number|null; turrets?: { id: string; ownerId: string; pos: Vec3; yaw: number; expiresAt: number }[]; gravityWells?: { id: string; ownerId: string; ownerTeam: string; pos: Vec3; radius: number; activatesAt: number; expiresAt: number }[]; scavengerDrops?: { id: string; pos: Vec3; expiresAt: number }[]; players: SnapshotPlayer[]; scores: Record<string, number>; teamScores: { red: number; blue: number }; timeLeft: number; elapsedSeconds?: number; wave?: number; enemiesLeft?: number; reinforcements?: number; prepLeft?: number; survivalPlayerRanks?: Record<string, SurvivalUpgradeRanks>; preMatchCountdown?: number; gungameWeapons?: string[]; tags?: KillConfirmedTag[]; tagStats?: Record<string, { confirmations: number; denials: number }>; ctfFlags?: CtfFlags; ctfOvertime?: boolean; ctfBases?: {red:Vec3;blue:Vec3}; ctfRulesVersion?: number; orbitalCharge?: number; orbitalHolders?: string[]; orbitalRulesVersion?: number }
  | { t: "hit"; attackerId: string; victimId: string; damage: number; headshot: boolean; killed: boolean; weaponId: string; botDifficulty?: KillDifficulty; defendedFlag?: boolean }
  | { t: "shieldBashPush"; victimId: string; pos: Vec3 }
  | { t: "kill"; entry: KillFeedEntry; botDifficulty?: KillDifficulty }
  | { t: "orbitalReactor"; charge: number }
  | { t: "orbitalAbsorb"; pos: Vec3 }
  | { t: "orbitalReward"; playerId: string; active: boolean }
  | { t: "orbitalPulse"; playerId: string; pos: Vec3 }
  | { t: "ctfEvent"; action: "pickup" | "return" | "capture" | "drop" | "auto_return"; flag: "red" | "blue"; playerId: string }
  | { t: "tagCollected"; tagId: string; collectorId: string; action: "confirm" | "deny" }
  | { t: "respawn"; playerId: string; pos: Vec3; health: number }
  | { t: "loadoutQueued"; loadout: LoadoutWire } // authoritative validated pending loadout
  | { t: "radarPing"; attackerId: string; pos: Vec3; expiresAt: number; durationMs?: number }
  | { t: "protectionEnded"; playerId: string }
  | { t: "knifeAmmo"; charges: number; rechargeMs: number }
  | { t: "shotFx"; origin: Vec3; dir: Vec3; weaponId: string; attackerId: string; skinId: string; suppressed: boolean; coverPower?: number; traceStop?: number }
  | { t: "matchEnd"; standings: { id: string; name: string; team: string; kills: number; deaths: number; score: number; assists?: number; isBot: boolean }[]; winnerTeam: string | null; teamScores?: { red: number; blue: number } }
  | { t: "chat"; name: string; text: string; team: string }
  | { t: "error"; message: string }
  | { t: "reloadFx"; playerId: string }
  | { t: "boltDrop"; id: string; ownerId: string; pos: Vec3; expiresAt: number }
  | { t: "boltRemoved"; id: string }
  | { t: "boltRecovered"; id: string; ownerId: string }
  | { t: "arcFx"; from: Vec3; to: Vec3 }
  | { t: "wonderBeam"; from: Vec3; to: Vec3; kind: "smart" | "storm" }
  | { t: "stormMinePlaced"; id: string; pos: Vec3; expiresAt: number }
  | { t: "stormMineRemoved"; id: string; pos: Vec3; triggered: boolean }
  | { t: "wonderField"; id: string; ownerId: string; ownerTeam: string; weaponId: string; kind: "flame" | "sludge"; pos: Vec3; radius: number; expiresAt: number }
  // ---- Room lobby system ----
  | { t: "roomList"; rooms: RoomSummary[] }
  | { t: "roomJoined"; matchId: string; selfId: string; mode: GameMode; team: string; config: MatchConfig; mapId: MapId; players: SnapshotPlayer[]; roomName: string; state?: "lobby" | "playing"; isHost?: boolean }
  | { t: "roomError"; message: string }
  | { t: "lobbySnapshot"; players: SnapshotPlayer[]; hostSocketId: string; state: "lobby" | "playing" }
  | { t: "matchStarted"; config: MatchConfig; gungameWeapons?: string[] }   // fired when the host starts the match
  // ---- Gun Game progression ----
  // Sent on each kill in gungame mode so clients can update the per-player
  // tier indicator (current weapon index + the resolved weaponId).
  | { t: "gungameProgress"; playerId: string; weaponIndex: number; weaponId: string };

export interface MatchConfig {
  mode: GameMode;
  botCount: number;
  scoreLimit: number;     // kills to win (per player in FFA, per team in TDM). 0 = endless (survival)
  timeLimit: number;      // seconds. 0 = no time limit (survival)
  friendlyFire: boolean;
  tagLifetimeMs: number;   // Kill Confirmed tag lifetime
  ctfFlagResetMs: number; // CTF dropped flag return timer
  denialScoreEnabled: boolean; // friendly tag recoveries earn a point when true
  survivalTier?: SurvivalTier;
}

export const DEFAULT_CONFIG = (mode: GameMode, botCount: number): MatchConfig => ({
  mode,
  botCount,
  scoreLimit: mode === "ctf" ? 3 : mode === "ffa" ? 30 : mode === "tdm" ? 60 : mode === "killconfirmed" ? 40 : 0,
  timeLimit: mode === "survival" || mode === "gungame" ? 0 : mode === "ctf" || mode === "killconfirmed" ? 600 : 360,
  friendlyFire: false,
  tagLifetimeMs: KC_TAG_LIFETIME_MS,
  ctfFlagResetMs: 30000,
  denialScoreEnabled: false,
  survivalTier: mode === "survival" ? "default" : undefined,
});

// ---- Gun Game weapon progression ----
// NEW DESIGN: The progression is now TYPE-based (weapon categories), not a
// fixed list of specific weapon IDs. The STRUCTURE is always the same:
//   pistol / pdw → smg → shotgun → assault → dmr → sniper → lmg → launcher → melee
// But the SPECIFIC weapon in each slot is randomly chosen from the catalog when
// a match starts. So even when a slot calls for "sniper", each match might
// have a different sniper there. Only ONE melee slot exists — always the last
// tier of each cycle (the last cycle's final kill wins the match).
//
// This replaces the old GUN_GAME_PROGRESSION (which was a fixed list of 18
// weapon IDs). The old list is kept as GUN_GAME_TYPE_PROGRESSION_FALLBACK for
// backward compat / offline mode where the engine still reads a flat list.
// 30 unique stages per cycle: 28 different firearms, then a random regular
// launcher and a random standard melee weapon. Presets prioritize their preferred range, but
// automatically fill from other weapon categories when too few unique weapons
// exist; they never repeat the same gun just to satisfy a category count.
export const GUN_GAME_TYPE_PROGRESSION: string[] = [
  "pistol",
  "smg",
  "shotgun",
  "assault",
  "pdw",
  "smg",
  "shotgun",
  "assault",
  "dmr",
  "smg",
  "pistol",
  "assault",
  "dmr",
  "shotgun",
  "assault",
  "sniper",
  "dmr",
  "lmg",
  "pdw",
  "assault",
  "dmr",
  "sniper",
  "lmg",
  "pistol",
  "assault",
  "dmr",
  "sniper",
  "lmg",
  "launcher",
  "melee"
];

// Offline/back-compat fallback is equally unique; dynamic rounds randomize both finishers.
export const GUN_GAME_PROGRESSION: string[] = [
  "pistol_arc",
  "smg_kp",
  "shotgun_br",
  "rifle_electron",
  "pistol_side",
  "smg_vector",
  "shotgun_auto",
  "rifle_falcon",
  "crossbow_reclaimer",
  "smg_compact",
  "pistol_magnum",
  "rifle_hydra",
  "dmr_cyclone",
  "shotgun_combat",
  "rifle_ar",
  "sniper_lr",
  "dmr_whisper",
  "lmg_hv",
  "pistol_burst",
  "rifle_burst",
  "rifle_dm",
  "sniper_scout",
  "lmg_light",
  "pistol_machine",
  "rifle_heavy",
  "dmr_scout",
  "sniper_heavy",
  "lmg_heavy",
  "launcher_rocket",
  "knife_tactical"
];
export const GUN_GAME_TYPE_PROGRESSION_FALLBACK: string[] = GUN_GAME_PROGRESSION;

// ---- Survival wave configuration ----
// Endless mode: each wave spawns more / tougher bots. No kill limit, no time limit.
export const SURVIVAL_PREP_SEC = 5;       // maximum inter-wave prep (scales from 2s to 5s by wave 10)
export const SURVIVAL_RESPAWN_MS = 5000;  // respawn delay after death (shared reinforcement pool)
export function survivalWaveBotCount(wave: number): number {
  // wave 1 → 3 bots, +1 per wave, capped at 12
  return Math.min(12, 2 + wave);
}
export function survivalWaveHealthMul(wave: number): number {
  // +12% health per wave (bots become meatier)
  return 1 + (wave - 1) * 0.12;
}
export function survivalWaveDamageMul(wave: number): number {
  // +6% damage per wave (bots hit harder)
  return 1 + (wave - 1) * 0.06;
}

// ---- Hit detection helpers (shared by server & client for offline) ----
// Ray vs axis-aligned box (slab method). Returns t or null.
export function rayBox(origin: Vec3, dir: Vec3, boxCenter: Vec3, boxHalf: Vec3): number | null {
  const min = [boxCenter[0] - boxHalf[0], boxCenter[1] - boxHalf[1], boxCenter[2] - boxHalf[2]];
  const max = [boxCenter[0] + boxHalf[0], boxCenter[1] + boxHalf[1], boxCenter[2] + boxHalf[2]];
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
    } else {
      const t1 = (min[i] - origin[i]) / dir[i];
      const t2 = (max[i] - origin[i]) / dir[i];
      const tn = Math.min(t1, t2), tf = Math.max(t1, t2);
      tmin = Math.max(tmin, tn);
      tmax = Math.min(tmax, tf);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? 0 : null);
}

// Ray vs vertical capsule (cylinder) approximated as AABB for hit detection simplicity,
// but treat as a player capsule of given radius & height. Returns t or null and whether headshot.
export function rayCapsule(origin: Vec3, dir: Vec3, center: Vec3, radius: number, height: number): { t: number; head: boolean } | null {
  const top: Vec3 = [center[0], center[1] + height - 0.4, center[2]];
  const bot: Vec3 = [center[0], center[1] + 0.4, center[2]];
  // Check head box (small) and body box (taller)
  const headHalf: Vec3 = [radius * 0.9, 0.2, radius * 0.9];
  const bodyHalf: Vec3 = [radius, (height - 0.4) / 2, radius];
  const bodyC: Vec3 = [center[0], (bot[1] + top[1]) / 2, center[2]];
  const tHead = rayBox(origin, dir, top, headHalf);
  const tBody = rayBox(origin, dir, bodyC, bodyHalf);
  const candidates: { t: number; head: boolean }[] = [];
  if (tHead !== null) candidates.push({ t: tHead, head: true });
  if (tBody !== null) candidates.push({ t: tBody, head: false });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0];
}

export const PLAYER_RADIUS = 0.45;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.6;
