/** Consistent difficulty-based bot behavior for offline and Socket.IO simulation. */
export type BotTier = "easy" | "normal" | "hard" | "veteran";
const PROFILES = {
  easy:    { movement: 0.69, turn: 0.055, reaction: 850, reactionJitter: 370, decision: 730, decisionJitter: 440, aimDrift: 1.60 },
  normal:  { movement: 0.86, turn: 0.095, reaction: 480, reactionJitter: 260, decision: 480, decisionJitter: 310, aimDrift: 1.10 },
  hard:    { movement: 1.00, turn: 0.165, reaction: 250, reactionJitter: 180, decision: 330, decisionJitter: 180, aimDrift: 0.85 },
  veteran: { movement: 1.12, turn: 0.235, reaction: 120, reactionJitter: 110, decision: 220, decisionJitter: 130, aimDrift: 0.65 },
} as const;
export const botMoveMultiplier = (tier: BotTier): number => PROFILES[tier].movement;
export const botTurnLerp = (tier: BotTier, skill: number): number =>
  Math.min(0.31, PROFILES[tier].turn * (0.90 + skill * 0.22));
export const botReactionDelay = (tier: BotTier, roll = 0.5): number =>
  PROFILES[tier].reaction + PROFILES[tier].reactionJitter * Math.min(1, Math.max(0, roll));
export const botDecisionDelay = (tier: BotTier, roll = 0.5): number =>
  PROFILES[tier].decision + PROFILES[tier].decisionJitter * Math.min(1, Math.max(0, roll));
export const botAimDriftMultiplier = (tier: BotTier): number => PROFILES[tier].aimDrift;
