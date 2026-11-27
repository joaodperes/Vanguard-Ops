import { describe, expect, test } from "bun:test";
import { scoreBotTarget } from "../src/lib/bot-target-selection";

describe("bot target prioritization", () => {
  test("prefers a wounded target over a closer healthy one with a long-range weapon", () => {
    const closeHealthy = scoreBotTarget({
      distance: 12, health: 100, maxHealth: 100, weaponRange: 90,
    });
    const distantWounded = scoreBotTarget({
      distance: 25, health: 25, maxHealth: 100, weaponRange: 90,
    });
    expect(distantWounded).toBeLessThan(closeHealthy);
  });

  test("long-range weapons make distance a less dominant factor", () => {
    const closeScoreShortRange = scoreBotTarget({
      distance: 10, health: 100, maxHealth: 100, weaponRange: 20,
    });
    const farScoreShortRange = scoreBotTarget({
      distance: 20, health: 100, maxHealth: 100, weaponRange: 20,
    });
    const closeScoreLongRange = scoreBotTarget({
      distance: 10, health: 100, maxHealth: 100, weaponRange: 100,
    });
    const farScoreLongRange = scoreBotTarget({
      distance: 20, health: 100, maxHealth: 100, weaponRange: 100,
    });
    expect(farScoreLongRange - closeScoreLongRange).toBeLessThan(farScoreShortRange - closeScoreShortRange);
  });

  test("target persistence and teammate focus are meaningful soft bonuses", () => {
    const neutral = scoreBotTarget({ distance: 20, health: 100, maxHealth: 100, weaponRange: 60 });
    const persisted = scoreBotTarget({ distance: 20, health: 100, maxHealth: 100, weaponRange: 60, isPreferred: true });
    const focused = scoreBotTarget({ distance: 20, health: 100, maxHealth: 100, weaponRange: 60, focusCount: 2 });
    expect(persisted).toBeLessThan(neutral);
    expect(focused).toBeLessThan(neutral);
  });
});
