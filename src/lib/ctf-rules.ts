// Capture the Flag rules shared by the authoritative server and offline engine.
import {CTF_LAYOUTS} from "./ctf-layouts";
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
/** The flag already grants a 10% escape bonus. Do not stack a faster weapon\x27s
 * (especially melee\x27s) mobility bonus on top of that while carrying.
 * Ordinary melee movement and combat remain unchanged outside carrying. */
export function ctfCarrierWeaponSpeed(weaponSpeed:number,carrying:boolean):number {
  return carrying ? Math.min(1,weaponSpeed) : weaponSpeed;
}
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
export function ctfEngageThreat(enemyDistance:number, weaponId:string, overtime=false):boolean {
  if(!Number.isFinite(enemyDistance))return false;
  const limit=weaponId.startsWith("sniper_")||weaponId.startsWith("dmr_")?55:
    weaponId.startsWith("shotgun_")?25:weaponId.startsWith("pistol_")?34:45;
  // Sudden death: only a nearby opponent interrupts a flag run. Long-range
  // contacts shouldn't tie up an entire squad in skirmishes forever.
  return enemyDistance<=(overtime?Math.min(limit,18):limit);
}
export function ctfBotIntent(
  flags:CtfFlags, team:FlagTeam, id:string, pos:Vec3, weaponId:string,
  squadIds:readonly string[] = [], carriers:Readonly<Record<string,Vec3>> = {}, mapId:ObjectiveSource="forest_warfare",
  now=Date.now(), overtime=false,
):CtfBotIntent {
  const own=flags[team], enemyTeam=otherFlag(team), enemy=flags[enemyTeam];
  const home=ctfHome(team,mapId), enemyHome=ctfHome(enemyTeam,mapId);
  const hash=[...id].reduce((acc,ch)=>((acc*31+ch.charCodeAt(0))>>>0),7);
  const roster=[...squadIds].sort(),ix=roster.indexOf(id);
  const rank=ix>=0?ix:hash%9, lane=((hash+rank*7)%7)-3;
  const side=team==="red"?-1:1;
  // Rotate the small defensive shift every 45 seconds: even marksmen must
  // participate in attacks. Small teams have NO permanent guards, preventing
  // 1v1/2v2 CTF matches from stalling on their own bases.
  const guardSlots=roster.length>=5?Math.max(1,Math.floor(roster.length/5)):0;
  const defending=!overtime && guardSlots>0 &&
    (rank+Math.floor(now/45000))%roster.length<guardSlots;
  // Stagger patrol phases so overwatch bots sweep approaches instead of clustering.
  const phase=Math.floor((now+(hash%4000))/9000)%3;
  // A flag carrier always heads to their capture zone, even when their own
  // flag was stolen. Teammates must handle the interception; sending the
  // carrier back into that fight can prevent either team from scoring.
  if(enemy.carrierId===id)return {role:"escort",goal:ctfBase(team,mapId)};
  // All other roles immediately become recovery/interception assignments.
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
    const carrier=carriers[enemy.carrierId];
    if(carrier) {
      const radius=6+Math.abs(lane)*2;
      return {role:"escort",goal:[
        carrier[0]+side*radius,carrier[1],carrier[2]+lane*6,
      ]};
    }
    return {role:"escort",goal:[ctfBase(team,mapId)[0]-side*6,0,ctfBase(team,mapId)[2]+lane*6]};
  }
  // Sudden-death CTF has no static guards (defending=false), but attackers
  // still follow each map's flank/stair routes instead of taking an impossible
  // straight line to the flag through walls or floodgate structures.
  const mapKey=typeof mapId==="string"?mapId:"id" in mapId?String(mapId.id):"";
  if(CTF_LAYOUTS[mapKey]){
    // The rotating rear guard holds an advanced interception lane; the rest
    // push the enemy objective even with a marksman weapon.
    if(defending){
      const towardX=enemyHome[0]-home[0],towardZ=enemyHome[2]-home[2];
      const length=Math.hypot(towardX,towardZ)||1;
      const forwardX=towardX/length,forwardZ=towardZ/length;
      const flankX=-forwardZ,flankZ=forwardX;
      const flank=(rank%2===0?1:-1)*(10+rank%3*4)+(phase===0?-4:phase===2?4:0);
      const forward=Math.min(42,Math.max(18,length*.32))+(phase-1)*4;
      return {role:"defend_flag",goal:[home[0]+forwardX*forward+flankX*flank,home[1],home[2]+forwardZ*forward+flankZ*flank]};
    }
    return {role:"attack",goal:[...enemyHome]};
  }
  if(mapKey==="floodgate"){
    // Ground-level flags need neither forest stairs nor orbital launch routing.
    // Advance the rotating guard to the midfield approaches.
    if(defending)return {role:"defend_flag",goal:[home[0]-side*(phase===1?32:25),0,(rank%2===0?1:-1)*(phase===0?24:phase===1?13:30)]};
    const flankZ=[-66,0,66][rank%3];
    if(Math.abs(pos[0]-enemyHome[0])>38)return {role:"attack",goal:[enemyHome[0]-Math.sign(enemyHome[0])*24,0,flankZ]};
    return {role:"attack",goal:[...enemyHome]};
  }
  if(!teamObjective(mapId,"flag",team)?.approachLandings?.length){
    if(defending)return {role:"defend_flag",goal:[
      home[0]+(enemyHome[0]-home[0])*.30,Math.max(0,home[1]-.2),
      home[2]+(enemyHome[2]-home[2])*.30+lane*3]};
    return {role:"attack",goal:[enemyHome[0],Math.max(0,enemyHome[1]-.2),enemyHome[2]]};
  }
  // On raised-tree maps the rotating guard watches the *forward* stair
  // approach. Snipers are not automatically tied to the base all match.
  if(defending)return {role:"defend_stairs",goal:[
    home[0]+lane*1.8-side*(phase===1?22:14),0,(hash%2?28:-28)+(phase===0?-5:phase===2?5:0),
  ]};
  // Alternate approach lanes across the valley before converging on the stairs.
  const approach=enemyHome[0]-Math.sign(enemyHome[0])*33;
  if(Math.abs(pos[0]-enemyHome[0])>42)return {role:"attack",goal:[
    approach,0,enemyHome[2]+lane*7.5,
  ]};
  return {role:"attack",goal:[...enemyHome]};
}
/** Defenders look into incoming lanes, not back at their own flag. */
export function ctfDefenderScanYaw(team:FlagTeam,pos:Vec3,id:string,mapId="forest_warfare",now=Date.now()):number {
  const opposing=ctfHome(otherFlag(team),mapId);
  const hash=[...id].reduce((acc,ch)=>((acc*31+ch.charCodeAt(0))>>>0),7);
  const direction=Math.atan2(opposing[0]-pos[0],opposing[2]-pos[2]);
  return direction+Math.sin(now/2400+(hash%23))*.43;
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
