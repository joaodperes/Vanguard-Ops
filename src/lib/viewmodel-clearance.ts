/** Camera-local first-person ADS geometry: the eye and bullet direction stay
 * fixed at (0,0,-Z); only art moves. Shared by renderer and regression tests.
 */
import type { WeaponDef, SightType } from "./game-data";
export interface AdsClearance {
  bodyY:number; sightLift:number; sightVisible:boolean; bodyCeiling:number;
}
export function adsClearance(weapon:Pick<WeaponDef,"id"|"category"|"wonder">,
 sight:SightType,receiverHeight=.18):AdsClearance {
 const iron=sight==="iron"&&!weapon.wonder&&weapon.category!=="melee";
 const oversized=["crossbow_reclaimer","rifle_hydra","launcher_rocket",
  "launcher_swarm","launcher_breach"].includes(weapon.id) ||
  ["launcher","lmg"].includes(weapon.category);
 const special=["wonder_deadlock","wonder_stormweaver","wonder_singularity",
  "wonder_corrosion","wonder_turret"].includes(weapon.id);
 // The top of the receiver must be below the crosshair in camera space.
 // Keep optic aperture at y~=0 while lowering the rest of the weapon.
 const bodyY=oversized||special?-.46:-.32;
 const sightLift=iron? -bodyY-.104:0; // mount base is y=.08, vmScale ~=1.3
 const ceiling=bodyY+(receiverHeight*.65+.12);
 return {bodyY,sightLift,sightVisible:iron,bodyCeiling:ceiling};
}
