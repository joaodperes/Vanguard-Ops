/**
 * Shared weapon firing cadence used by the offline player simulation and the
 * authoritative multiplayer server. Callers choose the rate and tolerance for
 * their weapon/mode; this module owns the timing math and defensive clamping.
 */
export function weaponFireIntervalMs(fireRate: number, minimumRate = 1): number {
  const safeMinimum = Number.isFinite(minimumRate) ? Math.max(0.01, minimumRate) : 1;
  const safeRate = Number.isFinite(fireRate) ? Math.max(safeMinimum, fireRate) : safeMinimum;
  return 1000 / safeRate;
}

/** Whether a shot may be accepted after the previous shot at the supplied
 * cadence. Tolerance below 1 preserves the existing network/input grace. */
export function weaponShotReady(
  now: number,
  lastShotAt: number,
  intervalMs: number,
  tolerance = 1,
): boolean {
  if (!Number.isFinite(now) || !Number.isFinite(intervalMs) || intervalMs < 0) return false;
  if (lastShotAt === Number.NEGATIVE_INFINITY) return true;
  if (!Number.isFinite(lastShotAt)) return false;
  const safeTolerance = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 1;
  return now - lastShotAt >= intervalMs * safeTolerance;
}
