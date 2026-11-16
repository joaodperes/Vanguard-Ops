// Survival progression and wave mutators shared by server, offline engine and UI.
export const SURVIVAL_TIERS = ["default", "hard", "elite", "nightmare"] as const;
export type SurvivalTier = typeof SURVIVAL_TIERS[number];
export const DEFAULT_SURVIVAL_GOAL = 30;
/** Early waves move quickly; preparation increases to five seconds after wave 10.
 * Reward selection happens within the same break, with a first-choice fallback. */
export function survivalPrepSeconds(completedWave:number):number {
  return Math.min(5,2+Math.max(0,completedWave-1)/3);
}
/** The Survival tier is the ONLY difficulty control. Standard ramps much more
 * gradually, rather than reaching veteran aim accuracy on wave 10. */
export function survivalBotDifficulty(tier: SurvivalTier, wave: number): "easy" | "normal" | "hard" | "veteran" {
  if(tier==="default") return wave<=9?"easy":wave<=19?"normal":wave<=27?"hard":"veteran";
  if(tier==="hard") return wave<=3?"normal":wave<=9?"hard":"veteran";
  if(tier==="elite") return wave<=4?"hard":"veteran";
  return "veteran";
}

export type SurvivalModifier = "swarm" | "frenzy" | "tactics" | "lethal" | "armored";
export const SURVIVAL_MODIFIERS: {id: SurvivalModifier; label: string; description: string}[] = [
  { id: "swarm", label: "Swarm", description: "Additional enemies enter every wave" },
  { id: "frenzy", label: "Frenzy", description: "Enemies sprint and strafe faster" },
  { id: "tactics", label: "Tactical", description: "Sharper aim, faster reactions and smarter pursuit" },
  { id: "lethal", label: "Lethal", description: "Enemy attacks deal more damage" },
  { id: "armored", label: "Armored", description: "Enemies have extra health" },
];
export const SURVIVAL_TIER_INFO: Record<SurvivalTier,{label:string;description:string;color:string}> = {
  default: {label:"Standard",description:"Clear 30 waves to win and earn a huge completion bonus.",color:"#f59e0b"},
  hard: {label:"Hard",description:"Endless waves. One mutator changes every 5 waves.",color:"#f97316"},
  elite: {label:"Elite",description:"Endless waves. Mutators change every wave; boss every 10.",color:"#a855f7"},
  nightmare: {label:"Nightmare",description:"Endless waves. Mutators stack every wave; boss every 10.",color:"#ef4444"},
};
export function normalizeSurvivalTier(value: unknown): SurvivalTier {
  return typeof value === "string" && (SURVIVAL_TIERS as readonly string[]).includes(value)
    ? value as SurvivalTier : "default";
}
export function survivalRecordMode(tier: SurvivalTier): string {
  return tier === "default" ? "survival" : "survival_" + tier;
}
export function survivalWavesCleared(wave: number, waveActive: boolean): number {
  return Math.max(0, wave - (waveActive ? 1 : 0));
}
export function survivalIsBossWave(tier: SurvivalTier, wave: number): boolean {
  return (tier === "elite" || tier === "nightmare") && wave > 0 && wave % 10 === 0;
}
export function survivalModifierLevels(tier: SurvivalTier, wave: number): Record<SurvivalModifier,number> {
  const levels: Record<SurvivalModifier,number> = {swarm:0,frenzy:0,tactics:0,lethal:0,armored:0};
  if (tier === "default" || wave <= 0) return levels;
  const order = SURVIVAL_MODIFIERS;
  if (tier === "hard") levels[order[Math.floor((wave-1)/5)%order.length].id] = 1;
  else if (tier === "elite") levels[order[(wave-1)%order.length].id] = 1;
  else for (let index=0;index<wave;index++) levels[order[index%order.length].id]++;
  return levels;
}
export function survivalWaveMutators(tier: SurvivalTier, wave: number) {
  const levels = survivalModifierLevels(tier,wave);
  // Nightmare grows persistently, with safety caps on raw combat multipliers.
  return {
    levels,
    names: SURVIVAL_MODIFIERS.filter(m=>levels[m.id]>0).map(m=>
      m.label+(levels[m.id]>1?" ×"+levels[m.id]:"")),
    spawnMul: tier === "default" ? .85 : Math.min(2.8, 1+levels.swarm*0.45),
    speedMul: Math.min(2.2, 1+levels.frenzy*0.3),
    skillBoost: Math.min(0.30,levels.tactics*0.10),
    damageMul: tier === "default" ? .87 : Math.min(3.0, 1+levels.lethal*0.35),
    healthMul: tier === "default" ? .92 : Math.min(3.0, 1+levels.armored*0.4),
    boss: survivalIsBossWave(tier,wave),
  };
}
export interface SurvivalProgress {
  defaultWins: number;
  hardBest: number;
  eliteBest: number;
  nightmareBest: number;
}
export function survivalUnlocked(tier: SurvivalTier, progress: SurvivalProgress): boolean {
  switch (tier) {
    case "default": return true;
    case "hard": return progress.defaultWins > 0;
    case "elite": return progress.hardBest >= 20;
    case "nightmare": return progress.eliteBest >= 20;
  }
}
export const ZERO_SURVIVAL_PROGRESS: SurvivalProgress = {defaultWins:0,hardBest:0,eliteBest:0,nightmareBest:0};
