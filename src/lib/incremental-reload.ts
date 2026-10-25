/** Shell-fed weapons credit a round at the visible insertion point.
 * Credit is NOT deferred until the entire hand/weapon recovery animation ends.
 * The inserted flag prevents awarding the same shell more than once per cycle.
 */
export const ROUND_INSERT_FRACTION = 0.70;

export function advanceIncrementalReload(
  ammo: number, magSize: number, inserted: boolean,
  startedAt: number, durationMs: number, now: number,
): { ammo: number; inserted: boolean; cycleComplete: boolean; magazineFull: boolean } {
  const capacity = Math.max(0, magSize);
  const shouldInsert = !inserted && ammo < capacity &&
    now >= startedAt + durationMs * ROUND_INSERT_FRACTION;
  const nextAmmo = shouldInsert ? Math.min(capacity, ammo + 1) : ammo;
  return {
    ammo: nextAmmo,
    inserted: inserted || shouldInsert,
    cycleComplete: now >= startedAt + durationMs,
    magazineFull: nextAmmo >= capacity,
  };
}
