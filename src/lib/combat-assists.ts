/** A teammate earns one assist if they contributed >=15 damage to a
 * victim killed by another teammate in the last 10 seconds.
 * Only the authoritative damage stream can register contributors.
 */
export interface Contribution { damage:number; at:number; team:string }
export function countEligibleAssists(
  contributors:ReadonlyMap<string,Contribution>,
  killerId:string,killerTeam:string,now:number,
):string[]{
  if(killerTeam!=="red"&&killerTeam!=="blue")return [];
  return [...contributors].filter(([id,c])=>
    id!==killerId&&c.team===killerTeam&&c.damage>=15&&now-c.at<=10000
  ).map(([id])=>id);
}


export interface DamageContributionState { damage:number; at:number }

/** Accumulate damage against one victim using the shared 10-second window. */
export function accumulateDamageContribution(
  previous:DamageContributionState|undefined,damage:number,victimHealth:number,now:number,
):DamageContributionState {
  const recent=previous&&now-previous.at<10000?previous.damage:0;
  const applied=Math.max(0,Math.min(Number.isFinite(damage)?damage:0,Math.max(0,Number.isFinite(victimHealth)?victimHealth:0)));
  return {damage:recent+applied,at:now};
}

/** Shared minimum-damage and recency test for a potential teammate assist. */
export function isAssistContributionEligible(
  contribution:DamageContributionState,now:number,
):boolean {
  return contribution.damage>=15&&now-contribution.at<=10000;
}
