import { getMap, type MapDef, type Vec3 } from "./game-protocol";

/** Private, client-only range. Never appears in matchmaking or public map listings. */
export const RANGE_TARGETS: readonly Vec3[] = [
  [-5.5, 0, -10],
  [-2, 0, 1],
  [2, 0, 13],
  [5.5, 0, 25],
] as const;

export const RANGE_SPAWN: Vec3 = [0, 0, -32];

export function createFiringRangeMap(): MapDef {
  const base = getMap("compound");
  return {
    ...base,
    name: "Firing Range",
    shortName: "Range",
    description: "Private equipment trial with stationary, respawning targets.",
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
