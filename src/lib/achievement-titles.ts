import { ACHIEVEMENTS } from "./game-data";
import { weaponMasteryProgress } from "./armory-challenges";

/** Permanent weapon-mastery achievement rewards. The player's equipped value
 * stores the achievement ID, never a client-provided arbitrary title. */
export function achievementTitle(achievementId:string|null|undefined):string|null {
  return ACHIEVEMENTS.find(a=>a.id===achievementId)?.rewardTitle ?? null;
}
export function unlockedAchievementTitles(earnedIds:readonly string[]) {
  const earned=new Set(earnedIds);
  return ACHIEVEMENTS.filter(a=>a.rewardTitle&&earned.has(a.id)).map(a=>({id:a.id,title:a.rewardTitle!}));
}
export function titledDisplayName(name:string,achievementId:string|null|undefined):string {
  const title=achievementTitle(achievementId);
  return title ? `${name} · ${title}` : name;
}

/** Weapon mastery is per distinct weapon, not raw total kills spread across
 * firearms. A melee mastery tier uses its kill requirement alone, since
 * melee attacks cannot generate headshots. */
export function masteryAchievementStats(rows:readonly {weaponId:string;kills:number;headshots:number}[]) {
  const byId=new Map<string,{weaponId:string;kills:number;headshots:number}>();
  for(const row of rows) byId.set(row.weaponId,row);
  const ranks=[...byId.values()].map(r=>weaponMasteryProgress(r.kills,r.headshots,r.weaponId).rank);
  return {
    mastery_recruits:ranks.filter(rank=>rank>=1).length,
    mastery_specialists:ranks.filter(rank=>rank>=3).length,
    mastery_elites:ranks.filter(rank=>rank>=5).length,
  };
}
