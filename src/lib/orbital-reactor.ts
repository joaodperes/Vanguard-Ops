/** Shared match-only Orbital Nexus reactor and melee-reward rules. */
import type {Vec3} from "./game-protocol";
import type {WeaponDef} from "./game-data";
export const ORBITAL_REAPER_ID="orbital_reaper";
export const ORBITAL_KILLS_REQUIRED=5;
export const ORBITAL_PICKUP_RADIUS=3.5;
export const ORBITAL_PLATFORM_Y=3.2;
export const ORBITAL_REAPER:WeaponDef={
  id:ORBITAL_REAPER_ID,name:"Nexus Reaper",category:"melee",unlockLevel:0,unlockCost:0,
  description:"Reactor-forged plasma glaive; temporary and lost on death.",attachments:[],
  stats:{damage:120,fireRate:1.55,magSize:1,reloadTime:0,spread:0,adsSpread:0,
    recoil:0,range:1.9,adsTime:.15,moveSpeed:1.02,auto:false,headshotMult:1},
};
export function orbitalRecordKill(charge:number,pos:readonly number[],mapId:string):number {
  return mapId==="orbital_nexus"&&pos.length===3&&pos.every(Number.isFinite)&&
    Math.hypot(pos[0],pos[2])<=30?Math.min(ORBITAL_KILLS_REQUIRED,charge+1):charge;
}
export function orbitalCanClaim(charge:number,pos:Vec3,mapId:string,alive:boolean):boolean {
  return mapId==="orbital_nexus"&&alive&&charge>=ORBITAL_KILLS_REQUIRED&&
    Math.hypot(pos[0],pos[2])<=ORBITAL_PICKUP_RADIUS&&
    pos[1]>=ORBITAL_PLATFORM_Y-.65&&pos[1]<=ORBITAL_PLATFORM_Y+2.6;
}
export const orbitalGravity=(id:string)=>id==="orbital_nexus"?.6:1;
