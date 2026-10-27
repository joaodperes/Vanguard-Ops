// Capture the Flag rules shared by the authoritative server and offline engine.
import type { Vec3 } from "./game-protocol";

export type FlagTeam = "red" | "blue";
export interface CtfFlag {
  team: FlagTeam;
  pos: Vec3;
  carrierId: string | null;
  dropped: boolean;
  /** Authoritative wall-clock time for automatic recovery; absent while carried/home. */
  droppedAt?: number;
}
export type CtfFlags = { red: CtfFlag; blue: CtfFlag };
export const CTF_SPEED_MULTIPLIER = 1.10;
export const CTF_PICKUP_RADIUS = 2.4;
export const CTF_CAPTURE_RADIUS = 4;
export const CTF_TREE_X = 94;
export const CTF_TREE_TOP = 12;
export const CTF_BASE_Z = 18; // Behind the flag tree relative to the opposing base-to-base lane.
export const CTF_DROP_RETURN_MS = 30_000;
export const CTF_RESET_OPTIONS = [0, 10000, 30000, 60000, 120000, -1] as const;
export function ctfResetMs(value: number | undefined): number {
  return value !== undefined && (CTF_RESET_OPTIONS as readonly number[]).includes(value) ? value : CTF_DROP_RETURN_MS;
}

export const ctfHome = (team: FlagTeam): Vec3 =>
  [team === "red" ? -CTF_TREE_X : CTF_TREE_X, CTF_TREE_TOP + 0.2, 0];
export const ctfBase = (team: FlagTeam): Vec3 =>
  [team === "red" ? -CTF_TREE_X : CTF_TREE_X, 0, CTF_BASE_Z];
export const otherFlag = (team: FlagTeam): FlagTeam => team === "red" ? "blue" : "red";
export const ctfResetFlag = (team: FlagTeam): CtfFlag =>
  ({ team, pos: ctfHome(team), carrierId: null, dropped: false });
export const createCtfFlags = (): CtfFlags => ({red:ctfResetFlag("red"),blue:ctfResetFlag("blue")});
export const flagAtHome = (flag: CtfFlag): boolean => !flag.dropped && flag.carrierId === null;
export const ctfWithin = (a: Vec3, b: Vec3, radius: number, vertical = 2.6): boolean =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) <= radius && Math.abs(a[1] - b[1]) <= vertical;
export function ctfDrop(flags: CtfFlags, carrierId: string, pos: Vec3, now = Date.now()): FlagTeam | null {
  for (const team of ["red", "blue"] as const) {
    const flag = flags[team];
    if (flag.carrierId !== carrierId) continue;
    flag.pos = [...pos]; flag.carrierId = null; flag.dropped = true; flag.droppedAt = now;
    return team;
  }
  return null;
}
/** Timed recovery is server-authoritative online and uses the same rule offline. */
export function ctfReturnExpired(flags: CtfFlags, now = Date.now(), resetMs = CTF_DROP_RETURN_MS): FlagTeam[] {
  const returned: FlagTeam[] = [];
  if (resetMs === -1) return returned; // Never reset; touching remains available.
  for (const team of ["red", "blue"] as const) {
    const flag = flags[team];
    if (!flag.dropped || flag.droppedAt === undefined || now - flag.droppedAt < resetMs) continue;
    flags[team] = ctfResetFlag(team);
    returned.push(team);
  }
  return returned;
}
export function ctfTouch(flags: CtfFlags, player: { id: string; team: FlagTeam; pos: Vec3 }):
  { kind: "pickup" | "return" | "capture"; flag: FlagTeam } | null {
  const own = flags[player.team], enemyTeam = otherFlag(player.team), enemy = flags[enemyTeam];
  // A returning carrier captures only when their own flag is safely home.
  if (enemy.carrierId === player.id && flagAtHome(own) &&
      ctfWithin(player.pos, ctfBase(player.team), CTF_CAPTURE_RADIUS, 3)) {
    flags[enemyTeam] = ctfResetFlag(enemyTeam);
    return { kind: "capture", flag: enemyTeam };
  }
  if (own.dropped && ctfWithin(player.pos, own.pos, CTF_PICKUP_RADIUS)) {
    flags[player.team] = ctfResetFlag(player.team);
    return { kind: "return", flag: player.team };
  }
  if (!enemy.carrierId && ctfWithin(player.pos, enemy.pos, CTF_PICKUP_RADIUS)) {
    enemy.carrierId = player.id; enemy.dropped = false; delete enemy.droppedAt;
    return { kind: "pickup", flag: enemyTeam };
  }
  return null;
}

