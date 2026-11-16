/** Explonando death charge: placed exactly at the victim's death position,
 * detonates two seconds later, and never damages the owner or teammates.
 */
export const EXPLO_FUSE_MS = 2000;
export const EXPLO_RADIUS = 6.5;
export const EXPLO_DAMAGE = 110;
export function explonandoDamage(distance: number): number {
  if (!Number.isFinite(distance) || distance >= EXPLO_RADIUS) return 0;
  return Math.round(Math.max(10, EXPLO_DAMAGE * (1 - distance / EXPLO_RADIUS)));
}
export function explonandoCanHit(mode: string, victimTeam: string, ownerTeam: string, victimId: string, ownerId: string): boolean {
  return victimId !== ownerId && (mode === "ffa" || mode === "gungame" || victimTeam !== ownerTeam);
}
