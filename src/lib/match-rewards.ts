import { REWARDS } from "./game-data";
import type { MatchResultInput } from "./player-service";

export const DIFFICULTY_REWARDS: Record<string, { xp: number; credits: number }> = {
  easy: { xp: REWARDS.easyKillXp, credits: REWARDS.easyKillCredits },
  normal: { xp: REWARDS.normalKillXp, credits: REWARDS.normalKillCredits },
  hard: { xp: REWARDS.hardKillXp, credits: REWARDS.hardKillCredits },
  veteran: { xp: REWARDS.veteranKillXp, credits: REWARDS.veteranKillCredits },
  enemy_player: { xp: REWARDS.veteranKillXp, credits: REWARDS.veteranKillCredits },
};

/** One reward calculation for bot, online, legacy and Survival match reports.
 * Missing difficulty entries still pay the normal tier for every reported kill. */
export function calculateMatchRewards(input: MatchResultInput) {
  const diffs = input.killDifficulties ?? [];
  let killXp = input.headshots * REWARDS.headshotXpBonus;
  let killCredits = input.headshots * REWARDS.headshotCreditsBonus;
  for (let i = 0; i < input.kills; i++) {
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
  let xpGained = killXp + winXp + REWARDS.participationXp;
  let creditsGained = killCredits + winCredits + REWARDS.participationCredits;
  if (input.mode === "ctf") {
    const captures = Math.max(0, Math.min(50, Math.floor(input.score || 0)));
    xpGained += captures * REWARDS.captureXp;
    creditsGained += captures * REWARDS.captureCredits;
  }
  if (input.mode === "killconfirmed") {
    const confirms = Math.max(0, Math.min(200, Math.floor(input.confirmations ?? 0)));
    const denies = Math.max(0, Math.min(200, Math.floor(input.denials ?? 0)));
    xpGained += confirms * REWARDS.confirmXp + denies * REWARDS.denyXp;
    creditsGained += confirms * REWARDS.confirmCredits + denies * REWARDS.denyCredits;
  }
  const multikills = Math.max(0, Math.min(30, Math.floor(input.multikills ?? 0)));
  xpGained += multikills * REWARDS.multikillXp;
  creditsGained += multikills * REWARDS.multikillCredits;
  let survivalWaves = 0;
  if (input.mode === "survival") {
    survivalWaves = Math.max(0, Math.floor(input.survivalWaves ?? 0));
    const multiplier = input.survivalTier === "nightmare" ? 2 : input.survivalTier === "elite" ? 1.6 : input.survivalTier === "hard" ? 1.25 : 1;
    xpGained += Math.round(survivalWaves * REWARDS.survivalWaveXp * multiplier);
    creditsGained += Math.round(survivalWaves * REWARDS.survivalWaveCredits * multiplier);
    if (input.won && (!input.survivalTier || input.survivalTier === "default")) {
      xpGained += REWARDS.survivalWinXp;
      creditsGained += REWARDS.survivalWinCredits;
    }
  }
  return { killXp, killCredits, winXp, winCredits, xpGained, creditsGained, survivalWaves };
}
