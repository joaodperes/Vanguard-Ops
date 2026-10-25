/** Bullet Spitter placed Wonder Weapon: fixed ±70° horizontal traverse,
 * but unlimited vertical elevation. Only targets enemies within line of sight.
 */
export const TURRET_ARC_DEG = 140;
/** FFA / Gun Game has no friendly combatants, even when everybody shares
 * the same 'ffa' team label. Survival and team modes use real teams.
 * Centralized so offline and authoritative server targeting cannot diverge.
 */
export function turretCanAttack(mode: string, ownerTeam: string, victimTeam: string, victimIsOwner: boolean): boolean {
  if (victimIsOwner) return false;
  return mode === "ffa" || mode === "gungame" || ownerTeam !== victimTeam;
}

// Center of the visible twin-barrel assembly above the planted feet.
export const TURRET_MUZZLE_HEIGHT = 1.29;
export const TURRET_RANGE = 54; // Matches the Hailstorm LMG's effective range.
export const TURRET_DAMAGE = 34;
export const TURRET_HP = 460;
export const TURRET_INTERVAL_MS = 135;
export const TURRET_LIFETIME_MS = 45000;
export function turretCanTrack(
  turret: readonly number[], forwardYaw: number, target: readonly number[],
  range = TURRET_RANGE,
): boolean {
  const dx = target[0] - turret[0], dz = target[2] - turret[2];
  const dist = Math.hypot(dx,dz);
  if (dist < 0.25 || dist > range) return false;
  const forwardX = Math.sin(forwardYaw), forwardZ = Math.cos(forwardYaw);
  // Horizontal arc only: elevated enemies do not lose tracking eligibility.
  return (dx * forwardX + dz * forwardZ) / dist >= Math.cos(TURRET_ARC_DEG * Math.PI / 360);
}

/** Position a deployed Bullet Spitter ahead of the player, without placing it
 * inside cover. Shares the same horizontal placement for client and server.
 * The caller grounds the resulting X/Z on the map's walkable surface.
 */
export function turretDeployPosition(
  feet: readonly number[], yaw: number,
  cover: ReadonlyArray<{ pos: readonly number[]; size: readonly number[]; kind?: string }>,
  arenaSize?: number,
): [number, number, number] {
  const radius = 0.80;
  // Far enough in front of the player's weapon to show a genuine world prop,
  // then progressively closer when a wall/arena edge obstructs deployment.
  for (const distance of [3.2, 2.7, 2.2, 1.6, 1.05, 0]) {
    const x = feet[0] + Math.sin(yaw) * distance;
    const z = feet[2] + Math.cos(yaw) * distance;
    if (arenaSize !== undefined && (Math.abs(x) > arenaSize - 1 || Math.abs(z) > arenaSize - 1)) continue;
    // Check the entire placement path, not only the endpoint: a turret must
    // never jump THROUGH a wall to an open patch on its far side.
    const obstructed = cover.some(box => {
      if (box.kind === "accent" ||
          feet[1] >= box.pos[1] + box.size[1] - 0.12 ||
          feet[1] + 0.9 <= box.pos[1] - box.size[1]) return false;
      for (let d = Math.min(.2, distance); d <= distance + 0.001; d += .2) {
        const sx = feet[0] + Math.sin(yaw) * Math.min(d, distance);
        const sz = feet[2] + Math.cos(yaw) * Math.min(d, distance);
        if (Math.abs(sx - box.pos[0]) < box.size[0] + radius &&
            Math.abs(sz - box.pos[2]) < box.size[2] + radius) return true;
      }
      return Math.abs(x - box.pos[0]) < box.size[0] + radius &&
        Math.abs(z - box.pos[2]) < box.size[2] + radius;
    });
    if (!obstructed) return [x, feet[1], z];
  }
  return [feet[0], feet[1], feet[2]];
}
