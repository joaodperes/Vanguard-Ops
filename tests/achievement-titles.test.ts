import {describe,expect,test} from "bun:test";
import {weaponMasteryProgress} from "../src/lib/armory-challenges";
import {achievementTitle,unlockedAchievementTitles,titledDisplayName,masteryAchievementStats} from "../src/lib/achievement-titles";

describe("mastery title reward rules",()=>{
  test("titles require an awarded achievement and are never arbitrary strings",()=>{
    expect(achievementTitle("mastery_1")).toBe("Weapon Apprentice");
    expect(achievementTitle("mastery_5")).toBe("Weapon Master");
    expect(achievementTitle("unknown")).toBeNull();
    expect(unlockedAchievementTitles([])).toEqual([]);
    expect(unlockedAchievementTitles(["mastery_1","kills_100","mastery_5"]).map(x=>x.title))
      .toEqual(["Weapon Apprentice","Weapon Master"]);
    expect(titledDisplayName("Recruit","mastery_5")).toBe("Recruit · Weapon Master");
    expect(titledDisplayName("Recruit","invalid")).toBe("Recruit");
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
