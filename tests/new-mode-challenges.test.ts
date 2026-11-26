import { describe, expect, test } from "bun:test";
import { contextualChallengeDelta, DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL } from "../src/lib/game-data";

describe("new rotating mode challenges", () => {
  test("daily and weekly pools include the new mode/map objectives", () => {
    expect(DAILY_CHALLENGE_POOL.some(c => c.id === "ch_sd_obj_1" && c.metric === "searchdestroy_objectives")).toBe(true);
    expect(DAILY_CHALLENGE_POOL.some(c => c.id === "ch_hp_time_90" && c.metric === "hardpoint_objective_seconds")).toBe(true);
    expect(DAILY_CHALLENGE_POOL.some(c => c.id === "ch_frontier_kills_10" && c.metric === "frontier_kills")).toBe(true);
    expect(DAILY_CHALLENGE_POOL.some(c => c.id === "ch_map_dustwater_secondary_10" && c.mapId === "dustwater" && c.metric === "kills_with_secondary")).toBe(true);
    expect(WEEKLY_CHALLENGE_POOL.some(c => c.id === "wk_sd_obj_5")).toBe(true);
    expect(WEEKLY_CHALLENGE_POOL.some(c => c.id === "wk_hp_wins_5")).toBe(true);
    expect(WEEKLY_CHALLENGE_POOL.some(c => c.id === "wk_frontier_wins_5")).toBe(true);
  });

  test("mode and map filters prevent progress outside the intended match", () => {
    const challenge = { metric: "kills_with_secondary" as const, mapId: "dustwater", mode: "frontier" };
    expect(contextualChallengeDelta(challenge, { mapId: "dustwater", mode: "frontier", kills: 10 }, 10)).toBe(10);
    expect(contextualChallengeDelta(challenge, { mapId: "dustwater", mode: "tdm", kills: 10 }, 10)).toBe(0);
    expect(contextualChallengeDelta(challenge, { mapId: "compound", mode: "frontier", kills: 10 }, 10)).toBe(0);
  });
});
