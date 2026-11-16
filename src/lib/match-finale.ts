/**
 * Visual-only match finale. Gameplay and scorekeeping remain authoritative and
 * stop immediately; recent death falls replay or continue at reduced speed.
 */
export const MATCH_FINALE_DURATION_MS = 3600;
export const MATCH_FINALE_RECENT_DEATH_MS = 2800;
export const MATCH_FINALE_PLAYBACK_RATE = 0.34;

/** Replay a completed recent fall; continue an unfinished fall in slow motion. */
export function finaleDeathProgress(ageAtFinaleMs: number, durationMs: number, finaleElapsedMs: number): number {
  if (durationMs <= 0) return 1;
  const start = ageAtFinaleMs >= durationMs ? 0 : Math.max(0, ageAtFinaleMs) / durationMs;
  return Math.min(1, start + Math.max(0, finaleElapsedMs) * MATCH_FINALE_PLAYBACK_RATE / durationMs);
}

/** An authoritative team-score field prevents stale snapshot scores at game end. */
export function finalTeamScores(
  standings: readonly { team: string; score: number }[],
  authoritative?: { red: number; blue: number },
): { red: number; blue: number } {
  if (authoritative) return { red: authoritative.red, blue: authoritative.blue };
  const totals = { red: 0, blue: 0 };
  for (const row of standings) {
    if (row.team === "red" || row.team === "blue")
      totals[row.team] += Number.isFinite(row.score) ? row.score : 0;
  }
  return totals;
}
