/** Human-readable kill sources. Tactical damage is player-owned, not a
 * map hazard; preserve the weapon name separately from the killer's identity.
 * Unknown environmental IDs retain the legacy environment label.
 */
import { EQUIPMENT } from "./equipment";
import { WEAPONS } from "./game-data";

export function deathCauseLabel(weaponId:string):string {
  if(weaponId.startsWith("equipment_")){
    const equipment=EQUIPMENT.find(e=>e.id===weaponId.slice("equipment_".length));
    if(equipment)return equipment.name;
  }
  const weapon=WEAPONS.find(w=>w.id===weaponId);
  if(weapon)return weapon.name;
  return "Environment: "+weaponId.replace(/^(hazard_|env_)/,"").replaceAll("_"," ");
}
