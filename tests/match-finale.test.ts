import { describe, expect, test } from "bun:test";
import {
  MATCH_FINALE_DURATION_MS, MATCH_FINALE_PLAYBACK_RATE, MATCH_FINALE_RECENT_DEATH_MS,
  finaleDeathProgress, finalTeamScores,
} from "../src/lib/match-finale";

describe("match-ending slow-motion presentation", () => {
  test("plays a fresh decisive fall at reduced speed during the outro", () => {
    expect(MATCH_FINALE_DURATION_MS).toBeGreaterThan(900 / MATCH_FINALE_PLAYBACK_RATE);
    expect(finaleDeathProgress(0, 900, 900)).toBeCloseTo(0.34);
    expect(finaleDeathProgress(0, 900, MATCH_FINALE_DURATION_MS)).toBe(1);
  });
  test("continues unfinished falls and replays recently completed ones", () => {
    expect(finaleDeathProgress(450, 900, 0)).toBeCloseTo(0.5);
    expect(finaleDeathProgress(450, 900, 450)).toBeGreaterThan(0.5);
    expect(finaleDeathProgress(1500, 900, 0)).toBe(0);
    expect(MATCH_FINALE_RECENT_DEATH_MS).toBeGreaterThan(2000);
  });
  test("progress never reverses after the finale starts", () => {
    const pts = [0, 100, 500, 1800, 3600].map(t => finaleDeathProgress(200, 1000, t));
    expect(pts).toEqual([...pts].sort((a,b) => a-b));
  });
});
describe("authoritative final scoreboard", () => {
  const rows = [
    { team: "red", score: 2 }, { team: "blue", score: 1 },
    { team: "red", score: 1 }, { team: "ffa", score: 99 },
  ];
  test("uses definitive server team totals for kills and captures", () => {
    expect(finalTeamScores(rows, {red:60,blue:58})).toEqual({red:60,blue:58});
    expect(finalTeamScores(rows, {red:3,blue:1})).toEqual({red:3,blue:1});
  });
  test("can aggregate scores from an older server's standings", () => {
    expect(finalTeamScores(rows)).toEqual({red:3,blue:1});
  });
});
