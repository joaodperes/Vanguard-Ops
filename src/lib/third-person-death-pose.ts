import * as THREE from "three";

/**
 * Third-person death poses must release the procedural weapon grip. Live
 * humanoid animation solves both arms with IK, but stops when alive becomes
 * false; without a separate death pose, the supporting (left) arm stays
 * extended toward the weapon for the entire fall (notably on lava deaths).
 */
export interface ThirdPersonDeathRig {
  torso: THREE.Object3D;
  head: THREE.Object3D;
  upperArmL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  lowerArmL: THREE.Object3D;
  lowerArmR: THREE.Object3D;
  upperLegL: THREE.Object3D;
  upperLegR: THREE.Object3D;
  lowerLegL: THREE.Object3D;
  lowerLegR: THREE.Object3D;
  weaponStub: THREE.Object3D;
  weaponBase: THREE.Vector3;
}

type JointName = Exclude<keyof ThirdPersonDeathRig, "weaponStub" | "weaponBase">;

const JOINTS = [
  "torso", "head", "upperArmL", "upperArmR", "lowerArmL", "lowerArmR",
  "upperLegL", "upperLegR", "lowerLegL", "lowerLegR",
] as const satisfies readonly JointName[];

export interface ThirdPersonDeathPoseStart {
  joints: Record<JointName, THREE.Quaternion>;
  weaponPosition: THREE.Vector3;
  weaponRotation: THREE.Quaternion;
}

const rest = (x = 0, z = 0) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, z));

const REST_JOINTS: Record<JointName, THREE.Quaternion> = {
  torso: rest(),
  head: rest(-0.12),
  upperArmL: rest(0.12, 0.20),
  upperArmR: rest(0.12, -0.20),
  lowerArmL: rest(-0.22),
  lowerArmR: rest(-0.22),
  upperLegL: rest(0.08),
  upperLegR: rest(-0.08),
  lowerLegL: rest(0.20),
  lowerLegR: rest(0.20),
};
const REST_WEAPON_POSITION = new THREE.Vector3(-0.12, 0.55, 0.12);
const REST_WEAPON_ROTATION = rest(-1.05, 0.32);

/** Capture the exact aiming pose at death, avoiding a first-frame snap. */
export function captureThirdPersonDeathPose(rig: ThirdPersonDeathRig): ThirdPersonDeathPoseStart {
  const joints = {} as Record<JointName, THREE.Quaternion>;
  for (const joint of JOINTS) joints[joint] = rig[joint].quaternion.clone();
  return {
    joints,
    weaponPosition: rig.weaponStub.position.clone(),
    weaponRotation: rig.weaponStub.quaternion.clone(),
  };
}

/**
 * Deterministically blend the armed pose into relaxed, falling limbs. The
 * progress comes from the same timer as the torso fall (including finale
 * slow motion), not from per-frame deltas.
 */
export function applyThirdPersonDeathPose(
  rig: ThirdPersonDeathRig,
  start: ThirdPersonDeathPoseStart,
  progress: number,
): void {
  const p = Math.max(0, Math.min(1, progress));
  const eased = 1 - Math.pow(1 - p, 3);
  for (const joint of JOINTS) {
    rig[joint].quaternion.slerpQuaternions(start.joints[joint], REST_JOINTS[joint], eased);
  }
  rig.weaponStub.position.lerpVectors(start.weaponPosition, REST_WEAPON_POSITION, eased);
  rig.weaponStub.quaternion.slerpQuaternions(start.weaponRotation, REST_WEAPON_ROTATION, eased);
}

/** Clear the dead pose before a respawn (offline or server-authoritative). */
export function resetThirdPersonDeathPose(rig: ThirdPersonDeathRig): void {
  for (const joint of JOINTS) rig[joint].quaternion.identity();
  rig.weaponStub.quaternion.identity();
  rig.weaponStub.position.copy(rig.weaponBase);
}
