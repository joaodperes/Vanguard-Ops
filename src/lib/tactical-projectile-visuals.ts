/** Cosmetic-only readback values for airborne tactical items.
 * Lengths are world units. Keep glows short so cover and enemy silhouettes
 * remain clear and shots never resemble guided, giant projectiles.
 */
import type { EquipmentId } from "./equipment";

export interface TacticalProjectileVisual {
  color:number;
  haloRadius:number;
  trailWidth:number;
  trailLength:number;
}
const VISUALS:Record<EquipmentId,TacticalProjectileVisual>={
  frag:        {color:0xffc061,haloRadius:.30,trailWidth:.084,trailLength:1.0},
  flashbang:   {color:0xe8f8ff,haloRadius:.29,trailWidth:.085,trailLength:.95},
  mine:        {color:0xffa348,haloRadius:.30,trailWidth:.090,trailLength:.8},
  knives:      {color:0xcbefff,haloRadius:.26,trailWidth:.065,trailLength:.85},
  taser:       {color:0x42e8ff,haloRadius:.31,trailWidth:.085,trailLength:1.05},
  poison_dart: {color:0x86ff78,haloRadius:.28,trailWidth:.065,trailLength:1.1},
};
export function tacticalProjectileVisual(id:string):TacticalProjectileVisual {
  return VISUALS[id as EquipmentId]??VISUALS.frag;
}
export const TACTICAL_PROJECTILE_VISUAL_IDS=Object.keys(VISUALS) as EquipmentId[];
