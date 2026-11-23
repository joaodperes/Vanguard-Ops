/** Per-weapon magazine kill counters for sustained-fire Armory challenges. */
export function recordMagazineKill(
  counts: Map<string, number>,
  weaponId: string,
  isLmg: boolean,
): boolean {
  if (!isLmg) return false;
  const next = (counts.get(weaponId) ?? 0) + 1;
  counts.set(weaponId, next);
  return next % 2 === 0;
}

export function resetMagazineKillCount(counts: Map<string, number>, weaponId: string): void {
  counts.set(weaponId, 0);
}
