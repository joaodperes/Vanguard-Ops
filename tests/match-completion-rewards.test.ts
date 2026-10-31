import { describe, expect, test } from "bun:test";
import { calculateMatchRewards } from "../src/lib/match-rewards";
import type { MatchResultInput } from "../src/lib/player-service";

const base: MatchResultInput = {
  playerKey: "completion-reward-test", kills: 0, deaths: 0,
  headshots: 0, won: false, mode: "tdm", score: 0,
};

describe("PvP match completion rewards", () => {
  test("early leavers earn no automatic participation or completion reward", () => {
    const result = calculateMatchRewards({ ...base, completed: false });
    expect(result).toMatchObject({ xpGained: 0, creditsGained: 0, completionXp: 0, completionCredits: 0 });
  });

  test("all PvP modes award +75 XP and +10 credits on completion", () => {
    for (const mode of ["ffa", "tdm", "gungame", "killconfirmed", "ctf"] as const) {
      const result = calculateMatchRewards({ ...base, mode, completed: true });
      expect(result).toMatchObject({ xpGained: 75, creditsGained: 10, completionXp: 75, completionCredits: 10 });
      // Old clients or arbitrary partial reports do not earn a completion bonus.
      const missingFlag = calculateMatchRewards({ ...base, mode });
      expect(missingFlag).toMatchObject({ xpGained: 0, creditsGained: 0, completionXp: 0, completionCredits: 0 });
    }
  });

  test("victory and completion bonuses stack", () => {
    const result = calculateMatchRewards({ ...base, completed: true, won: true });
    expect(result.xpGained).toBe(225);
    expect(result.creditsGained).toBe(35);
  });

  test("leaving retains earned kill rewards", () => {
    const result = calculateMatchRewards({
      ...base, completed: false, kills: 2, killDifficulties: ["normal", "hard"],
    });
    expect(result.xpGained).toBe(37);
    expect(result.creditsGained).toBe(6);
    expect(result.completionXp).toBe(0);
  });

  test("objective rewards still apply to an early exit", () => {
    const result = calculateMatchRewards({ ...base, mode: "ctf", completed: false, score: 1 });
    expect(result.xpGained).toBe(75);
    expect(result.creditsGained).toBe(12);
  });

  test("Survival never receives PvP completion reward", () => {
    const result = calculateMatchRewards({ ...base, mode: "survival", completed: true, survivalWaves: 2 });
    expect(result).toMatchObject({ completionXp: 0, completionCredits: 0, xpGained: 120, creditsGained: 16 });
  });
});
