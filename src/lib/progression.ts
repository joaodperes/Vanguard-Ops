/** Equipment progression stops at the final current weapon tier. Lifetime XP
 * remains intact; post-cap matches advance Career Contracts. */
export const MAX_PLAYER_LEVEL = 40;

/** 40% less XP than the previous 25 * (level - 1)^2 * level curve. */
export function totalXpForLevel(level: number): number {
  const bounded = Number.isNaN(level) ? 1 : Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  return 15 * (bounded - 1) * (bounded - 1) * bounded;
}

export function levelForXp(xp: number): number {
  if (Number.isNaN(xp) || xp <= 0) return 1;
  let low = 1, high = MAX_PLAYER_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (totalXpForLevel(mid) <= xp) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; level: number } {
  const level = levelForXp(xp);
  if (level === MAX_PLAYER_LEVEL) return { current: 0, needed: 0, level };
  const base = totalXpForLevel(level);
  return { current: Math.max(0, xp - base), needed: totalXpForLevel(level + 1) - base, level };
}
