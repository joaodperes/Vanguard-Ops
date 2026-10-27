/** Shared match-only Orbital Nexus reactor and melee-reward rules. */
import type {Vec3} from "./game-protocol";
import type {WeaponDef} from "./game-data";
export const ORBITAL_REAPER_ID="orbital_reaper";
export const ORBITAL_KILLS_REQUIRED=5;
/** Flat X/Z radius around the central reactor; flag bases remain outside it. */
export const ORBITAL_CHARGE_RADIUS=55;
export const ORBITAL_PICKUP_RADIUS=3.5;
export const ORBITAL_PLATFORM_Y=3.2;
export const ORBITAL_REAPER:WeaponDef={
  id:ORBITAL_REAPER_ID,name:"Nexus Reaper",category:"melee",unlockLevel:0,unlockCost:0,
  description:"Reactor-forged plasma glaive; temporary and lost on death.",attachments:[],
  stats:{damage:120,fireRate:1.55,magSize:1,reloadTime:0,spread:0,adsSpread:0,
    recoil:0,range:1.9,adsTime:.15,moveSpeed:1.02,auto:false,headshotMult:1},
};
/** A legitimate enemy elimination charges when EITHER fighter is in the
 * central zone. Standing on the raised reactor deck and shooting opponents
 * near a flag base counts, as does sniping enemies who are inside the zone.
 * The radius is measured horizontally; elevation is not restricted.
 *
 * Kill attribution / team checks are enforced by offline and server callers.
 */
export function orbitalRecordKill(
  charge:number,victimPos:readonly number[],mapId:string,killerPos?:readonly number[],
):number {
  if(mapId!=="orbital_nexus"||victimPos.length!==3||!victimPos.every(Number.isFinite))return charge;
  const within=(pos:readonly number[])=>pos.length===3&&pos.every(Number.isFinite)&&
    Math.hypot(pos[0],pos[2])<=ORBITAL_CHARGE_RADIUS;
  return within(victimPos)||(killerPos!==undefined&&within(killerPos))
    ?Math.min(ORBITAL_KILLS_REQUIRED,charge+1):charge;
}
export function orbitalCanClaim(charge:number,pos:Vec3,mapId:string,alive:boolean):boolean {
  return mapId==="orbital_nexus"&&alive&&charge>=ORBITAL_KILLS_REQUIRED&&
    Math.hypot(pos[0],pos[2])<=ORBITAL_PICKUP_RADIUS&&
    pos[1]>=ORBITAL_PLATFORM_Y-.65&&pos[1]<=ORBITAL_PLATFORM_Y+2.6;
}
export const orbitalGravity=(id:string)=>id==="orbital_nexus"?.6:1;

/** Each team sends its nearest eligible bot; flag carriers stay on objective. */
export interface OrbitalBotCandidate {
 id:string;team:string;pos:Vec3;alive:boolean;carryingFlag?:boolean;hasReward?:boolean;
}
export function orbitalBotShouldContest(
 mapId:string,charge:number,bot:OrbitalBotCandidate,roster:readonly OrbitalBotCandidate[],
 threatDistance:number,
):boolean {
 if(mapId!=="orbital_nexus"||charge<ORBITAL_KILLS_REQUIRED||
 !bot.alive||bot.carryingFlag||bot.hasReward||threatDistance<=12)return false;
 const eligible=roster.filter(c=>c.team===bot.team&&c.alive&&!c.carryingFlag&&!c.hasReward)
  .sort((a,b)=>Math.hypot(a.pos[0],a.pos[2])-Math.hypot(b.pos[0],b.pos[2])||
   a.id.localeCompare(b.id));
 return eligible[0]?.id===bot.id;
}
/** The reactor deck stairs start near Z ±13; avoid running under the platform. */
export function orbitalBotDeckGoal(pos:Vec3,team:string):Vec3 {
 const side=pos[2]===0?(team==="red"?-1:1):Math.sign(pos[2]);
 const entry=side*13;
 if(pos[1]>=ORBITAL_PLATFORM_Y-.65||
   (Math.abs(pos[0])<=2.4&&Math.abs(pos[2]-entry)<=3))return [0,ORBITAL_PLATFORM_Y,0];
 return [0,0,entry];
}
