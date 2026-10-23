/** Shared Event Horizon behavior for offline play and server-authoritative matches.
 * All positions are in world units; the pull is horizontal to respect ground collision.
 */
export const GRAVITY_WELL_DURATION_MS = 2800;
/** Convert server-based absolute effect timestamps to local time using the
 * timestamp carried by the event/snapshot, avoiding premature disappearance
 * when the player computer clock differs from the server's clock. */
export function gravityClientTime(serverStamp:number,serverNow:number,clientNow:number):number {
  return serverStamp+(clientNow-serverNow);
}
export const GRAVITY_PULL_SPEED = 11;
export const GRAVITY_WELL_RADIUS = 14;

export function gravityTravelMs(distance: number): number {
  return Math.min(900, Math.max(160, distance * 9));
}

export function gravityPullOffset(
  center: readonly number[], feet: readonly number[], radius: number, dt: number,
): [number, number] {
  const dx = center[0] - feet[0], dz = center[2] - feet[2];
  const distance = Math.hypot(dx, dz);
  if (distance < 0.6 || distance >= radius || Math.abs(center[1] - feet[1] - 1) > 5) return [0, 0];
  const strength = 0.45 + 0.55 * (1 - distance / radius);
  const step = Math.min(distance - 0.6, GRAVITY_PULL_SPEED * strength * Math.max(0, dt));
  return [dx / distance * step, dz / distance * step];
}

export function gravityBlastDamage(distance: number, radius: number, baseDamage: number): number {
  if (distance > radius) return 0;
  const fraction = Math.max(0, distance / radius);
  return baseDamage * (0.3 + 1.05 * (1 - fraction * fraction));
}
