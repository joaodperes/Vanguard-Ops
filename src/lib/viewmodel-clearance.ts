/** Camera-local first-person sight clearance.
 * Optics belong to the receiver, not a detached screen-space scaffold.
 * All adjustments move the entire weapon as a rigid object.
 */
import type { WeaponDef, SightType } from "./game-data";
export interface AdsClearance {
  bodyY:number;
  sightMountY:number;
  sightVisible:boolean;
  bodyCeiling:number;
}
export function adsClearance(
  weapon:Pick<WeaponDef,"id"|"category"|"wonder">,
  sight:SightType,receiverHeight=.18,
):AdsClearance {
  const magnified=["acog","hunter","thermal","nvg","sniper_scope"].includes(sight);
  const oversized=["crossbow_reclaimer","rifle_hydra","launcher_rocket",
    "launcher_swarm","launcher_breach"].includes(weapon.id) ||
    ["launcher","lmg"].includes(weapon.category);
  // Compact pistols sit close under the reticle, bulkier receivers move down
  // just enough not to obstruct the camera's centre ray.
  const bodyY=-Math.max(oversized?.29:.205,receiverHeight*1.15+.04);
  // Normal low-profile mechanical sight on the receiver's existing top rail.
  const sightMountY=receiverHeight*.47+.025;
  return {
    bodyY,sightMountY,
    sightVisible:!magnified&&weapon.category!=="melee"&&!weapon.wonder,
    bodyCeiling:bodyY+receiverHeight*.65+.06,
  };
}
