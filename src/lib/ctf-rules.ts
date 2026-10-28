// Capture the Flag rules shared by the authoritative server and offline engine.
import {teamObjective,objectiveApproach,objectiveMap,type ObjectiveSource} from "./map-objectives";
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
export const CTF_CAPTURE_RADIUS = 4.7; // Covers the entire visible 4.25-radius delivery marker.
export const CTF_TREE_X = 94;
export const CTF_TREE_TOP = 12;
export const CTF_BASE_Z = 0; // Behind trunk on each outer end of the base-to-base axis.
export const CTF_DROP_RETURN_MS = 30_000;
export const CTF_RESET_OPTIONS = [0, 10000, 30000, 60000, 120000, -1] as const;
export function ctfResetMs(value: number | undefined): number {
  return value !== undefined && (CTF_RESET_OPTIONS as readonly number[]).includes(value) ? value : CTF_DROP_RETURN_MS;
}

export const ctfHome = (team:FlagTeam,mapId:ObjectiveSource="forest_warfare"):Vec3 =>
  [...(teamObjective(mapId,"flag",team)?.pos??[0,0,0])];
export const ctfBase = (team:FlagTeam,mapId:ObjectiveSource="forest_warfare"):Vec3 =>
  [...(teamObjective(mapId,"capture_zone",team)?.pos??[0,0,0])];
export const otherFlag = (team: FlagTeam): FlagTeam => team === "red" ? "blue" : "red";
export const ctfResetFlag = (team: FlagTeam, mapId:ObjectiveSource="forest_warfare"): CtfFlag =>
  ({team,pos:ctfHome(team,mapId),carrierId:null,dropped:false});
export const createCtfFlags = (mapId:ObjectiveSource="forest_warfare"): CtfFlags =>
  ({red:ctfResetFlag("red",mapId),blue:ctfResetFlag("blue",mapId)});
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
export function ctfReturnExpired(flags: CtfFlags, now = Date.now(), resetMs = CTF_DROP_RETURN_MS, mapId:ObjectiveSource = "forest_warfare"): FlagTeam[] {
  const returned: FlagTeam[] = [];
  if (resetMs === -1) return returned; // Never reset; touching remains available.
  for (const team of ["red", "blue"] as const) {
    const flag = flags[team];
    if (!flag.dropped || flag.droppedAt === undefined || now - flag.droppedAt < resetMs) continue;
    flags[team] = ctfResetFlag(team,mapId);
    returned.push(team);
  }
  return returned;
}
export function ctfTouch(flags: CtfFlags, player: { id: string; team: FlagTeam; pos: Vec3 }, mapId:ObjectiveSource="forest_warfare"):
  { kind: "pickup" | "return" | "capture"; flag: FlagTeam } | null {
  const own = flags[player.team], enemyTeam = otherFlag(player.team), enemy = flags[enemyTeam];
  // A returning carrier captures only when their own flag is safely home.
  if (enemy.carrierId === player.id && flagAtHome(own) &&
      ctfWithin(player.pos, ctfBase(player.team,mapId), teamObjective(mapId,"capture_zone",player.team)?.radius??CTF_CAPTURE_RADIUS, teamObjective(mapId,"capture_zone",player.team)?.verticalTolerance??3)) {
    flags[enemyTeam] = ctfResetFlag(enemyTeam,mapId);
    return { kind: "capture", flag: enemyTeam };
  }
  if (own.dropped && ctfWithin(player.pos, own.pos, teamObjective(mapId,"flag",player.team)?.radius??CTF_PICKUP_RADIUS, teamObjective(mapId,"flag",player.team)?.verticalTolerance??2.6)) {
    flags[player.team] = ctfResetFlag(player.team,mapId);
    return { kind: "return", flag: player.team };
  }
  if (!enemy.carrierId && ctfWithin(player.pos, enemy.pos, teamObjective(mapId,"flag",enemyTeam)?.radius??CTF_PICKUP_RADIUS, teamObjective(mapId,"flag",enemyTeam)?.verticalTolerance??2.6)) {
    enemy.carrierId = player.id; enemy.dropped = false; delete enemy.droppedAt;
    return { kind: "pickup", flag: enemyTeam };
  }
  return null;
}

/** Match objectives guide travel, but visible hostiles always override navigation.
 * Each bot has a stable lane and offset rather than marching on one exact point.
 */
