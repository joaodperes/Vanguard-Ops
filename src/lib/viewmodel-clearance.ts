/** Camera-local ADS geometry. The body and its optic are one rigid assembly.
 * The reticle and camera-centred ballistic ray stay at the eye; no individual
 * sight translation is permitted during ADS animation.
 */
import type { WeaponDef, SightType } from "./game-data";
export interface AdsClearance {
  bodyY:number;
  /** Rest-model Y of the actual sight aperture (the support is built below it). */
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
  // Tall receivers/carry handles require additional room, not a detached optic.
  // The shallowest safe pose deliberately keeps more of each weapon visible.
  const bodyY=-Math.max(oversized?.34:.255,receiverHeight*1.30+.105);
  // Plagueheart is a shoulder weapon: its receiver should sit immediately
  // below the reticle instead of disappearing beneath the bottom of the view.
  const adjustedY=weapon.id==="wonder_corrosion"?-.265:bodyY;
  const sightMountY=-adjustedY/1.2;
  return {
    bodyY:adjustedY,sightMountY,
    sightVisible:!magnified&&weapon.category!=="melee"&&!weapon.wonder,
    bodyCeiling:adjustedY+receiverHeight*.65+.12,
  };
}
