// Shared Forest Warfare collision layout and decorative vegetation coordinates.
// The same cover geometry is used by client movement, bots and server raycasts.
import type { CoverBox, Vec3 } from "./game-protocol";
import { CTF_TREE_X, CTF_TREE_TOP } from "./ctf-rules";

export type ForestObject = { kind: "tree" | "bush" | "rock" | "log"; x: number; z: number; w: number; d: number; h: number; sideways?: boolean };
const layout: ForestObject[] = [];
// Deterministic mirrored cover lanes, avoiding the central lane and spawn/tree ladders.
const samples: [number, number, "tree"|"bush"|"rock"|"log"][] = [
  [5,7,"tree"],[11,15,"rock"],[17,4,"bush"],[23,19,"tree"],[29,12,"log"],
  [6,24,"bush"],[15,29,"tree"],[25,30,"rock"],[32,25,"tree"],
  [9,-9,"rock"],[18,-15,"tree"],[25,-8,"bush"],[31,-19,"log"],
  [9,-25,"tree"],[17,-28,"bush"],[27,-30,"tree"],[33,32,"rock"],
  [3,34,"rock"],[37,20,"bush"],[39,-25,"tree"],[13,38,"tree"],
  [30,39,"bush"],[5,-38,"bush"],[23,-40,"rock"]
];
for (const [x,z,kind] of samples) {
  for (const sign of [-1,1]) {
    // Center lane stays passable; two asymmetric-looking but balanced forest halves.
    const w = kind === "tree" ? 1.2 : kind === "bush" ? 1.8 : kind === "rock" ? 2.1 : 3.2;
    const d = kind === "tree" ? 1.2 : kind === "bush" ? 1.6 : kind === "rock" ? 2.3 : 0.85;
    const h = kind === "tree" ? 8 + ((x+z+100)%5) : kind === "bush" ? 1.35 : kind === "rock" ? 1.7 : 1;
    layout.push({ kind, x: sign * x, z, w, d, h, sideways: (x+z)%2===0 });
  }
}
export const FOREST_OBJECTS: readonly ForestObject[] = layout;
export const FOREST_WARFARE_COVER: CoverBox[] = [
  // Root mass on each side; canopy clearing/platform and two climbable stair flights.
  ...([-1,1] as const).flatMap(sign => {
    const x = sign * CTF_TREE_X, result: CoverBox[] = [
      { pos:[x,2.85,0], size:[1.7,2.85,1.7], kind:"solid" },
      { pos:[x,CTF_TREE_TOP-0.23,0], size:[4.5,0.23,4.5], kind:"platform" },
    ];
    for (const direction of [-1,1] as const) {
      // North/south root ramp approaches, 0.49-unit risers (walkable).
      const depth = 11, steps = 13, riser = CTF_TREE_TOP / steps;
      for (let i=0;i<steps;i++) {
        const top = riser*(i+1), sz = direction*(4.55+(steps-i-0.5)*depth/steps);
        result.push({pos:[x,top/2,sz],size:[1.4,top/2+0.005,depth/steps/2+0.008],kind:"stair"});
      }
    }
    return result;
  }),
  ...layout.map(p => ({
    pos: [p.x, p.kind === "tree" ? 2.5 : p.h/2, p.z] as Vec3,
    size: [p.w, p.kind === "tree" ? 2.5 : p.h/2, p.d] as Vec3,
    kind: p.kind === "rock" ? "platform" as const : "cover" as const,
  })),
];
export const FOREST_SPAWNS = {
  red: [[-42,0,-8],[-34,0,-8],[-42,0,-18],[-33,0,-18],[-46,0,-15],[-29,0,-12]] as Vec3[],
  blue: [[42,0,-8],[34,0,-8],[42,0,-18],[33,0,-18],[46,0,-15],[29,0,-12]] as Vec3[],
  ffa: [[-42,0,-8],[42,0,-8],[-25,0,0],[25,0,0]] as Vec3[],
};
