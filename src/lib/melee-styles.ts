/** One animation/timer per equipped melee weapon; used by slot 3 and quick F.
 * Each pose uses the same strike/recovery duration from quickMeleeProfile.
 */
export type MeleeStyle = "stab"|"vertical"|"horizontal"|"slam";
export function meleeStyle(weaponId:string):MeleeStyle{
  if(weaponId==="knife_tactical"||weaponId==="shiv")return "stab";
  if(weaponId==="axe"||weaponId==="orbital_reaper")return "horizontal";
  if(weaponId==="hammer")return "slam";
  return "vertical"; // machete, baton
}
export function meleeSwingPose(weaponId:string,progress:number){
  const p=Math.max(0,Math.min(1,progress));
  const peak=Math.sin(p*Math.PI);
  const style=meleeStyle(weaponId);
  switch(style){
    case "stab": return {pitch:-.23*peak,yaw:0,roll:.08*peak,x:-.05*peak,y:.035*peak,z:-.42*peak};
    case "horizontal":return {pitch:-.42*peak,yaw:-.52*peak,roll:.53*peak,x:-.13*peak,y:-.06*peak,z:-.21*peak};
    case "slam":return {pitch:-1.9*peak,yaw:0,roll:.07*peak,x:0,y:-.23*peak,z:-.22*peak};
    case "vertical":return {pitch:-1.3*peak,yaw:.16*peak,roll:-.12*peak,x:0,y:-.12*peak,z:-.16*peak};
  }
}
