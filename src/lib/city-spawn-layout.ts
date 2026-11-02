/**
 * Expand Afterlight City's original small-match spawn lists for 32 players.
 * Additional points come from existing spawn districts, so team identity and
 * day/night layout stay consistent. Only the render/physics compiler uses this;
 * neither server nor client ever invents a spawn at match time.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { insideRegions, type MapRegion } from "./map-blueprints";

const STEP_OFFSETS: readonly [number, number][] = [
  [1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],
];

/** Preserve authored choices at the front of the list for compatibility. */
export function expandCitySpawnPositions(
  authored: readonly Vec3[],
  regions: readonly MapRegion[],
  cover: readonly CoverBox[],
  minimum: number,
): Vec3[] {
  const result: Vec3[] = authored.map(p => [...p] as Vec3);
  if (result.length >= minimum || !result.length) return result;
  const candidates: Vec3[] = [];
  const keys = new Set(result.map(p => `${p[0].toFixed(2)}:${p[2].toFixed(2)}`));
  const solids = cover.filter(c => c.kind !== "accent" &&
    c.pos[1] + c.size[1] > .35 && c.pos[1] - c.size[1] < 1.85);

  const safe = (x:number,z:number):boolean =>
    insideRegions(x,z,regions,3.2) &&
    !solids.some(c => Math.abs(x - c.pos[0]) < c.size[0] + 1.3 &&
      Math.abs(z - c.pos[2]) < c.size[2] + 1.3);

  // Scan deterministic rings around each authored spawn rather than creating
  // new team bases in the enemy district.
  for (const radius of [10,18,26,34,42]) for (const origin of authored) {
    for (const [dx,dz] of STEP_OFFSETS) {
      const x = Math.round((origin[0] + dx * radius) * 10) / 10;
      const z = Math.round((origin[2] + dz * radius) * 10) / 10;
      const key = `${x.toFixed(2)}:${z.toFixed(2)}`;
      if (keys.has(key) || !safe(x,z)) continue;
      keys.add(key);
      candidates.push([x,0,z]);
    }
  }

  // Maximize spacing between the extra points, not just from the original
  // spawns, so 16 allied players have distinct safe choices at round start.
  while (result.length < minimum && candidates.length) {
    let best = -1;
    let bestDist = -1;
    for (let i=0;i<candidates.length;i++) {
      const c = candidates[i];
      const dist = Math.min(...result.map(p => Math.hypot(c[0]-p[0],c[2]-p[2])));
      if (dist > bestDist) { best = i; bestDist = dist; }
    }
    if (best < 0 || bestDist < 7.5) break;
    result.push(candidates[best]);
    candidates.splice(best,1);
  }
  return result;
}
