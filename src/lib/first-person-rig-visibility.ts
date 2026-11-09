import type * as THREE from "three";

/** All camera-relative viewmodel nodes that can survive a lethal hit.
 * The support arm is NOT a weapon part: it is a separate camera child, so it
 * must be hidden explicitly along with the glove and reload prop.
 * Used in the dead-player early return and while rendering the match finale.
 * Respawn re-enables the nodes through the ordinary live viewmodel pose.
 */
export function hideFirstPersonRigOnDeath(
  parts: readonly {obj:THREE.Object3D}[],
  hand:THREE.Object3D|null,
  prop:THREE.Object3D|null,
  supportArm:THREE.Object3D|null,
):void {
  for(const p of parts) p.obj.visible=false;
  if(hand)hand.visible=false;
  if(prop)prop.visible=false;
  if(supportArm)supportArm.visible=false;
}
