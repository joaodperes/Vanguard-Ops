/** Scoring for offline bot target selection.
 * Lower scores are preferred. Range reduces how strongly raw distance matters,
 * while wounded targets, established target intent and team focus add soft biases.
 */
export interface BotTargetScoreInput {
  distance: number;
  health: number;
  maxHealth: number;
  weaponRange: number;
  isPreferred?: boolean;
  focusCount?: number;
}

export function scoreBotTarget(input: BotTargetScoreInput): number {
  const range = Math.max(1, input.weaponRange);
  // Long-range weapons value distance less; close-range weapons retain urgency.
  const distanceWeight = Math.max(0.32, Math.min(1.15, 55 / range));
  const healthRatio = Math.max(0, Math.min(1, input.health / Math.max(1, input.maxHealth)));
  const woundedBonus = (1 - healthRatio) * 24;
  const persistenceBonus = input.isPreferred ? 12 : 0;
  const focusBonus = Math.min(3, Math.max(0, input.focusCount ?? 0)) * 4;
  return input.distance * distanceWeight - woundedBonus - persistenceBonus - focusBonus;
}