export type CtfBotRole = "attack" | "defend_flag" | "defend_stairs" | "escort" | "recover";
export type CtfBotIntent = {role:CtfBotRole; goal:Vec3};
export function ctfEngageThreat(enemyDistance:number, weaponId:string):boolean {
  if(!Number.isFinite(enemyDistance))return false;
  const limit=weaponId.startsWith("sniper_")||weaponId.startsWith("dmr_")?55:
    weaponId.startsWith("shotgun_")?25:weaponId.startsWith("pistol_")?34:45;
  return enemyDistance<=limit;
}
export function ctfBotIntent(
  flags:CtfFlags, team:FlagTeam, id:string, pos:Vec3, weaponId:string,
  squadIds:readonly string[] = [], carriers:Readonly<Record<string,Vec3>> = {}, mapId:ObjectiveSource="forest_warfare",
):CtfBotIntent {
  const own=flags[team], enemyTeam=otherFlag(team), enemy=flags[enemyTeam];
  const home=ctfHome(team,mapId), enemyHome=ctfHome(enemyTeam,mapId);
  const hash=[...id].reduce((acc,ch)=>((acc*31+ch.charCodeAt(0))>>>0),7);
  const roster=[...squadIds].sort(),ix=roster.indexOf(id);
  const rank=ix>=0?ix:hash%9, lane=((hash+rank*7)%7)-3;
  const side=team==="red"?-1:1;
  const sniper=weaponId.startsWith("sniper_")||weaponId.startsWith("dmr_");
  // All roles immediately become recovery/interception assignments.
  if(own.carrierId || own.dropped) {
    const position=own.carrierId?carriers[own.carrierId]??own.pos:own.pos;
    const dist=Math.hypot(pos[0]-position[0],pos[2]-position[2]);
    if(dist>20)return {role:"recover",goal:[position[0]+side*6,position[1],position[2]+lane*4]};
    return {role:"recover",goal:[...position]};
  }
  if(enemy.dropped) {
    const dist=Math.hypot(pos[0]-enemy.pos[0],pos[2]-enemy.pos[2]);
    return {role:"escort",goal:dist>24?
      [enemy.pos[0]+side*5,enemy.pos[1],enemy.pos[2]+lane*4]:
      [...enemy.pos]};
  }
  if(enemy.carrierId) {
    if(enemy.carrierId===id)return {role:"escort",goal:ctfBase(team,mapId)};
    const carrier=carriers[enemy.carrierId];
    if(carrier) {
      const radius=6+Math.abs(lane)*2;
      return {role:"escort",goal:[
        carrier[0]+side*radius,carrier[1],carrier[2]+lane*6,
      ]};
    }
    return {role:"escort",goal:[ctfBase(team,mapId)[0]-side*6,0,lane*6]};
  }
  if(!teamObjective(mapId,"flag",team)?.approachLandings?.length){
    if(sniper||rank%4===0)return {role:"defend_flag",goal:[home[0]-side*5,Math.max(0,home[1]-.2),home[2]+lane*2]};
    return {role:"attack",goal:[enemyHome[0],Math.max(0,enemyHome[1]-.2),enemyHome[2]]};
  }
  // Default: long-range defenders stay on different edges of the high deck.
  if(sniper) {
    const angle=((hash%12)/12)*Math.PI*2;
    return {role:"defend_flag",goal:[
      home[0]+Math.cos(angle)*8.2,home[1],home[2]+Math.sin(angle)*8.2,
    ]};
  }
  if(rank%3===0)return {role:"defend_stairs",goal:[
    home[0]+lane*1.8,0,home[2]+(hash%2?28:-28)+(rank%3)*2,
  ]};
  // Alternate approach lanes across the valley before converging on the stairs.
  const approach=enemyHome[0]-Math.sign(enemyHome[0])*33;
  if(Math.abs(pos[0]-enemyHome[0])>42)return {role:"attack",goal:[
    approach,0,enemyHome[2]+lane*7.5,
  ]};
  return {role:"attack",goal:[...enemyHome]};
}
/** Elevated flags and defenders use the objective's saved stair entrances/landings. */
export function ctfStairWaypoint(goal:Vec3,pos:Vec3,mapId:ObjectiveSource="forest_warfare"):Vec3 {
  const objective=(objectiveMap(mapId).objectives??[]).find(o=>o.kind==="flag"&&
    Math.hypot(o.pos[0]-goal[0],o.pos[2]-goal[2])<12&&Math.abs(o.pos[1]-goal[1])<2);
  return objective?objectiveApproach({...objective,pos:goal},pos):[...goal];
}
export function ctfBotGoal(flags:CtfFlags,team:FlagTeam,id:string,pos:Vec3,mapId:ObjectiveSource="forest_warfare"):Vec3 {
  // Compatibility helper for non-squad simulation and existing navigation tests.
  const own=flags[team],enemy=flags[otherFlag(team)];
  if(enemy.carrierId===id) return ctfBase(team,mapId);
  if(own.dropped) return [...own.pos];
  if(enemy.carrierId) return ctfBase(otherFlag(team),mapId);
  return ctfStairWaypoint(enemy.pos,pos,mapId);
}
