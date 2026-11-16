import * as THREE from "three";

/**
 * World-space ray for a laser physically mounted on a first-person firearm.
 * The emitter is a child of the animated gun part (optic or underbarrel
 * module), so its matrix includes every weapon pose/scale and camera rotation.
 * A laser is NOT a crosshair-guided ballistic prediction.
 */
export function weaponLaserRay(emitter: THREE.Object3D): {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
} {
  const origin = emitter.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(emitter.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  return { origin, direction };
}
