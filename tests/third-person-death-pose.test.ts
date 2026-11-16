import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  captureThirdPersonDeathPose, applyThirdPersonDeathPose,
  resetThirdPersonDeathPose, type ThirdPersonDeathRig,
} from "../src/lib/third-person-death-pose";

function makeRig(): ThirdPersonDeathRig {
  const joint = () => new THREE.Object3D();
  const rig: ThirdPersonDeathRig = {
    torso: joint(), head: joint(), upperArmL: joint(), upperArmR: joint(),
    lowerArmL: joint(), lowerArmR: joint(), upperLegL: joint(), upperLegR: joint(),
    lowerLegL: joint(), lowerLegR: joint(), weaponStub: joint(),
    weaponBase: new THREE.Vector3(-0.08, 1.30, 0.36),
  };
  rig.weaponStub.position.copy(rig.weaponBase);
  // Recreate an extended support-hand/weapon-aiming pose (seen before lava deaths).
  rig.upperArmL.quaternion.setFromEuler(new THREE.Euler(-1.05, 0.1, -0.2));
  rig.lowerArmL.quaternion.setFromEuler(new THREE.Euler(-0.72, 0, 0));
  rig.upperArmR.quaternion.setFromEuler(new THREE.Euler(-0.85, 0, 0.1));
  rig.lowerArmR.quaternion.setFromEuler(new THREE.Euler(-0.5, 0, 0));
  rig.head.quaternion.setFromEuler(new THREE.Euler(0.4, 0, 0));
  rig.weaponStub.quaternion.setFromEuler(new THREE.Euler(0.3, 0, 0));
  return rig;
}

describe("third-person death pose", () => {
  test("starts exactly at the last living aiming pose without snapping", () => {
    const rig = makeRig();
    const start = captureThirdPersonDeathPose(rig);
    applyThirdPersonDeathPose(rig, start, 0);
    expect(rig.upperArmL.quaternion.angleTo(start.joints.upperArmL)).toBeLessThan(1e-6);
    expect(rig.lowerArmL.quaternion.angleTo(start.joints.lowerArmL)).toBeLessThan(1e-6);
    expect(rig.weaponStub.position.distanceTo(start.weaponPosition)).toBeLessThan(1e-6);
  });

  test("lowers both arms and weapon by the end of a death fall", () => {
    const rig = makeRig();
    const start = captureThirdPersonDeathPose(rig);
    const leftAim = start.joints.upperArmL.clone();
    applyThirdPersonDeathPose(rig, start, 0.5);
    const halfway = rig.upperArmL.quaternion.clone();
    expect(halfway.angleTo(leftAim)).toBeGreaterThan(0.1);
    expect(halfway.angleTo(new THREE.Quaternion())).toBeLessThan(leftAim.angleTo(new THREE.Quaternion()));
    applyThirdPersonDeathPose(rig, start, 1);
    expect(rig.upperArmL.quaternion.angleTo(leftAim)).toBeGreaterThan(0.5);
    expect(rig.upperArmL.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.5);
    expect(rig.upperArmR.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.5);
    expect(rig.weaponStub.position.y).toBeLessThan(0.65);
  });

  test("uses absolute progress, so finale slow motion cannot leave a frozen arm", () => {
    const rig = makeRig();
    const start = captureThirdPersonDeathPose(rig);
    applyThirdPersonDeathPose(rig, start, 0.95);
    const pose = rig.upperArmL.quaternion.clone();
    applyThirdPersonDeathPose(rig, start, 0.10);
    applyThirdPersonDeathPose(rig, start, 0.95);
    expect(rig.upperArmL.quaternion.angleTo(pose)).toBeLessThan(1e-6);
  });

  test("clears the death pose for a subsequent respawn and fresh death", () => {
    const rig = makeRig();
    const start = captureThirdPersonDeathPose(rig);
    applyThirdPersonDeathPose(rig, start, 1);
    resetThirdPersonDeathPose(rig);
    expect(rig.upperArmL.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    expect(rig.lowerArmL.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    expect(rig.weaponStub.position.distanceTo(rig.weaponBase)).toBeLessThan(1e-6);
    const next = captureThirdPersonDeathPose(rig);
    applyThirdPersonDeathPose(rig, next, 0);
    expect(rig.upperArmL.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
  });
});
