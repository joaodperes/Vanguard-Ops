import { describe, expect, test } from "bun:test";
import { scoreboardRules } from "../src/lib/scoreboard-rules";

const timed = { scoreLimit: 30, timeLimitSec: 600, timeLeft: 95, elapsedSeconds: 505, unlimitedTime: false };
describe("Tab scoreboard uses the active match rules", () => {
  test("FFA retains the configured kill and time limits", () => {
    expect(scoreboardRules("ffa", timed)).toEqual(["First to 30 kills", "Time 1:35 remaining / 10:00 limit"]);
  });
  test("all team modes identify their objective and custom target", () => {
    expect(scoreboardRules("tdm", { ...timed, scoreLimit: 75 })[0]).toBe("First to 75 team kills");
    expect(scoreboardRules("killconfirmed", { ...timed, scoreLimit: 50 })[0]).toBe("First to 50 confirmed points");
    expect(scoreboardRules("ctf", { ...timed, scoreLimit: 5 })[0]).toBe("First to 5 flag captures");
  });
  test("unlimited matches never show stale default caps", () => {
    expect(scoreboardRules("ffa", { ...timed, scoreLimit: 0, timeLimitSec: 0, unlimitedTime: true }))
      .toEqual(["No score limit", "No time limit · Elapsed 8:25"]);
  });
  test("overtime is separate from regulation", () => {
    expect(scoreboardRules("ctf", { ...timed, scoreLimit: 3, ctfOvertime: true }))
      .toEqual(["First to 3 flag captures", "Overtime · Elapsed 8:25"]);
  });
  test("Gun Game and Survival display their actual objectives", () => {
    expect(scoreboardRules("gungame", { ...timed, gungameIndex: 4, gungameTotal: 18 }))
      .toEqual(["Weapon 5/18 · Final weapon wins", "No time limit · Elapsed 8:25"]);
    expect(scoreboardRules("survival", { ...timed, survivalWave: 9, survivalReinforcements: 2 }))
      .toEqual(["Wave 9 · Survive the assault", "Reinforcements: 2 · Elapsed 8:25"]);
  });
});
