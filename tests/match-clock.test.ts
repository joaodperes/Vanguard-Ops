import { describe, expect, test } from "bun:test";
import type { GameMode } from "../src/lib/game-protocol";
import { advanceMatchElapsed, displayedMatchSeconds, formatMatchClock } from "../src/lib/match-clock";

describe("Match HUD clocks across every mode", () => {
  const modes: GameMode[] = ["ffa", "tdm", "killconfirmed", "ctf", "survival", "gungame"];
  for (const mode of modes) {
    test(`${mode}: unlimited-time timer counts upward from 00:00`, () => {
      let elapsed = 0;
      // Mirrors both online 20 Hz server ticks and offline dt increments.
      for (let tick = 0; tick < 1400; tick++)
        elapsed = advanceMatchElapsed(elapsed, .05, true);
      const hud = { timeLeft: 0, elapsedSeconds: elapsed, unlimitedTime: true };
      expect(displayedMatchSeconds(hud)).toBeGreaterThanOrEqual(69);
      expect(formatMatchClock(hud)).toMatch(/^1:0[9]|1:10$/);
    });
  }

  test("elapsed time stays frozen during lobbies and prematch countdown", () => {
    expect(advanceMatchElapsed(undefined, .05, false)).toBe(0);
    expect(advanceMatchElapsed(11, .05, false)).toBe(11);
    expect(advanceMatchElapsed(11, .05, true)).toBeCloseTo(11.05);
  });

  test("time-limited matches still show remaining countdown time", () => {
    const hud = { timeLeft: 95, elapsedSeconds: 900, unlimitedTime: false };
    expect(formatMatchClock(hud)).toBe("1:35");
  });

  test("CTF overtime switches from expired countdown to advancing elapsed time", () => {
    const regulation = { timeLeft: 0, elapsedSeconds: 600, unlimitedTime: false };
    expect(formatMatchClock(regulation)).toBe("0:00");
    expect(formatMatchClock({...regulation,ctfOvertime:true})).toBe("10:00");
    expect(formatMatchClock({...regulation,ctfOvertime:true,elapsedSeconds:643})).toBe("10:43");
  });

  test("large elapsed clocks remain readable and invalid input is harmless", () => {
    expect(formatMatchClock({timeLeft:0,elapsedSeconds:3601,unlimitedTime:true})).toBe("60:01");
    expect(formatMatchClock({timeLeft:NaN,elapsedSeconds:NaN,unlimitedTime:true})).toBe("0:00");
  });
});
