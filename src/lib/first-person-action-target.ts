import * as THREE from "three";

/** Move an authored offhand/prop contact into the same camera-local frame as
 * the rotated weapon geometry. Using only vmOffset made reload contacts slide
 * through the gun as it pitched/rolled. Preserve the existing action offsets'
 * units; unlike geometry, the authored hand tracks are already viewmodel-sized.
 * Always apply the gun's pivot rotation before its final translation.
 */
export function placeFirstPersonActionTarget(
  output: THREE.Vector3, contact: readonly [number,number,number],
  weaponRotation: THREE.Quaternion, offsetX:number, offsetY:number, offsetZ:number,
): THREE.Vector3 {
  const pivotX=0, pivotY=-.11, pivotZ=.12;
  output.set(contact[0]-pivotX,contact[1]-pivotY,contact[2]-pivotZ);
  output.applyQuaternion(weaponRotation);
  output.x += pivotX + offsetX;
  output.y += pivotY + offsetY;
  output.z += pivotZ + offsetZ;
  return output;
}
