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
  /** Set when the bot first reaches the remembered position. */
  searchStartedAt?: number;
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
  if(d<=2.5 && sighting.searchStartedAt===undefined)sighting.searchStartedAt=now;
  // Once searching starts, stick to the same nearby scan point rather than
  // endlessly oscillating between it and the original last-seen location.
  if(sighting.searchStartedAt===undefined)return {goal:last,lookAt:last,kind:"approach"};
  // At the last-seen spot, probe one nearby approach for the remaining time.
  // Stagger by bot ID; don't crowd an identical, magically inferred position.
  const hash=[...botId].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,17);
  const angle=(hash%8)*(Math.PI/4);
  const radius=archetype==="rusher"?4:2.5;
  return {goal:[last[0]+Math.sin(angle)*radius,last[1],last[2]+Math.cos(angle)*radius],
    lookAt:last,kind:"search"};
}


/** Sounds provide a frozen last-known position, never an omniscient target lock. */
export interface BotNoise {
  sourceId: string;
  pos: Vec3;
  at: number;
  kind: "footstep" | "gunshot";
  sprinting?: boolean;
  suppressed?: boolean;
}
export interface BotAlert {
  sourceId: string;
  pos: Vec3;
  at: number;
  kind: BotNoise["kind"] | "hit";
}
export function botNoiseRadius(noise: Pick<BotNoise,"kind"|"sprinting"|"suppressed">, tier: BotTier): number {
  const base = noise.kind === "footstep" ? (noise.sprinting ? 17 : 10) : noise.suppressed ? 19 : 65;
  const scale: Record<BotTier, number> = { easy: .78, normal: 1, hard: 1.13, veteran: 1.25 };
  return base * scale[tier];
}
/** A cover obstacle muffles the sound rather than silencing it. */
export function botCanHearNoise(
  listener: readonly [number,number,number], noise: BotNoise, now:number,
  tier:BotTier, occluded:boolean,
):boolean {
  if (noise.at > now || now-noise.at > 1500) return false;
  if (Math.abs(listener[1]-noise.pos[1])>15) return false;
  return Math.hypot(listener[0]-noise.pos[0],listener[2]-noise.pos[2]) <=
    botNoiseRadius(noise,tier) * (occluded ? .55 : 1);
}
export function botRememberNoise(noise: BotNoise):BotAlert {
  return { sourceId:noise.sourceId,pos:[...noise.pos] as Vec3,at:noise.at,kind:noise.kind };
}
/** A hit gives a direction even from behind, not a through-wall firing solution. */
export function botRememberHit(sourceId:string, sourcePos:readonly [number,number,number], now:number):BotAlert {
  return {sourceId,pos:[...sourcePos] as Vec3,at:now,kind:"hit"};
}
export function botAlertInvestigation(
  alert:BotAlert|null|undefined, botPos:readonly [number,number,number], now:number,
  tier:BotTier,archetype:BotArchetype,sourceAlive:boolean,
):BotInvestigation|null {
  if(!alert || !sourceAlive || now<alert.at)return null;
  const life = alert.kind==="hit"?4500:alert.kind==="gunshot"?3100:1800;
  const scale:Record<BotTier,number>={easy:.75,normal:1,hard:1.15,veteran:1.25};
  if(now-alert.at>life*scale[tier])return null;
  const pos=[...alert.pos] as Vec3;
  const d=Math.hypot(pos[0]-botPos[0],pos[2]-botPos[2]);
  if(archetype==="marksman" || d<2.5)
    return {goal:[...botPos] as Vec3,lookAt:pos,kind:"watch"};
  return {goal:pos,lookAt:pos,kind:"approach"};
}
