/** Friendly fire is disabled for explosives, but owners are never immune to their own blasts.
 * Shared by the authoritative server, offline simulation and tests.
 */
export function blastCanDamage(
  ownerId:string,ownerTeam:string,targetId:string,targetTeam:string,mode:string,
):boolean {
  return ownerId===targetId || mode==="ffa" || mode==="gungame" || ownerTeam!==targetTeam;
}
