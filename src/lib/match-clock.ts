/**
 * Match-clock rules, shared by offline simulation, multiplayer and the HUD.
 * A zero time limit disables the countdown; it must NOT disable elapsed time.
 */
export function advanceMatchElapsed(previous: number | undefined, dt: number, active: boolean): number {
  const elapsed = Number.isFinite(previous) ? Math.max(0, previous ?? 0) : 0;
  return active && Number.isFinite(dt) ? elapsed + Math.max(0, dt) : elapsed;
}

export function displayedMatchSeconds(state: {
  timeLeft: number;
  elapsedSeconds: number;
  unlimitedTime: boolean;
  ctfOvertime?: boolean;
}): number {
  const value = state.unlimitedTime || state.ctfOvertime
    ? state.elapsedSeconds
    : state.timeLeft;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function formatMatchClock(state: Parameters<typeof displayedMatchSeconds>[0]): string {
  const seconds = displayedMatchSeconds(state);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
