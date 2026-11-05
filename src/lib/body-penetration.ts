/**
 * Shared hitscan body-penetration policy for the offline engine and online server.
 * Only player bodies may be penetrated: map cover and riot shields always stop a shot.
 * A protected (spawn-immune) body also absorbs the ray to prevent shooting through
 * spawn protection. All candidates are for one actual ray, not a target-radius check.
 */
export interface BodyPenetration {
  /** Total bodies a single bullet can hit, including the first. */
  maxTargets: number;
  /** Damage retained at each subsequent body (0..1). */
  damageRetention: number;
}

export interface BodyRayContact<T> {
  target: T;
  t: number;
  head: boolean;
  shield?: boolean;
  protected?: boolean;
}

export interface PenetratingBodyHit<T> extends BodyRayContact<T> {
  damageScale: number;
}

/** Order real intersections along a ray, stopping at cover, shields and immunity. */
export function selectBodyPenetrationHits<T>(
  contacts: readonly BodyRayContact<T>[],
  maxDistance: number,
  coverDistance: number,
  profile?: BodyPenetration,
): PenetratingBodyHit<T>[] {
  const limit = Math.max(1, Math.min(3, Math.floor(profile?.maxTargets ?? 1)));
  const retention = Math.max(0, Math.min(1, profile?.damageRetention ?? 0));
  const ordered = contacts
    .filter(hit => Number.isFinite(hit.t) && hit.t >= 0
      && hit.t <= maxDistance && hit.t < coverDistance)
    .sort((a, b) => a.t - b.t);
  const result: PenetratingBodyHit<T>[] = [];
  for (const hit of ordered) {
    if (result.length >= limit) break;
    result.push({ ...hit, damageScale: Math.pow(retention, result.length) });
    if (hit.shield || hit.protected) break;
  }
  return result;
}
