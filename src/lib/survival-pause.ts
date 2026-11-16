/** Shared rules for server-authoritative Survival pauses and cooperative upgrade offers. */
export const SURVIVAL_COOP_UPGRADE_GRACE_MS=10_000;
export function survivalPauseActive(players:number,pendingOffers:number,menuPaused:boolean):boolean {
  return pendingOffers>0||(players===1&&menuPaused);
}
export function survivalFirstChoiceDeadline(players:number,before:number,after:number,now:number):number|null {
  return players>1&&before>1&&after===1?now+SURVIVAL_COOP_UPGRADE_GRACE_MS:null;
}
export function remainingSurvivalUpgradeSeconds(deadline:number,now:number):number {
  return Math.max(0,Math.ceil((deadline-now)/1000));
}
