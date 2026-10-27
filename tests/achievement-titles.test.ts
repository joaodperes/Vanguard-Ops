import {describe,expect,test} from "bun:test";
import {weaponMasteryProgress} from "../src/lib/armory-challenges";
import {achievementTitle,unlockedAchievementTitles,titledDisplayName,masteryAchievementStats,isFinalAchievementTier} from "../src/lib/achievement-titles";
import { ACHIEVEMENTS } from "../src/lib/game-data";
import { validateGameContent } from "../src/lib/content-validation";

describe("mastery title reward rules",()=>{
  test("titles require an awarded achievement and are never arbitrary strings",()=>{
    expect(achievementTitle("mastery_1")).toBeNull();
    expect(achievementTitle("mastery_5")).toBeNull();
    expect(achievementTitle("mastery_5x3")).toBeNull();
    expect(achievementTitle("mastery_5x8")).toBe("Arsenal Legend");
    expect(achievementTitle("unknown")).toBeNull();
    expect(unlockedAchievementTitles([])).toEqual([]);
    expect(unlockedAchievementTitles(["mastery_1","kills_100","mastery_5","mastery_5x8"]).map(x=>x.title))
      .toEqual(["Arsenal Legend"]);
    expect(titledDisplayName("Recruit","mastery_5x8")).toBe("Recruit · Arsenal Legend");
    expect(titledDisplayName("Recruit","mastery_5")).toBe("Recruit");
    expect(titledDisplayName("Recruit","invalid")).toBe("Recruit");
  });
  test("each chain grants exactly one title at its final tier", () => {
    for (const series of new Set(ACHIEVEMENTS.map(a => a.series))) {
      const chain = ACHIEVEMENTS.filter(a => a.series === series);
      const rewards = chain.filter(a => a.rewardTitle);
      expect(rewards).toHaveLength(1);
      expect(isFinalAchievementTier(rewards[0])).toBe(true);
      expect(rewards[0].seriesTier).toBe(Math.max(...chain.map(a => a.seriesTier)));
      expect(new Set(chain.map(a => a.seriesTier)).size).toBe(chain.length);
    }
  });
  test("kills, leveling, quests, streaks, Survival and objective titles use existing achievement ownership", () => {
    const ids = ["kills_2000", "level_30", "quest_total_50", "streak_10", "surv_20", "surv_nightmare_20", "ctf_captures_50"];
    expect(unlockedAchievementTitles(ids)).toHaveLength(ids.length);
    for (const id of ["kills_1000", "level_20", "surv_10", "ctf_first_capture"]) expect(achievementTitle(id)).toBeNull();
  });
  test("content validation rejects early title rewards and duplicate chain tiers", () => {
    const withEarlyTitle = ACHIEVEMENTS.map(a => a.id === "kills_100" ? { ...a, rewardTitle: "Too early" } : a);
    expect(validateGameContent({ achievements: withEarlyTitle }).some(e => e.includes("before the final series tier"))).toBe(true);
    const duplicate = ACHIEVEMENTS.map(a => a.id === "kills_100" ? { ...a, seriesTier: 1 } : a);
    expect(validateGameContent({ achievements: duplicate }).some(e => e.includes("duplicate series tier"))).toBe(true);
  });
  test("high-rank rewards require actual per-weapon mastery, not scattered cumulative kills",()=>{
    const rows=[
      {weaponId:"rifle_ar",kills:600,headshots:110},
      {weaponId:"smg_kp",kills:600,headshots:110},
      {weaponId:"pistol_side",kills:600,headshots:110},
      {weaponId:"hammer",kills:600,headshots:0},
      {weaponId:"rifle_dm",kills:60,headshots:10},
    ];
    const stats=masteryAchievementStats(rows);
    expect(stats.mastery_recruits).toBe(5);
    expect(stats.mastery_specialists).toBe(4);
    expect(stats.mastery_elites).toBe(4);
  });
  test("melee mastery uses attainable kills-only milestones while firearms still need headshots",()=>{
    expect(weaponMasteryProgress(600,0,"hammer").rank).toBe(5);
    expect(weaponMasteryProgress(600,0,"rifle_ar").rank).toBe(1);
    expect(weaponMasteryProgress(600,110,"rifle_ar").rank).toBe(5);
  });
});
