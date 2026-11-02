import { describe, expect, test } from "bun:test";
import {
  killRank, teamScorePerspective, flagStateLabel, ctfFlagLine,
} from "../src/lib/hud-top-stats";

describe("lean HUD leaderboard rank", () => {
  test("FFA and Gun Game rank by personal kills, with ties sharing rank", () => {
    const rows = [
      { kills: 9, isSelf: false },
      { kills: 6, isSelf: true },
      { kills: 6, isSelf: false },
      { kills: 4, isSelf: false },
    ];
    expect(killRank(rows, 0)).toEqual({ rank: 2, players: 4 });
    expect(killRank([{ kills: 9, isSelf: true }, ...rows.slice(1)], 0)).toEqual({ rank: 1, players: 4 });
  });
  test("large lobbies and delayed self synchronization never produce invalid rank", () => {
    const rows = Array.from({length: 32}, (_, i) => ({ kills: 32 - i, isSelf: i === 31 }));
    expect(killRank(rows, 99)).toEqual({ rank: 32, players: 32 });
    expect(killRank([], 3)).toEqual({ rank: 1, players: 1 });
    expect(killRank([{ kills: 4, isSelf: false }], 3)).toEqual({ rank: 2, players: 2 });
  });
});

describe("objective scores are presented relative to the local team", () => {
  const teamScores = { red: 3, blue: 5 };
  test("Red users see red as Team and blue as Enemy", () => {
    expect(teamScorePerspective(teamScores, "red")).toEqual({ own: 3, enemy: 5 });
  });
  test("Blue users see blue as Team and red as Enemy", () => {
    expect(teamScorePerspective(teamScores, "blue")).toEqual({ own: 5, enemy: 3 });
  });
});

describe("CTF second-line flag status", () => {
  const home = { carrierId: null, dropped: false };
  const taken = { carrierId: "someone", dropped: false };
  const dropped = { carrierId: null, dropped: true };
  test("flags only show HOME, TAKEN or DROPPED", () => {
    expect(flagStateLabel(home)).toBe("HOME");
    expect(flagStateLabel(taken)).toBe("TAKEN");
    expect(flagStateLabel(dropped)).toBe("DROPPED");
  });
  test("red and blue players see the correct team-relative flag statuses", () => {
    const flags = { red: dropped, blue: taken };
    expect(ctfFlagLine(flags, "red", false)).toEqual({ own: "DROPPED", enemy: "TAKEN" });
    expect(ctfFlagLine(flags, "blue", false)).toEqual({ own: "TAKEN", enemy: "DROPPED" });
  });
  test("a flag carrier sees CARRYING rather than a generic TAKEN status", () => {
    expect(ctfFlagLine({ red: home, blue: taken }, "red", true)).toEqual({ own: "HOME", enemy: "CARRYING" });
  });
});
