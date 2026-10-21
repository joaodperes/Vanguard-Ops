/** Team-aware minimap pings; unrelated to inventory/perks. Coordinates are game world X/Z. */
export const RADAR_NORMAL_RADIUS = 42;
export const RADAR_SUPPRESSED_RADIUS = 15;
export const RADAR_PING_DURATION_MS = 2200;
export const RADAR_RECON_DURATION_MS = 3200;
/** Only changes reveal lifespan, never gunshot detection range. */
export function radarDurationMs(perkId?: string | null): number {
  return perkId === "recon_visor" ? RADAR_RECON_DURATION_MS : RADAR_PING_DURATION_MS;
}

/** Track the CURRENT location of a revealed living target, not the shot location. */
export function trackedRadarPosition<T extends RadarPoint>(now: number, expiresAt: number, target?: (T & { alive: boolean }) | null): T | null {
  return now < expiresAt && target?.alive ? target : null;
}
export type RadarTeam = "red" | "blue" | "ffa" | string;
export type RadarPoint = { x: number; z: number };
export function friendlyOnRadar(mode: string, observerTeam: RadarTeam, targetTeam: RadarTeam) {
  return mode !== "ffa" && mode !== "gungame" && observerTeam !== "ffa" && observerTeam === targetTeam;
}
export function canHearGunshot(observer: RadarPoint, shooter: RadarPoint, suppressed: boolean) {
  if (![observer.x, observer.z, shooter.x, shooter.z].every(Number.isFinite)) return false;
  const radius = suppressed ? RADAR_SUPPRESSED_RADIUS : RADAR_NORMAL_RADIUS;
  return Math.hypot(observer.x - shooter.x, observer.z - shooter.z) <= radius;
}
export function radarExpiresAt(now: number, perkId?: string | null) { return now + radarDurationMs(perkId); }
export function radarToPercent(value: number, halfExtent: number) {
  return Math.max(0, Math.min(100, 50 + 50 * value / Math.max(1, halfExtent)));
}

/** Local fallback for server-validated shotFx messages; never reveal friendly fire.
 * The sender must be a known combatant and the server's shotFx must be trusted. */
export function shouldRevealGunshot(mode: string, observerTeam: RadarTeam, targetTeam: RadarTeam,
  observer: RadarPoint, shooter: RadarPoint, suppressed: boolean): boolean {
  return !friendlyOnRadar(mode, observerTeam, targetTeam) && canHearGunshot(observer, shooter, suppressed);
}
