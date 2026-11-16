// Run-only Survival upgrades. Both the authoritative server and offline engine use
// these rules, so the same build behaves consistently in solo and co-op play.
export const SURVIVAL_UPGRADES = [
  {id:"precision_loop",name:"Precision Loop",category:"specialist",rarity:"advanced",description:"Headshot kills replenish rounds in the equipped magazine."},
  {id:"salvage",name:"Ammo Salvage",category:"specialist",rarity:"standard",description:"Kills return a few rounds to your equipped magazine."},
  {id:"head_hunter",name:"Head Hunter",category:"offense",rarity:"standard",description:"Deal more headshot damage."},
  {id:"point_blank",name:"Point Blank",category:"offense",rarity:"advanced",description:"Deal more damage to enemies within 12 meters."},
  {id:"longshot",name:"Longshot",category:"offense",rarity:"advanced",description:"Deal more damage to enemies at least 25 meters away."},
  {id:"steady_focus",name:"Steady Focus",category:"offense",rarity:"standard",description:"Deal more damage while aiming down sights."},
  {id:"glass_cannon",name:"Glass Cannon",category:"offense",rarity:"signature",description:"Deal much more damage, but take more damage too."},
  {id:"last_stand",name:"Last Stand",category:"offense",rarity:"advanced",description:"Deal more damage while below 40% health."},
  {id:"boss_hunter",name:"Boss Hunter",category:"offense",rarity:"advanced",description:"Deal extra damage against Survival bosses."},
  {id:"blood_rush",name:"Blood Rush",category:"offense",rarity:"signature",description:"A kill boosts your damage for five seconds."},
  {id:"executioner",name:"Executioner",category:"offense",rarity:"signature",description:"A headshot kill boosts your damage for five seconds."},
  {id:"steel_skin",name:"Steel Skin",category:"defense",rarity:"standard",description:"Reduce incoming combat damage."},
  {id:"blast_guard",name:"Blast Guard",category:"defense",rarity:"standard",description:"Reduce incoming explosive damage."},
  {id:"unyielding",name:"Unyielding",category:"defense",rarity:"advanced",description:"Take less damage below 40% health."},
  {id:"evasive",name:"Evasive",category:"defense",rarity:"advanced",description:"Take less damage while sprinting."},
  {id:"combat_medic",name:"Combat Medic",category:"defense",rarity:"advanced",description:"Restore a little health on each kill."},
  {id:"surgical_precision",name:"Surgical Precision",category:"defense",rarity:"signature",description:"Headshot kills restore additional health."},
  {id:"quick_recovery",name:"Quick Recovery",category:"defense",rarity:"standard",description:"Health regeneration begins sooner."},
  {id:"vitality",name:"Vitality",category:"defense",rarity:"standard",description:"Health regenerates more quickly."},
  {id:"fast_hands",name:"Fast Hands",category:"specialist",rarity:"standard",description:"Reload magazines and individual shells faster."},
  {id:"overclock",name:"Overclock",category:"specialist",rarity:"advanced",description:"Reload faster for five seconds after a kill."},
  {id:"light_footed",name:"Light Footed",category:"mobility",rarity:"standard",description:"Increase movement speed."},
  {id:"adrenaline",name:"Adrenaline",category:"mobility",rarity:"signature",description:"Kills grant a temporary movement-speed boost."},
  {id:"fresh_start",name:"Fresh Start",category:"defense",rarity:"standard",description:"Restore health when the next wave begins."},
  {id:"self_revive",name:"Self-Revive",category:"defense",rarity:"signature",description:"Once per wave, a lethal hit downs you for 30 seconds. Kill an enemy with your secondary weapon to revive with 35 HP. Boss-wave reward only."},
] as const;
export type SurvivalUpgradeId = typeof SURVIVAL_UPGRADES[number]["id"];
export type SurvivalUpgradeRanks = Partial<Record<SurvivalUpgradeId, number>>;
export interface SurvivalUpgradeOffer {wave: number; choices: SurvivalUpgradeId[]; rerollsRemaining: number}
export const SURVIVAL_UPGRADE_INTERVAL = 5;
export const SURVIVAL_UPGRADE_PREP_SEC = 5;
export const SURVIVAL_SELF_REVIVE_MS = 30000;
export const SURVIVAL_SELF_REVIVE_HP = 35;
export function canUseSelfRevive(ranks: SurvivalUpgradeRanks, usedWave: number, currentWave: number): boolean {
  return upgradeRank(ranks, "self_revive") > 0 && currentWave > 0 && usedWave !== currentWave;
}
export function survivalUpgradeDue(completedWave: number): boolean {
  return completedWave >= 4 && (completedWave - 4) % SURVIVAL_UPGRADE_INTERVAL === 0;
}
export function upgradeRank(ranks: SurvivalUpgradeRanks, id: SurvivalUpgradeId): number {
  return Math.max(0, Math.floor(ranks[id] ?? 0));
}
// No rank/slot cap: logarithmic scaling keeps indefinite runs interesting
// without allowing linear damage resistance or health recovery exploits.
function power(ranks: SurvivalUpgradeRanks, id: SurvivalUpgradeId): number {
  return Math.log2(1 + upgradeRank(ranks,id));
}
export function chooseSurvivalUpgrade(ranks: SurvivalUpgradeRanks, id: SurvivalUpgradeId): SurvivalUpgradeRanks {
  if (!SURVIVAL_UPGRADES.some(u=>u.id===id) || (id==="self_revive" && upgradeRank(ranks,id)>0)) return ranks;
  return {...ranks,[id]:upgradeRank(ranks,id)+1};
}
export function generateSurvivalUpgradeChoices(
  ranks: SurvivalUpgradeRanks, random: () => number = Math.random,
  exclude: readonly SurvivalUpgradeId[] = [],
  bossReward = false,
): SurvivalUpgradeId[] {
  // The special appears once per run, as a guaranteed choice when a boss falls.
  // It cannot be obtained from normal rewards or repeatedly ranked up.
  const includeRevive = bossReward && !upgradeRank(ranks,"self_revive") && !exclude.includes("self_revive");
  const pool = SURVIVAL_UPGRADES.filter(u=>u.id!=="self_revive" && !exclude.includes(u.id)).map(u=>({
    id:u.id,
    weight:(u.rarity==="signature"?.28:u.rarity==="advanced"?.75:1.25) *
      (upgradeRank(ranks,u.id)>0?1.65:1),
  }));
  const result:SurvivalUpgradeId[]=includeRevive?["self_revive"]:[];
  for(let i=result.length;i<3&&pool.length;i++){
    const total=pool.reduce((sum,u)=>sum+u.weight,0);
    let roll=Math.max(0,Math.min(.999999,random()))*total;
    let index=pool.findIndex(u=>(roll-=u.weight)<0);
    if(index<0)index=pool.length-1;
    result.push(pool.splice(index,1)[0].id);
  }
  return result;
}
export interface SurvivalAttackContext {
  headshot?: boolean; distance?: number; boss?: boolean; aiming?: boolean;
  healthFraction?: number; sinceKillMs?: number; sinceHeadshotKillMs?: number;
}
export function survivalOutgoingMultiplier(ranks: SurvivalUpgradeRanks, ctx: SurvivalAttackContext):number {
  let bonus=.12*power(ranks,"glass_cannon");
  if(ctx.headshot)bonus+=.10*power(ranks,"head_hunter");
  if((ctx.distance??Infinity)<=12)bonus+=.12*power(ranks,"point_blank");
  if((ctx.distance??0)>=25)bonus+=.11*power(ranks,"longshot");
  if(ctx.aiming)bonus+=.065*power(ranks,"steady_focus");
  if((ctx.healthFraction??1)<.4)bonus+=.14*power(ranks,"last_stand");
  if(ctx.boss)bonus+=.13*power(ranks,"boss_hunter");
  if((ctx.sinceKillMs??Infinity)<5000)bonus+=.075*power(ranks,"blood_rush");
  if((ctx.sinceHeadshotKillMs??Infinity)<5000)bonus+=.09*power(ranks,"executioner");
  // Offensive boosts grow indefinitely but slowly; danger scales with waves.
  return 1+Math.min(3,bonus);
}
export interface SurvivalDefenseContext {
  healthFraction?:number; explosive?:boolean; sprinting?:boolean;
}
export function survivalIncomingMultiplier(ranks: SurvivalUpgradeRanks,ctx:SurvivalDefenseContext):number {
  let resistance=.06*power(ranks,"steel_skin");
  if(ctx.explosive)resistance+=.1*power(ranks,"blast_guard");
  if((ctx.healthFraction??1)<.4)resistance+=.085*power(ranks,"unyielding");
  if(ctx.sprinting)resistance+=.07*power(ranks,"evasive");
  return (1+Math.min(.6,.09*power(ranks,"glass_cannon")))*(1-Math.min(.42,resistance));
}
export function survivalRegenDelayMultiplier(ranks:SurvivalUpgradeRanks):number {
  return Math.max(.4,1-.13*power(ranks,"quick_recovery"));
}
export function survivalRegenRateMultiplier(ranks:SurvivalUpgradeRanks):number {
  return 1+Math.min(2,.2*power(ranks,"vitality"));
}
export function survivalReloadMultiplier(ranks:SurvivalUpgradeRanks,sinceKillMs=Infinity):number {
  const bonus=.13*power(ranks,"fast_hands")+
    (sinceKillMs<5000?.16*power(ranks,"overclock"):0);
  return Math.max(.55,1-bonus);
}
export function survivalMovementMultiplier(ranks:SurvivalUpgradeRanks,sinceKillMs=Infinity):number {
  const bonus=.045*power(ranks,"light_footed")+
    (sinceKillMs<5000?.07*power(ranks,"adrenaline"):0);
  return 1+Math.min(.22,bonus);
}
export function survivalKillReward(ranks:SurvivalUpgradeRanks,headshot:boolean):{health:number;ammo:number}{
  return {
    health:Math.min(22,Math.floor(4*power(ranks,"combat_medic")+
      (headshot?6*power(ranks,"surgical_precision"):0))),
    ammo:Math.min(8,Math.floor(2*power(ranks,"salvage")+
      (headshot?2*power(ranks,"precision_loop"):0))),
  };
}
export function survivalWaveHealing(ranks:SurvivalUpgradeRanks):number {
  return Math.min(45,Math.floor(12*power(ranks,"fresh_start")));
}

