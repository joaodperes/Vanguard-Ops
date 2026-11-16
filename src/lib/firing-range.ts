import { getMap, type CoverBox, type MapDef, type Vec3 } from "./game-protocol";

/** Private, client-only range. Never appears in matchmaking or public map listings. */
export const RANGE_TARGETS: readonly Vec3[] = [
  [-5.5, 0, -10],
  [-2, 0, 1],
  [2, 0, 13],
  [5.5, 0, 25],
];

export const RANGE_SPAWN: Vec3 = [0, 0, -32];

/** Two side corridors are accessible through 6-unit openings in the central
 * lane walls, just beyond the player's spawn. Station colliders occupy only
 * the outer lanes: the original target practice stays unobstructed.
 */
export const RANGE_MATERIAL_ENTRANCE_Z = -27;
export const RANGE_MATERIAL_SHOOT_Z = -18;

export interface RangeMaterialStation {
  id: string;
  label: string;
  behavior: string;
  material: NonNullable<CoverBox["material"]>;
  x: number;
  /** Full panel thickness; independent of the visual material. */
  thickness: number;
  target: Vec3;
}

export const RANGE_MATERIAL_STATIONS: readonly RangeMaterialStation[] = [
  { id:"glass",label:"GLASS",behavior:"CRACKS / SHATTERS",
    material:"glass",x:-21,thickness:.36,target:[-21,0,15] },
  { id:"wood",label:"THIN WOOD",behavior:"SPLINTERS / BREAKS",
    material:"thin_wood",x:-33,thickness:.8,target:[-33,0,15] },
  { id:"light",label:"LIGHT COVER",behavior:"CHIPS / BREAKS",
    material:"light_cover",x:17,thickness:1,target:[17,0,15] },
  { id:"metal",label:"SHEET METAL",behavior:"SPARKS / HOLDS",
    material:"sheet_metal",x:27,thickness:.6,target:[27,0,15] },
  { id:"concrete",label:"CONCRETE",behavior:"BULLETPROOF CONTROL",
    material:"concrete",x:37,thickness:1.2,target:[37,0,15] },
] as const;

/** Half extents are important: the cover resolver measures the actual
 * thickness crossed, not merely a surface's material identifier.
 * Panels are chest-high so dummies' heads remain visible for aiming.
 */
export const RANGE_MATERIAL_PANELS: readonly CoverBox[] = RANGE_MATERIAL_STATIONS.map(station => ({
  pos:[station.x,.875,0] as Vec3,
  size:[2.35,.875,station.thickness/2] as Vec3,
  kind:"cover" as const,
  material:station.material,
  ballisticId:station.material==="concrete" ? undefined : "range_material_"+station.id,
}));

/** Split each separating wall at the same entrance. No wall collider spans
 * the 6-unit doorway, so the firing lanes can be reached on foot.
 */
export const RANGE_SIDE_WALLS: readonly CoverBox[] = [-12,12].flatMap(x => [
  {pos:[x,2.5,-33] as Vec3,size:[.65,2.5,3] as Vec3,kind:"solid" as const},
  {pos:[x,2.5,6] as Vec3,size:[.65,2.5,30] as Vec3,kind:"solid" as const},
]);


/** Extra, moving humanoid dummies for tracking practice. All three travel
 * inside the open, walled firing lane; only the x coordinate changes.
 * speed is actual sideways world-units/second (not animation frequency).
 */
export interface MovingRangeTarget {
  id: string;
  name: string;
  center: Vec3;
  halfTravel: number;
  speed: number;
  phase: number;
}

export const RANGE_MOVING_TARGETS: readonly MovingRangeTarget[] = [
  { id: "near", name: "Short · Slow Strafe", center: [0, 0, -4], halfTravel: 4, speed: 1.4, phase: 0 },
  { id: "mid", name: "Medium · Strafe", center: [0, 0, 8], halfTravel: 5, speed: 2.8, phase: 0.25 },
  { id: "far", name: "Long · Fast Strafe", center: [0, 0, 20], halfTravel: 6.5, speed: 4.5, phase: 0.5 },
];

/** Constant-speed ping-pong along a rail, without snapping at either edge.
 * Pure and deterministic so firing, rendering, and respawns share the same path.
 */
export function movingRangeTargetPosition(target: MovingRangeTarget, elapsedSec: number): Vec3 {
  const half = Math.max(0, target.halfTravel);
  if (half === 0 || target.speed <= 0) return [...target.center];
  const track = 4 * half; // full left -> right -> left loop
  const distance = ((Math.max(0, elapsedSec) * target.speed + target.phase * track) % track + track) % track;
  const x = distance <= 2 * half ? -half + distance : 3 * half - distance;
  return [target.center[0] + x, target.center[1], target.center[2]];
}


export function createFiringRangeMap(): MapDef {
  const base = getMap("compound");
  return {
    ...base,
    name: "Firing Range",
    shortName: "Range",
    description: "Private equipment trial with stationary, strafing and material-penetration targets.",
    size: 42,
    wallHeight: 7,
    // The center lane stays open; accessible side lanes demonstrate material
    // damage, caliber-dependent through-cover hits and permanent hard cover.
    cover: [
      ...RANGE_SIDE_WALLS.map(box=>({...box,pos:[...box.pos] as Vec3,size:[...box.size] as Vec3})),
      ...RANGE_MATERIAL_PANELS.map(box=>({...box,pos:[...box.pos] as Vec3,size:[...box.size] as Vec3})),
      { pos: [0, 3, 35], size: [12, 3, 0.8], kind: "solid" },
    ],
    spawns: { ffa: [[...RANGE_SPAWN]], red: [[...RANGE_SPAWN]], blue: [[...RANGE_SPAWN]] },
    regions: undefined,
    environment: [],
    props: [],
    lights: [
      { pos: [-9, 5, 5], color: 0xffc56c, intensity: 2.2, distance: 65 },
      { pos: [9, 5, 5], color: 0xffc56c, intensity: 2.2, distance: 65 },
    ],
    biome: undefined,
  };
}
