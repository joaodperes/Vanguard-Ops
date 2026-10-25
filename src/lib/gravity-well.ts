/** Shared Event Horizon behavior for offline play and server-authoritative matches.
 * All positions are in world units; the pull is horizontal to respect ground collision.
 */
export const GRAVITY_WELL_DURATION_MS = 1050;
/** Convert server-based absolute effect timestamps to local time using the
 * timestamp carried by the event/snapshot, avoiding premature disappearance
 * when the player computer clock differs from the server's clock. */
export function gravityClientTime(serverStamp:number,serverNow:number,clientNow:number):number {
  return serverStamp+(clientNow-serverNow);
}
export const GRAVITY_PULL_SPEED = 43;
export const GRAVITY_WELL_RADIUS = 9.5;

export function gravityTravelMs(distance: number): number {
  return Math.min(280, Math.max(65, distance * 3));
}

/** Pull within the SAME 3D spherical range used by the explosion and visual shell.
 * Only horizontal displacement is applied so terrain physics stays authoritative.
 */
export function gravityPullOffset(
  center: readonly number[], feet: readonly number[], radius: number, dt: number,
): [number, number] {
  const dx = center[0] - feet[0], dz = center[2] - feet[2];
  const horizontal = Math.hypot(dx, dz);
  const vertical = center[1] - (feet[1] + 1);
  const distance = Math.hypot(horizontal, vertical);
  if (horizontal <= 0.5 || distance >= radius) return [0, 0];
  const strength = 0.9 + 1.35 * (1 - distance / radius);
  const step = Math.min(horizontal - 0.5, GRAVITY_PULL_SPEED * strength * Math.max(0, dt));
  return [dx / horizontal * step, dz / horizontal * step];
}

/** Shared floor-safe endpoint. A downward shot must intersect the visible arena
 * before continuing below it. Stops earlier at cover or a combatant when hit.
 * The vortex center rests 1m above the terrain floor, near torso height.
 */
export function gravityImpact(
  origin: readonly number[], dir: readonly number[], hitDistance: number,
  floorCenterY = 1,
): [number, number, number] {
  let travel = Math.max(0, hitDistance);
  if (dir[1] < -1e-6 && origin[1] > floorCenterY) {
    travel = Math.min(travel, (origin[1] - floorCenterY) / -dir[1]);
  }
  return [
    origin[0] + dir[0] * travel,
    Math.max(floorCenterY, origin[1] + dir[1] * travel),
    origin[2] + dir[2] * travel,
  ];
}

export function gravityBlastDamage(distance: number, radius: number, baseDamage: number): number {
  if (distance > radius) return 0;
  const fraction = Math.max(0, distance / radius);
  // Concentrate the blast at the center rather than dealing heavy damage at the outer edge.
  return baseDamage * (0.08 + 1.67 * Math.pow(1 - fraction, 2));
}

/** Event Horizon has generous aim proximity but never locks past a wall.
 * Returns the distance along the projectile ray to the first enemy near
 * the crosshair; the exact world impact is resolved by gravityImpact.
 */
export function gravityTargetDistance(
  origin: readonly number[], direction: readonly number[],
  candidates: readonly (readonly number[])[], maxDistance: number,
  tolerance = 2.25,
): number | null {
  let best: number | null = null;
  const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  const dir = [direction[0] / len, direction[1] / len, direction[2] / len];
  for (const pos of candidates) {
    const vx = pos[0] - origin[0], vy = pos[1] - origin[1], vz = pos[2] - origin[2];
    const forward = vx * dir[0] + vy * dir[1] + vz * dir[2];
    if (forward <= 1 || forward > maxDistance) continue;
    const deviation = Math.hypot(vx - forward * dir[0], vy - forward * dir[1], vz - forward * dir[2]);
    if (deviation > tolerance) continue;
    const landing = Math.max(1, forward - 0.6);
    if (best === null || landing < best) best = landing;
  }
  return best;
}
