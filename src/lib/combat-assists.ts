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
