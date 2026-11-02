/** Consistent difficulty-based bot behavior for offline and Socket.IO simulation. */
export type BotTier = "easy" | "normal" | "hard" | "veteran";
const PROFILES = {
  easy:    { movement: 0.69, turn: 0.055, reaction: 850, reactionJitter: 370, decision: 730, decisionJitter: 440, aimDrift: 1.60 },
  normal:  { movement: 0.86, turn: 0.095, reaction: 480, reactionJitter: 260, decision: 480, decisionJitter: 310, aimDrift: 1.10 },
  hard:    { movement: 1.00, turn: 0.165, reaction: 250, reactionJitter: 180, decision: 330, decisionJitter: 180, aimDrift: 0.85 },
  veteran: { movement: 1.12, turn: 0.235, reaction: 120, reactionJitter: 110, decision: 220, decisionJitter: 130, aimDrift: 0.65 },
} as const;
export const botMoveMultiplier = (tier: BotTier): number => PROFILES[tier].movement;
export const botTurnLerp = (tier: BotTier, skill: number): number =>
  Math.min(0.31, PROFILES[tier].turn * (0.90 + skill * 0.22));
export const botReactionDelay = (tier: BotTier, roll = 0.5): number =>
  PROFILES[tier].reaction + PROFILES[tier].reactionJitter * Math.min(1, Math.max(0, roll));
export const botDecisionDelay = (tier: BotTier, roll = 0.5): number =>
  PROFILES[tier].decision + PROFILES[tier].decisionJitter * Math.min(1, Math.max(0, roll));
export const botAimDriftMultiplier = (tier: BotTier): number => PROFILES[tier].aimDrift;

/** Tactics vary independently of marksmanship; all simulations use these choices. */
export const BOT_TACTICS = {
  easy: { detection:32, precisionRange:38, sprintDistance:Infinity, jumpChance:0, jumpCooldown:8000, cornerCheck:false, highGround:.08, strafe:0 },
  normal: { detection:55, precisionRange:70, sprintDistance:8, jumpChance:.025, jumpCooldown:6500, cornerCheck:false, highGround:.35, strafe:.7 },
  hard: { detection:80, precisionRange:110, sprintDistance:6, jumpChance:.11, jumpCooldown:4300, cornerCheck:true, highGround:.65, strafe:.85 },
  veteran: { detection:100, precisionRange:145, sprintDistance:5, jumpChance:.2, jumpCooldown:3000, cornerCheck:true, highGround:.85, strafe:1 },
} as const;
export const botTactics=(tier:BotTier)=>BOT_TACTICS[tier];
export function botDetectionRange(tier:BotTier,category:string):number {
  const p=botTactics(tier);return category==="sniper"||category==="dmr"?p.precisionRange:p.detection;
}
export function botWantsCombatJump(tier:BotTier,category:string,distance:number,clearShot:boolean,
  grounded:boolean,now:number,nextAt:number,roll:number):boolean {
  return grounded && clearShot && distance>5 && distance<30 && now>=nextAt &&
    !(category==="sniper"&&distance>14) && roll<botTactics(tier).jumpChance;
}
/** Brief scan near occluding corners. Offsets affect look, never route waypoints. */
export function botCornerScan(tier:BotTier,blocked:boolean,now:number,state:{cornerUntil?:number;nextCornerAt?:number}):number {
  if(!botTactics(tier).cornerCheck)return 0;
  if(blocked&&now>=(state.nextCornerAt??0)){
    state.cornerUntil=now+650;state.nextCornerAt=now+3600;
  }
  const remaining=(state.cornerUntil??0)-now;
  return remaining>0?Math.sin((1-remaining/650)*Math.PI*2)*.85:0;
}
