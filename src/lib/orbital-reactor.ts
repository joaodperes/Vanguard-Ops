/** Shared match-only Orbital Nexus reactor and melee-reward rules. */
import {reactorObjective,objectiveApproach,objectiveMap,objectiveDistance,type ObjectiveSource} from "./map-objectives";
import type {Vec3} from "./game-protocol";
import type {WeaponDef} from "./game-data";
export const ORBITAL_REAPER_ID="orbital_reaper";
/** Bump when the authoritative reactor protocol or eligibility rule changes. */
export const ORBITAL_RULES_VERSION=5;
export const ORBITAL_KILLS_REQUIRED=10;
/** HUD status: keep progress while charging, then show readiness instead of 10/10. */
export function orbitalChargeLabel(charge:number,required:number=ORBITAL_KILLS_REQUIRED):string {
  return charge>=required ? "Reactor fully charged" : `Reactor ${charge}/${required}`;
}
/** Flat X/Z radius around the central reactor; flag bases remain outside it. */
export const ORBITAL_CHARGE_RADIUS=38;
export const ORBITAL_PICKUP_RADIUS=3.5;
/** Only equipped Reaper (slot 3) receives special movement effects. */
export const ORBITAL_PULSE_RADIUS=4.75;
export const ORBITAL_PULSE_DAMAGE=58;
export const ORBITAL_REAPER_SPEED_MULTIPLIER=1.25;
export const ORBITAL_REAPER_STAMINA_DRAIN_MULTIPLIER=.53;
export const ORBITAL_REAPER_GRAVITY_MULTIPLIER=.7;
export const ORBITAL_REAPER_JUMP_MOMENTUM_MULTIPLIER=1.55;
export function orbitalReaperEquipped(mapId:ObjectiveSource,weaponId:string):boolean {
  return !!reactorObjective(mapId)&&weaponId===ORBITAL_REAPER_ID;
}
/** Pulse hits every eligible enemy in a circular zone, even if the blade
 * misses. No team damage, no spawn protection bypass, no double strike.
 */
export function orbitalPulseTargets(
  origin:readonly number[],
  candidates:readonly {id:string;pos:readonly number[];alive:boolean;friendly?:boolean;protected?:boolean}[],
  blocked:(pos:readonly number[])=>boolean=()=>false,
  excluded:readonly string[]=[],
):string[] {
  if(origin.length!==3||!origin.every(Number.isFinite))return [];
  return candidates.filter(c=>c.alive&&!c.friendly&&!c.protected&&!excluded.includes(c.id)&&
    c.pos.length===3&&c.pos.every(Number.isFinite)&&
    Math.abs(origin[1]-c.pos[1])<=2.8&&
    Math.hypot(origin[0]-c.pos[0],origin[2]-c.pos[2])<=ORBITAL_PULSE_RADIUS&&
    !blocked(c.pos)).map(c=>c.id);
}
export const ORBITAL_PLATFORM_Y=3.2;
/** A missing/older rules version means the multiplayer server was not restarted
 * after gameplay updates. Show an explicit error instead of a false 0/5.
 */
export function orbitalServerWarning(
  mapId:ObjectiveSource,online:boolean,serverVersion:number|undefined,
):string|undefined {
  if(!online||!reactorObjective(mapId))return undefined;
  return serverVersion===ORBITAL_RULES_VERSION?undefined:
    "REACTOR UNAVAILABLE — multiplayer server is running outdated rules. Restart/redeploy the game server and start a new match.";
}

export const ORBITAL_REAPER:WeaponDef={
  id:ORBITAL_REAPER_ID,name:"Nexus Reaper",category:"melee",unlockLevel:0,unlockCost:0,
  description:"Reactor-forged plasma glaive; temporary and lost on death.",attachments:[],
  stats:{damage:120,fireRate:1.55,magSize:1,reloadTime:0,spread:0,adsSpread:0,
    recoil:0,range:3.5,adsTime:.15,moveSpeed:1.02,auto:false,headshotMult:1},
};
/** A legitimate enemy elimination charges when EITHER fighter is in the
 * central zone. Standing on the raised reactor deck and shooting opponents
 * near a flag base counts, as does sniping enemies who are inside the zone.
 * The radius is measured horizontally; elevation is not restricted.
 *
 * Kill attribution / team checks are enforced by offline and server callers.
 */
export function orbitalRecordKill(
  charge:number,victimPos:readonly number[],mapId:ObjectiveSource,killerPos?:readonly number[],
):number {
  if(!reactorObjective(mapId)||victimPos.length!==3||!victimPos.every(Number.isFinite))return charge;
  const reactor=reactorObjective(mapId)!;
  const within=(pos:readonly number[])=>pos.length===3&&pos.every(Number.isFinite)&&
    objectiveDistance(mapId,pos)<=reactor.chargeRadius;
  return within(victimPos)||(killerPos!==undefined&&within(killerPos))
    ?Math.min(reactor.killsRequired,charge+1):charge;
}
export function orbitalCanClaim(charge:number,pos:Vec3,mapId:ObjectiveSource,alive:boolean):boolean {
  const reactor=reactorObjective(mapId);
  return !!reactor&&alive&&charge>=reactor.killsRequired&&
    objectiveDistance(mapId,pos)<=reactor.radius&&
    pos[1]>=reactor.pos[1]-.65&&pos[1]<=reactor.pos[1]+reactor.verticalTolerance;
}
export const orbitalGravity=(id:ObjectiveSource,weaponId?:string)=>(objectiveMap(id).gravityScale??1)*
  (reactorObjective(id)&&weaponId===ORBITAL_REAPER_ID?ORBITAL_REAPER_GRAVITY_MULTIPLIER:1);

/** Each team sends its nearest eligible bot; flag carriers stay on objective. */
export interface OrbitalBotCandidate {
 id:string;team:string;pos:Vec3;alive:boolean;carryingFlag?:boolean;hasReward?:boolean;
}
export function orbitalBotShouldContest(
 mapId:ObjectiveSource,charge:number,bot:OrbitalBotCandidate,roster:readonly OrbitalBotCandidate[],
 threatDistance:number,
):boolean {
 if(!reactorObjective(mapId)||charge<(reactorObjective(mapId)?.killsRequired??Infinity)||
 !bot.alive||bot.carryingFlag||bot.hasReward||threatDistance<=12)return false;
 const eligible=roster.filter(c=>c.team===bot.team&&c.alive&&!c.carryingFlag&&!c.hasReward)
  .sort((a,b)=>objectiveDistance(mapId,a.pos)-objectiveDistance(mapId,b.pos)||
   a.id.localeCompare(b.id));
 return eligible[0]?.id===bot.id;
}
/** The reactor deck stairs start near Z ±13; avoid running under the platform. */
export function orbitalBotDeckGoal(pos:Vec3,team:string,mapId:ObjectiveSource="orbital_nexus"):Vec3 {
 const reactor=reactorObjective(mapId);
 return reactor?objectiveApproach(reactor,pos):[...pos];
}
