/** Shared grenade simulation for offline play and authoritative multiplayer.
 * Frag and flash grenades ricochet off solid geometry and detonate on a fuse.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import type { ObjectiveSource } from "./map-objectives";
import { clusterGravity } from "./cluster-grenades";
import { bouncingProjectilePath, type TimedProjectilePath } from "./bouncing-projectile";

export const TACTICAL_GRENADE_FUSE_MS = 1700;

/** Spawn at eye height (not beyond close cover) with an upward throw impulse. */
export function tacticalGrenadePath(
  origin: Vec3, direction: Vec3, cover: CoverBox[], mapId: ObjectiveSource = "compound",
): TimedProjectilePath {
  const len = Math.hypot(...direction) || 1;
  const dir = direction.map(v => v / len) as Vec3;
  return bouncingProjectilePath(origin,
    [dir[0] * 21, (dir[1] + .30) * 21, dir[2] * 21], cover,
    { gravity: clusterGravity(mapId), radius: .13, fuseMs: TACTICAL_GRENADE_FUSE_MS,
      restitution: .5, friction: .78 });
}
