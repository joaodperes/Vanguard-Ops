import { describe, expect, test } from "bun:test";
import { calculateMatchRewards, type RewardBreakdown } from "../src/lib/match-rewards";
import { isFlagDefenseKill, largestScoreDeficit } from "../src/lib/match-bonus-tracking";
import type { MatchResultInput } from "../src/lib/player-service";

const match: MatchResultInput = {
  playerKey: "reward-categories", kills: 0, deaths: 0, headshots: 0,
  assists: 0, won: false, mode: "tdm", score: 0, completed: true,
  participants: 8, placement: 8, durationSec: 360,
};

function balances(breakdown: RewardBreakdown) {
  return Object.values(breakdown).reduce((totals, row) => ({
    xp: totals.xp + row.xp, credits: totals.credits + row.credits,
  }), { xp: 0, credits: 0 });
}

describe("category-only match rewards", () => {
  test("six stable categories sum to the total without double counting", () => {
    const result = calculateMatchRewards({ ...match, won: true, kills: 5, headshots: 2, assists: 1, multikills: 1 });
    expect(Object.keys(result.breakdown)).toEqual([
      "combat", "objectives", "matchPerformance", "challenges", "achievements", "survival",
    ]);
    expect(balances(result.breakdown)).toEqual({ xp: result.xpGained, credits: result.creditsGained });
    expect(result.breakdown.challenges).toEqual({ xp: 0, credits: 0 });
    expect(result.breakdown.achievements).toEqual({ xp: 0, credits: 0 });
    expect(result.breakdown.survival).toEqual({ xp: 0, credits: 0 });
  });

  test("first place gets MVP but second and third get a smaller, exclusive podium bonus", () => {
    expect(calculateMatchRewards({ ...match, placement: 1 }).breakdown.matchPerformance).toEqual({ xp: 115, credits: 15 });
    expect(calculateMatchRewards({ ...match, placement: 2 }).breakdown.matchPerformance).toEqual({ xp: 95, credits: 12 });
    expect(calculateMatchRewards({ ...match, placement: 3 }).breakdown.matchPerformance).toEqual({ xp: 95, credits: 12 });
    expect(calculateMatchRewards({ ...match, placement: 4 }).breakdown.matchPerformance).toEqual({ xp: 75, credits: 10 });
    expect(calculateMatchRewards({ ...match, participants: 1, placement: 1 }).breakdown.matchPerformance).toEqual({ xp: 75, credits: 10 });
  });

  test("a continuous no-death streak grants milestones at 5, 10 and 15 only", () => {
    const input = { ...match, completed: false, participants: 0, kills: 20 };
    const base = calculateMatchRewards({ ...input, maxNoDeathStreak: 4 });
    const five = calculateMatchRewards({ ...input, maxNoDeathStreak: 5 });
    const ten = calculateMatchRewards({ ...input, maxNoDeathStreak: 10 });
    const twenty = calculateMatchRewards({ ...input, maxNoDeathStreak: 20 });
    expect(five.breakdown.combat.xp - base.breakdown.combat.xp).toBe(25);
    expect(ten.breakdown.combat.credits - base.breakdown.combat.credits).toBe(6);
    expect(twenty.breakdown.combat.xp - base.breakdown.combat.xp).toBe(75);
    expect(base.breakdown.matchPerformance.xp).toBe(0);
  });

  test("CTF flag return and home-flag defense pay only objective rewards", () => {
    const base = calculateMatchRewards({ ...match, mode: "ctf", score: 2, flagReturns: 1, defenseKills: 2 });
    expect(base.breakdown.objectives).toEqual({ xp: 205, credits: 32 });
    expect(balances(base.breakdown)).toEqual({ xp: base.xpGained, credits: base.creditsGained });
    const other = calculateMatchRewards({ ...match, mode: "tdm", flagReturns: 20, defenseKills: 20 });
    expect(other.breakdown.objectives).toEqual({ xp: 0, credits: 0 });
  });

  test("flag defense requires an enemy elimination near an intact home flag", () => {
    expect(isFlagDefenseKill(true, [10, 1, 6], [0, 0, 0])).toBe(true);
    expect(isFlagDefenseKill(false, [1, 0, 0], [0, 0, 0])).toBe(false);
    expect(isFlagDefenseKill(true, [20, 0, 0], [0, 0, 0])).toBe(false);
    expect(isFlagDefenseKill(true, [0, 10, 0], [0, 0, 0])).toBe(false);
    expect(isFlagDefenseKill(true, [NaN, 0, 0], [0, 0, 0])).toBe(false);
  });

  test("comeback requires a naturally completed team win after a real score deficit", () => {
    expect(largestScoreDeficit(0, 10, 15)).toBe(5);
    expect(largestScoreDeficit(5, 20, 10)).toBe(5);
    const won = calculateMatchRewards({ ...match, won: true, maxScoreDeficit: 5 });
    const lost = calculateMatchRewards({ ...match, won: false, maxScoreDeficit: 5 });
    const left = calculateMatchRewards({ ...match, won: false, completed: false, maxScoreDeficit: 5 });
    expect(won.breakdown.matchPerformance.xp - lost.breakdown.matchPerformance.xp).toBe(200);
    expect(left.breakdown.matchPerformance).toEqual({ xp: 0, credits: 0 });
    expect(calculateMatchRewards({ ...match, won: true, maxScoreDeficit: 4 }).breakdown.matchPerformance.xp).toBe(225);
    expect(calculateMatchRewards({ ...match, mode: "ctf", won: true, maxScoreDeficit: 2 }).breakdown.matchPerformance.xp).toBe(275);
    expect(calculateMatchRewards({ ...match, mode: "ffa", won: true, maxScoreDeficit: 100 }).breakdown.matchPerformance.xp).toBe(225);
  });

  test("endurance is a single capped payout after 8 minutes only for completed PvP", () => {
    const short = calculateMatchRewards({ ...match, durationSec: 479 });
    const eight = calculateMatchRewards({ ...match, durationSec: 480 });
    const long = calculateMatchRewards({ ...match, durationSec: 4000 });
    expect(eight.breakdown.matchPerformance.xp - short.breakdown.matchPerformance.xp).toBe(25);
    expect(eight.breakdown.matchPerformance.credits - short.breakdown.matchPerformance.credits).toBe(3);
    expect(long.breakdown.matchPerformance).toEqual(eight.breakdown.matchPerformance);
    const left = calculateMatchRewards({ ...match, completed: false, durationSec: 4000 });
    expect(left.breakdown.matchPerformance).toEqual({ xp: 0, credits: 0 });
  });

  test("Survival wave and win payouts are separated from scaled combat, never include PvP bonuses", () => {
    const result = calculateMatchRewards({
      ...match, mode: "survival", won: true, survivalWaves: 30,
      kills: 1, killDifficulties: ["normal"], maxNoDeathStreak: 20,
      maxScoreDeficit: 100, defenseKills: 5, flagReturns: 5, durationSec: 3600,
    });
    expect(result.breakdown.combat).toEqual({ xp: 6, credits: 1 });
    expect(result.breakdown.objectives).toEqual({ xp: 0, credits: 0 });
    expect(result.breakdown.matchPerformance).toEqual({ xp: 0, credits: 0 });
    expect(result.breakdown.survival).toEqual({ xp: 13950, credits: 1765 });
  });
});
