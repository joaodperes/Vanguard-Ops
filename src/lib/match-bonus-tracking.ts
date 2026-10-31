/** Shared event rules for accountable match bonuses. */
export const FLAG_DEFENSE_RADIUS = 14;
export function isFlagDefenseKill(flagHome: boolean, victim: readonly number[], home: readonly number[]): boolean {
  return flagHome && victim.length >= 3 && home.length >= 3 &&
    victim.every(Number.isFinite) && home.every(Number.isFinite) &&
    Math.hypot(victim[0] - home[0], victim[2] - home[2]) <= FLAG_DEFENSE_RADIUS &&
    Math.abs(victim[1] - home[1]) <= 6;
}

export function largestScoreDeficit(previous: number, own: number, enemy: number): number {
  return Math.max(0, previous, enemy - own);
}