/** Roles stay deterministic across server/client and across respawns. */
export type CtfBotRole = "attack" | "defend_flag" | "defend_stairs" | "escort" | "recover";
export type CtfBotIntent = {role:CtfBotRole; goal:Vec3};
export function ctfBotIntent(
  flags:CtfFlags, team:FlagTeam, id:string, pos:Vec3, weaponId:string,
  squadIds:readonly string[] = [], carriers: Readonly<Record<string,Vec3>> = {},
):CtfBotIntent {
  const own=flags[team], enemyTeam=otherFlag(team), enemy=flags[enemyTeam];
  const home=ctfHome(team), enemyHome=ctfHome(enemyTeam);
  const hash=[...id].reduce((acc,ch)=>((acc*31+ch.charCodeAt(0))>>>0),7);
  const sniper=weaponId.startsWith("sniper_")||weaponId.startsWith("dmr_");
  const rank=Math.max(0,[...squadIds].sort().indexOf(id));
  // Emergency: every available fighter intercepts the thief or recovers our drop.
  if(own.carrierId || own.dropped) {
    const carrier=own.carrierId?carriers[own.carrierId]:undefined;
    return {role:"recover",goal:[...(own.dropped?own.pos:carrier??own.pos)]};
  }
  // Escort and retrieval must outrank idle defense, including when an ally dies.
  if(enemy.dropped) return {role:"escort",goal:[...enemy.pos]};
  if(enemy.carrierId) {
    if(enemy.carrierId===id) return {role:"escort",goal:ctfBase(team)};
    const carrier=carriers[enemy.carrierId];
    if(carrier) {
      // Flank with teammates rather than stacking directly on carrier.
      const offset=(rank%3-1)*4;
      return {role:"escort",goal:[carrier[0]+(team==="red"?-4:4),carrier[1],carrier[2]+offset]};
    }
    return {role:"escort",goal:ctfBase(team)};
  }
  // Default split: long-range weapons watch from the deck, some other
  // weapons cover stairs, and the remainder attack the opposite flag.
  if(sniper) return {role:"defend_flag",goal:[home[0]+((hash%3)-1)*4,home[1],home[2]+((hash%2)?3:-3)]};
  if(rank%3===0) return {role:"defend_stairs",goal:[home[0],0,(hash%2?28:-28)]};
  return {role:"attack",goal:enemyHome};
}
/** Translate an elevated goal into a navigable staircase approach. */
export function ctfStairWaypoint(goal:Vec3, pos:Vec3):Vec3 {
  if(goal[1]<=CTF_TREE_TOP/2 || pos[1]>=CTF_TREE_TOP-.7) return [...goal];
  const x=goal[0];
  const side=pos[2]<0?-1:1;
  const climbing=Math.abs(pos[0]-x)<7 && Math.abs(pos[2])>8 && Math.abs(pos[2])<36;
  return climbing?[x,CTF_TREE_TOP,side*8.7]:[x,0,side*34.5];
}
export function ctfBotGoal(flags:CtfFlags,team:FlagTeam,id:string,pos:Vec3):Vec3 {
  // Compatibility helper for non-squad simulation and existing navigation tests.
  const own=flags[team],enemy=flags[otherFlag(team)];
  if(enemy.carrierId===id) return ctfBase(team);
  if(own.dropped) return [...own.pos];
  if(enemy.carrierId) return ctfBase(otherFlag(team));
  return ctfStairWaypoint(enemy.pos,pos);
}