/** Values shown on reward cards use the same logarithmic power curve and caps
 * as the combat functions above; no manually maintained, misleading numbers. */
export function survivalUpgradeValueText(id:SurvivalUpgradeId,ranks:SurvivalUpgradeRanks):string {
  if(id==="self_revive")return "30s downed · 35 HP on kill · once per wave";
  const next={...ranks,[id]:upgradeRank(ranks,id)+1};
  const pct=(n:number)=>`${Math.round(n*1000)/10}%`;
  const value=(r:SurvivalUpgradeRanks):string=>{
    const p=power(r,id);
    switch(id) {
      case "precision_loop": return `+${Math.min(8,Math.floor(2*p))} headshot ammo (shared 8-round cap)`;
      case "salvage": return `+${Math.min(8,Math.floor(2*p))} ammo per kill (shared 8-round cap)`;
      case "head_hunter": return `+${pct(.1*p)} headshot damage`;
      case "point_blank": return `+${pct(.12*p)} damage at ≤12m`;
      case "longshot": return `+${pct(.11*p)} damage at ≥25m`;
      case "steady_focus": return `+${pct(.065*p)} ADS damage`;
      case "glass_cannon": return `+${pct(.12*p)} dealt / +${pct(Math.min(.6,.09*p))} taken`;
      case "last_stand": return `+${pct(.14*p)} damage under 40% HP`;
      case "boss_hunter": return `+${pct(.13*p)} boss damage`;
      case "blood_rush": return `+${pct(.075*p)} damage for 5s after kill`;
      case "executioner": return `+${pct(.09*p)} damage for 5s after headshot kill`;
      case "steel_skin": return `-${pct(Math.min(.42,.06*p))} incoming combat damage`;
      case "blast_guard": return `-${pct(Math.min(.42,.1*p))} incoming explosion damage`;
      case "unyielding": return `-${pct(Math.min(.42,.085*p))} damage under 40% HP`;
      case "evasive": return `-${pct(Math.min(.42,.07*p))} damage while sprinting`;
      case "combat_medic": return `+${Math.min(22,Math.floor(4*p))} HP per kill (shared 22 HP cap)`;
      case "surgical_precision": return `+${Math.min(22,Math.floor(6*p))} HP per headshot kill (shared 22 HP cap)`;
      case "quick_recovery": return `-${pct(1-survivalRegenDelayMultiplier(r))} regen delay`;
      case "vitality": return `+${pct(survivalRegenRateMultiplier(r)-1)} regen rate`;
      case "fast_hands": return `-${pct(1-survivalReloadMultiplier(r))} reload time`;
      case "overclock": return `-${pct(1-survivalReloadMultiplier(r,0))} reload time for 5s after kill`;
      case "light_footed": return `+${pct(survivalMovementMultiplier(r)-1)} movement speed`;
      case "adrenaline": return `+${pct(survivalMovementMultiplier(r,0)-1)} movement for 5s after kill`;
      case "fresh_start": return `+${survivalWaveHealing(r)} HP at next wave`;
      default: return "";
    }
  };
  return `Rank ${upgradeRank(next,id)}: ${value(next)} (currently ${value(ranks)})`;
}
