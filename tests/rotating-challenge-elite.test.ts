import { describe, expect, test } from "bun:test";
import {
  DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL,
  canPromoteChallengeToElite, promoteChallengeToElite,
  nextChallengeProgress, dailyChallengeSet, weeklyChallengeSet, weeklyChallengeKey,
} from "../src/lib/game-data";

const pool = [...DAILY_CHALLENGE_POOL, ...WEEKLY_CHALLENGE_POOL];

describe("rotating challenge Elite fairness", () => {
  test("grind and opponent-dependent objectives never promote", () => {
    const forbidden = [
      "ch_win_3", "ch_play_5", "ch_denials_5", "wk_wins_10",
      "ch_ctf_captures_2", "ch_ctf_returns_2", "ch_ctf_defense_3",
      "wk_ctf_captures_6", "wk_ctf_returns_8", "wk_ctf_defense_12",
      "wk_hard_waves_8",
    ];
    for (const id of forbidden) {
      const challenge = pool.find(q => q.id === id)!;
      expect(canPromoteChallengeToElite(challenge)).toBe(false);
      expect(() => promoteChallengeToElite(challenge)).toThrow();
    }
    expect(pool.filter(canPromoteChallengeToElite).length).toBe(pool.length - forbidden.length);
  });

  test("every eligible Elite variant has a larger goal, accurate description and 3× reward", () => {
    for (const base of pool.filter(canPromoteChallengeToElite)) {
      const elite = promoteChallengeToElite(base);
      expect(elite.id).toBe(base.id + "_elite");
      expect(elite.goal).toBe(base.eliteGoal ?? base.goal * 3);
      expect(elite.goal).toBeGreaterThan(base.goal);
      expect(elite.description).toContain(String(elite.goal));
      expect(elite.description).not.toContain("3× goal");
      expect(elite.rewardXp).toBe(base.rewardXp * 3);
      expect(elite.rewardCredits).toBe(base.rewardCredits * 3);
    }
  });

  test("curated Elite values avoid unrealistic 3× daily and weekly demands", () => {
    const lookup = (id: string) => promoteChallengeToElite(pool.find(q => q.id === id)!);
    expect(lookup("ch_multi_5").goal).toBe(8);
    expect(lookup("ch_surv_waves_5").goal).toBe(10);
    expect(lookup("wk_multi_30").goal).toBe(50);
    expect(lookup("wk_gungame_30").goal).toBe(60);
    expect(lookup("wk_melee_15").goal).toBe(30);
  });

  test("Survival wave challenges use a single best run, other quests accumulate", () => {
    const waves = DAILY_CHALLENGE_POOL.find(q => q.id === "ch_surv_waves_5")!;
    expect(nextChallengeProgress(waves, 3, 2)).toBe(3);
    expect(nextChallengeProgress(waves, 3, 5)).toBe(5);
    const elite = promoteChallengeToElite(waves);
    expect(nextChallengeProgress(elite, 7, 6)).toBe(7);
    expect(nextChallengeProgress(elite, 7, 10)).toBe(10);
    const kills = DAILY_CHALLENGE_POOL.find(q => q.id === "ch_kills_25")!;
    expect(nextChallengeProgress(kills, 8, 10)).toBe(18);
    expect(nextChallengeProgress(kills, 24, 10)).toBe(25);
  });
});

describe("challenge period consistency", () => {
  test("ISO week starts Monday and uses ISO week-year at New Year", () => {
    const a = new Date("2026-11-09T00:00:00Z");
    const b = new Date("2026-11-15T23:59:59Z");
    const next = new Date("2026-11-16T00:00:00Z");
    expect(weeklyChallengeKey(a)).toBe("2026-W46");
    expect(weeklyChallengeKey(b)).toBe("2026-W46");
    expect(weeklyChallengeKey(next)).toBe("2026-W47");
    expect(weeklyChallengeSet(a).map(q => q.id)).toEqual(weeklyChallengeSet(b).map(q => q.id));
    expect(weeklyChallengeKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(weeklyChallengeKey(new Date("2027-01-04T00:00:00Z"))).toBe("2027-W01");
  });

  test("daily rotation aligns with the UTC date key", () => {
    expect(dailyChallengeSet(new Date("2026-11-10T00:00:01Z")).map(q => q.id))
      .toEqual(dailyChallengeSet(new Date("2026-11-10T23:59:59Z")).map(q => q.id));
    expect(dailyChallengeSet(new Date("2026-11-11T00:00:01Z")).map(q => q.id))
      .not.toEqual(dailyChallengeSet(new Date("2026-11-10T23:59:59Z")).map(q => q.id));
  });
});
