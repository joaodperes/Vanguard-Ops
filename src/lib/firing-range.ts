import { getMap, type MapDef, type Vec3 } from "./game-protocol";

/** Private, client-only range. Never appears in matchmaking or public map listings. */
export const RANGE_TARGETS: readonly Vec3[] = [
  [-5.5, 0, -10],
  [-2, 0, 1],
  [2, 0, 13],
  [5.5, 0, 25],
];

export const RANGE_SPAWN: Vec3 = [0, 0, -32];

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
    description: "Private equipment trial with stationary and strafing, respawning targets.",
    size: 42,
    wallHeight: 7,
    // No obstructing cover between shooting line and practice targets.
    cover: [
      { pos: [-12, 2.5, 0], size: [0.65, 2.5, 36], kind: "solid" },
      { pos: [12, 2.5, 0], size: [0.65, 2.5, 36], kind: "solid" },
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
