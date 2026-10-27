import { totalXpForLevel, MAX_PLAYER_LEVEL } from "./progression";
import { weaponById, type WeaponCategory } from "./game-data";

/** Five long-running objectives are offered per cycle; any three can be claimed. */
export const CAREER_REQUIRED_COMPLETIONS = 3;
export const CAREER_CONTRACTS = [
  { id:"fresh_xp", title:"Career Soldier", description:"Earn fresh XP after reaching level 40", goal:100000 },
  { id:"headshots", title:"Deadeye", description:"Land headshots in completed matches", goal:250 },
  { id:"wins", title:"Untouchable", description:"Win non-Survival matches", goal:50 },
  { id:"survival30", title:"Survival Legend", description:"Finish Survival runs reaching wave 30 or above", goal:10 },
  { id:"single_headshots", title:"One-Man Army", description:"Get at least 20 headshots in one match", goal:1 },
  ...(["assault","smg","shotgun","dmr","sniper","lmg","pistol","pdw","launcher"] as WeaponCategory[])
    .map(category=>({id:`kills_${category}`,title:`${category.toUpperCase()} Veteran`,
      description:`Get kills using ${category.toUpperCase()} weapons`, goal:100})),
] as const;
export type CareerContractId = (typeof CAREER_CONTRACTS)[number]["id"];
const POOLS: readonly CareerContractId[][] = [
  ["fresh_xp","headshots","wins","kills_assault","kills_smg"],
  ["fresh_xp","survival30","kills_dmr","kills_shotgun","single_headshots"],
  ["fresh_xp","headshots","wins","kills_pistol","kills_sniper"],
  ["fresh_xp","survival30","kills_lmg","kills_pdw","kills_launcher"],
];

/** Rotate objectives, scale goals moderately, and never silently overwrite started cycles. */
export function careerContractOffer(cycle:number) {
  const ids=POOLS[Math.max(0,cycle)%POOLS.length];
  const factor=1+Math.min(Math.max(0,cycle),10)*0.2;
  return ids.map(id=>{
    const spec=CAREER_CONTRACTS.find(def=>def.id===id)!;
    return {...spec,goal:spec.id==="single_headshots" ? 1 : Math.ceil(spec.goal*factor)};
  });
}
export function freshCareerXp(previousXp:number,earnedXp:number):number {
  const cap=totalXpForLevel(MAX_PLAYER_LEVEL);
  return Math.max(0,previousXp+Math.max(0,earnedXp)-Math.max(previousXp,cap));
}
export interface CareerMatchEvidence {
  mode:string; won:boolean; kills:number; headshots:number; survivalWaves?:number;
  weaponId?:string; perWeaponKills?:Record<string,{kills:number;headshots:number}>;
}
export function careerContractDelta(id:string, match:CareerMatchEvidence, freshXp:number):number {
  if(id==="fresh_xp")return Math.max(0,Math.floor(freshXp));
  if(id==="headshots")return Math.max(0,Math.floor(match.headshots));
  if(id==="wins")return match.mode!=="survival"&&match.won?1:0;
  if(id==="survival30")return match.mode==="survival"&&match.won&&(match.survivalWaves??0)>=30?1:0;
  if(id==="single_headshots")return match.headshots>=20?1:0;
  if(id.startsWith("kills_")){
    const category=id.slice("kills_".length);
    const perWeapon=match.perWeaponKills??{[match.weaponId??"rifle_ar"]:{kills:match.kills,headshots:match.headshots}};
    return Object.entries(perWeapon).reduce((sum,[weaponId,stats])=>
      sum+(weaponById(weaponId).id===weaponId&&weaponById(weaponId).category===category?Math.max(0,Math.floor(stats.kills)):0),0);
  }
  return 0;
}
