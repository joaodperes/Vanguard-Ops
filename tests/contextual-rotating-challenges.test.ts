import { describe, expect, test } from "bun:test";
import { ATTACHMENTS, DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, CHALLENGE_FOCUSES,
  dailyChallengeSet, weeklyChallengeSet, weeklyChallengeKey, contextualChallengeDelta, promoteChallengeToElite,
} from "../src/lib/game-data";
import { MAPS } from "../src/lib/game-protocol";
import { validateGameContent } from "../src/lib/content-validation";

const all = [...DAILY_CHALLENGE_POOL, ...WEEKLY_CHALLENGE_POOL];

describe("rotating quest content and rotation", () => {
  test("all quests have valid contextual references and focus", () => {
    const knownAttachments = new Set(ATTACHMENTS.map(a => a.id));
    expect(validateGameContent()).toEqual([]);
    expect(DAILY_CHALLENGE_POOL.length).toBe(36);
    expect(WEEKLY_CHALLENGE_POOL.length).toBe(29);
    for (const c of all) {
      expect(CHALLENGE_FOCUSES).toContain(c.focus as typeof CHALLENGE_FOCUSES[number]);
      if (c.mapId) expect(Object.prototype.hasOwnProperty.call(MAPS, c.mapId)).toBe(true);
      if (c.attachmentId) {
        expect(c.metric).toBe("kills");
        expect(knownAttachments.has(c.attachmentId)).toBe(true);
      }
      if (c.survivalTier) expect(c.metric).toBe("survival_waves");
    }
  });

  test("three daily and three weekly quests span different focuses", () => {
    const date = new Date("2026-11-10T13:00:00Z");
    for (const chosen of [dailyChallengeSet(date), weeklyChallengeSet(date)]) {
      expect(chosen).toHaveLength(3);
      expect(new Set(chosen.map(c => c.focus))).toEqual(new Set(CHALLENGE_FOCUSES));
    }
    expect(weeklyChallengeKey(date)).toBe("2026-W46");
  });

  test("every authored quest appears during a year of rotation", () => {
    const dailies = new Set<string>(), weeklies = new Set<string>();
    for (let d = 0; d < 365; d++) {
      dailyChallengeSet(new Date(Date.UTC(2026, 0, 1 + d))).forEach(c => dailies.add(c.id));
    }
    for (let w = 0; w < 53; w++) {
      weeklyChallengeSet(new Date(Date.UTC(2026, 0, 5 + w * 7))).forEach(c => weeklies.add(c.id));
    }
    expect(dailies.size).toBe(DAILY_CHALLENGE_POOL.length);
    expect(weeklies.size).toBe(WEEKLY_CHALLENGE_POOL.length);
  });

  test("Elite Holdout requires 10 completed waves in one run", () => {
    const holdout = DAILY_CHALLENGE_POOL.find(c => c.id === "ch_surv_waves_5")!;
    expect(holdout.goal).toBe(5);
    expect(promoteChallengeToElite(holdout).goal).toBe(10);
  });
});

describe("contextual quest attribution", () => {
  const base = { mode: "tdm", kills: 12, mapId: "bunker", perAttachmentKills: { barrel_suppressor: 7, sight_red_dot: 4 } };

  test("map quests count only kills on the specified map", () => {
    const quest = DAILY_CHALLENGE_POOL.find(c => c.id === "ch_map_blacksite_12")!;
    expect(contextualChallengeDelta(quest, base, 12)).toBe(12);
    expect(contextualChallengeDelta(quest, { ...base, mapId: "shipyard" }, 12)).toBe(0);
    expect(contextualChallengeDelta(quest, { ...base, mapId: undefined }, 12)).toBe(0);
  });

  test("attachment quests count only kills with the attachment mounted at elimination time", () => {
    const quest = DAILY_CHALLENGE_POOL.find(c => c.id === "ch_suppressor_12")!;
    expect(contextualChallengeDelta(quest, base, 12)).toBe(7);
    expect(contextualChallengeDelta(quest, { ...base, perAttachmentKills: {} }, 12)).toBe(0);
    expect(contextualChallengeDelta(quest, { ...base, perAttachmentKills: { barrel_suppressor: 200 } }, 12)).toBe(12);
    expect(contextualChallengeDelta(quest, { ...base, perAttachmentKills: undefined }, 12)).toBe(0);
  });

  test("difficulty-specific Survival quests count only the requested tier", () => {
    const quest = WEEKLY_CHALLENGE_POOL.find(c => c.id === "wk_hard_waves_8")!;
    expect(contextualChallengeDelta(quest, { mode: "survival", kills: 20, survivalTier: "hard" }, 7)).toBe(7);
    expect(contextualChallengeDelta(quest, { mode: "survival", kills: 20, survivalTier: "default" }, 7)).toBe(0);
    expect(contextualChallengeDelta(quest, { mode: "ffa", kills: 20, survivalTier: "hard" }, 7)).toBe(0);
  });
});
