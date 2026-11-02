import { MAX_PLAYER_LEVEL, totalXpForLevel, levelForXp } from "./progression";

export const CAREER_TITLES = [
  { id: "career_veteran", title: "Veteran Operative", rank: 1 },
  { id: "career_decorated", title: "Decorated Vanguard", rank: 5 },
  { id: "career_legend", title: "Vanguard Legend", rank: 10 },
] as const;

export function careerRequirement(rank: number) {
  return { xp: 20000 + rank * 5000, credits: 5000 + rank * 2500 };
}

export function careerTitle(id: string | null | undefined) {
  return CAREER_TITLES.find(t => t.id === id);
}

/** Only the new match's post-cap portion counts. Neither historic overflow XP
 * nor excess progress on a full meter can be banked for the following rank. */
export function careerXpAfterMatch(current: number, rank: number, previousXp: number, earnedXp: number): number {
  const cap = totalXpForLevel(MAX_PLAYER_LEVEL);
  const fresh = Math.max(0, previousXp + earnedXp - Math.max(previousXp, cap));
  return Math.min(careerRequirement(rank).xp, Math.max(0, current) + fresh);
}

export function careerView(player: { xp: number; credits: number; careerRank: number; careerXp: number }) {
  const unlocked = levelForXp(player.xp) === MAX_PLAYER_LEVEL;
  const required = careerRequirement(player.careerRank);
  const currentXp = Math.min(required.xp, Math.max(0, player.careerXp));
  return {
    rank: player.careerRank, unlocked, unlockLevel: MAX_PLAYER_LEVEL,
    currentXp, requiredXp: required.xp, creditCost: required.credits,
    canPromote: unlocked && currentXp >= required.xp && player.credits >= required.credits,
    nextTitle: CAREER_TITLES.find(t => t.rank > player.careerRank) ?? null,
  };
}

/** Backups from before Career ranks have no fields. Bound restored meters and
 * ignore older-rank progress so an old backup cannot refill the next rank. */
export function restoreCareer(existing: { careerRank: number; careerXp: number } | null, imported: { careerRank?: number; careerXp?: number }) {
  const rank = typeof imported.careerRank === "number" && Number.isSafeInteger(imported.careerRank)
    ? Math.max(0, Math.min(100000, imported.careerRank)) : 0;
  const xp = typeof imported.careerXp === "number" && Number.isSafeInteger(imported.careerXp)
    ? Math.max(0, imported.careerXp) : 0;
  if (existing && existing.careerRank > rank) return { careerRank: existing.careerRank, careerXp: existing.careerXp };
  return {
    careerRank: rank,
    careerXp: Math.min(careerRequirement(rank).xp, Math.max(xp, existing?.careerRank === rank ? existing.careerXp : 0)),
  };
}
