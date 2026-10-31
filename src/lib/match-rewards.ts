import { REWARDS } from "./game-data";
import type { MatchResultInput } from "./player-service";

export type RewardCategory = "combat" | "objectives" | "matchPerformance" | "challenges" | "achievements" | "survival";
export interface CategoryPayout { xp: number; credits: number }
export type RewardBreakdown = Record<RewardCategory, CategoryPayout>;

export const DIFFICULTY_REWARDS: Record<string, { xp: number; credits: number }> = {
  easy: { xp: REWARDS.easyKillXp, credits: REWARDS.easyKillCredits },
  normal: { xp: REWARDS.normalKillXp, credits: REWARDS.normalKillCredits },
  hard: { xp: REWARDS.hardKillXp, credits: REWARDS.hardKillCredits },
  veteran: { xp: REWARDS.veteranKillXp, credits: REWARDS.veteranKillCredits },
  enemy_player: { xp: REWARDS.veteranKillXp, credits: REWARDS.veteranKillCredits },
};

export function emptyRewardBreakdown(): RewardBreakdown {
  return {
    combat: { xp: 0, credits: 0 },
    objectives: { xp: 0, credits: 0 },
    matchPerformance: { xp: 0, credits: 0 },
    challenges: { xp: 0, credits: 0 },
    achievements: { xp: 0, credits: 0 },
    survival: { xp: 0, credits: 0 },
  };
}

/** Every payout belongs to exactly one row in the end-of-match table.
 * Completing the match is required for performance bonuses; actions earned
 * before an early departure remain payable. Survival uses wave rewards. */
export function calculateMatchRewards(input: MatchResultInput) {
  const breakdown = emptyRewardBreakdown();
  const diffs = input.killDifficulties ?? [];
  let killXp = Math.max(0, input.headshots) * REWARDS.headshotXpBonus;
  let killCredits = Math.max(0, input.headshots) * REWARDS.headshotCreditsBonus;
  for (let i = 0; i < Math.max(0, input.kills); i++) {
    const reward = diffs.length ? (DIFFICULTY_REWARDS[diffs[i]] ?? DIFFICULTY_REWARDS.normal)
      : { xp: REWARDS.killXp, credits: REWARDS.killCredits };
    killXp += reward.xp;
    killCredits += reward.credits;
  }
  const assists = Math.max(0, Math.min(200, Math.floor(input.assists ?? 0)));
  killXp += assists * REWARDS.assistXp;
  killCredits += assists * REWARDS.assistCredits;
  if (input.mode === "survival") {
    killXp = Math.round(killXp * REWARDS.survivalKillMultiplier);
    killCredits = Math.round(killCredits * REWARDS.survivalKillMultiplier);
  }
  const winXp = input.won ? REWARDS.winXpBonus : 0;
  const winCredits = input.won ? REWARDS.winCreditsBonus : 0;
  const completed = input.completed === true && input.mode !== "survival";
  const completionXp = completed ? REWARDS.completionXp : 0;
  const completionCredits = completed ? REWARDS.completionCredits : 0;
  const multi = Math.max(0, Math.min(30, Math.floor(input.multikills ?? 0)));
  const streakMilestones = input.mode === "survival" ? 0
    : Math.min(3, Math.floor(Math.max(0, input.maxNoDeathStreak ?? 0) / 5));
  breakdown.combat.xp = killXp + multi * REWARDS.multikillXp + streakMilestones * REWARDS.streakMilestoneXp;
  breakdown.combat.credits = killCredits + multi * REWARDS.multikillCredits + streakMilestones * REWARDS.streakMilestoneCredits;

  if (input.mode === "ctf") {
    const captures = Math.max(0, Math.min(50, Math.floor(input.score || 0)));
    const returns = Math.max(0, Math.min(10, Math.floor(input.flagReturns ?? 0)));
    const defenseKills = Math.max(0, Math.min(10, Math.floor(input.defenseKills ?? 0)));
    breakdown.objectives.xp = captures * REWARDS.captureXp + returns * REWARDS.flagReturnXp + defenseKills * REWARDS.flagDefenseXp;
    breakdown.objectives.credits = captures * REWARDS.captureCredits + returns * REWARDS.flagReturnCredits + defenseKills * REWARDS.flagDefenseCredits;
  } else if (input.mode === "killconfirmed") {
    const confirms = Math.max(0, Math.min(200, Math.floor(input.confirmations ?? 0)));
    const denies = Math.max(0, Math.min(200, Math.floor(input.denials ?? 0)));
    breakdown.objectives.xp = confirms * REWARDS.confirmXp + denies * REWARDS.denyXp;
    breakdown.objectives.credits = confirms * REWARDS.confirmCredits + denies * REWARDS.denyCredits;
  }

  if (input.mode !== "survival") {
    const ranked = completed && (input.participants ?? 0) >= 2;
    const mvp = ranked && input.placement === 1;
    const topThree = ranked && !mvp && (input.placement === 2 || input.placement === 3);
    const comeback = completed && input.won &&
      (input.mode === "ctf" ? (input.maxScoreDeficit ?? 0) >= 2 :
        (input.mode === "tdm" || input.mode === "killconfirmed") && (input.maxScoreDeficit ?? 0) >= 5);
    const endurance = completed && (input.durationSec ?? 0) >= 480;
    breakdown.matchPerformance.xp = winXp + completionXp +
      (mvp ? REWARDS.mvpXp : topThree ? REWARDS.topThreeXp : 0) +
      (comeback ? REWARDS.comebackXp : 0) + (endurance ? REWARDS.enduranceXp : 0);
    breakdown.matchPerformance.credits = winCredits + completionCredits +
      (mvp ? REWARDS.mvpCredits : topThree ? REWARDS.topThreeCredits : 0) +
      (comeback ? REWARDS.comebackCredits : 0) + (endurance ? REWARDS.enduranceCredits : 0);
  } else {
    breakdown.survival.xp = winXp;
    breakdown.survival.credits = winCredits;
    const waves = Math.max(0, Math.floor(input.survivalWaves ?? 0));
    const multiplier = input.survivalTier === "nightmare" ? 2 : input.survivalTier === "elite" ? 1.6 : input.survivalTier === "hard" ? 1.25 : 1;
    breakdown.survival.xp += Math.round(waves * REWARDS.survivalWaveXp * multiplier);
    breakdown.survival.credits += Math.round(waves * REWARDS.survivalWaveCredits * multiplier);
    if (input.won && (!input.survivalTier || input.survivalTier === "default")) {
      breakdown.survival.xp += REWARDS.survivalWinXp;
      breakdown.survival.credits += REWARDS.survivalWinCredits;
    }
  }
  const xpGained = Object.values(breakdown).reduce((sum, b) => sum + b.xp, 0);
  const creditsGained = Object.values(breakdown).reduce((sum, b) => sum + b.credits, 0);
  const survivalWaves = input.mode === "survival" ? Math.max(0, Math.floor(input.survivalWaves ?? 0)) : 0;
  return { killXp, killCredits, winXp, winCredits, completionXp, completionCredits, xpGained, creditsGained, survivalWaves, breakdown };
}
