/** Short-lived, non-omniscient enemy memory shared by client and server bots.
 * Record ONLY targets that were genuinely visible. Once sight is lost, the bot
 * navigates to the frozen last-seen point, never the hidden enemy's live position.
 */
import type { Vec3 } from "./game-protocol";
import type { BotTier } from "./bot-difficulty";
import type { BotArchetype } from "./bot-archetypes";

export interface BotSighting {
  targetId: string;
  lastSeen: Vec3;
  seenAt: number;
}
export interface BotInvestigation {
  goal: Vec3;
  lookAt: Vec3;
  kind: "approach" | "search" | "watch";
}

const MEMORY_MS: Record<BotTier, number> = {
  easy: 1600,
  normal: 3300,
  hard: 4800,
  veteran: 5800,
};
const ARCHETYPE_ADJUST_MS: Record<BotArchetype,number> = {
  rusher: 800, rifleman: 0, marksman: -350, support: 250,
};
export function botMemoryDuration(tier: BotTier, archetype: BotArchetype):number {
  return Math.max(1000,MEMORY_MS[tier]+ARCHETYPE_ADJUST_MS[archetype]);
}

export function botRememberSighting(id:string, visiblePos:readonly [number,number,number], now:number):BotSighting {
  return {targetId:id,lastSeen:[...visiblePos] as Vec3,seenAt:now};
}

/** If the opponent died or the memory expired, stop investigating.
 * Searching uses a very small deterministic sweep, not a prediction of motion
 * behind walls. A marksman watches the last sightline instead of rushing it.
 */
export function botInvestigation(
  sighting:BotSighting|null|undefined,botPos:readonly [number,number,number],
  now:number,tier:BotTier,archetype:BotArchetype,enemyAlive:boolean,botId:string,
):BotInvestigation|null {
  if(!sighting||!enemyAlive||now<sighting.seenAt||
     now-sighting.seenAt>botMemoryDuration(tier,archetype))return null;
  const last=[...sighting.lastSeen] as Vec3;
  if(archetype==="marksman")return {goal:[...botPos] as Vec3,lookAt:last,kind:"watch"};
  const d=Math.hypot(botPos[0]-last[0],botPos[2]-last[2]);
  if(d>2.5)return {goal:last,lookAt:last,kind:"approach"};
  // At the last-seen spot, probe one nearby approach for the remaining time.
  // Stagger by bot ID; don't crowd an identical, magically inferred position.
  const hash=[...botId].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,17);
  const angle=(hash%8)*(Math.PI/4);
  const radius=archetype==="rusher"?4:2.5;
  return {goal:[last[0]+Math.sin(angle)*radius,last[1],last[2]+Math.cos(angle)*radius],
    lookAt:last,kind:"search"};
}
