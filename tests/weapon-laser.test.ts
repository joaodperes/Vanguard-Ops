import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { weaponLaserRay } from "../src/lib/weapon-laser";
import { sampleReloadMotion } from "../src/lib/first-person-animation";

function makeMountedEmitter(position: [number, number, number]) {
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.set(-.12, .5 + Math.PI, 0, "YXZ");
  camera.position.set(4, 1.8, -3);
  const weapon = new THREE.Group();
  weapon.position.set(.30, -.18, -.48);
  camera.add(weapon);
  const emitter = new THREE.Object3D();
  emitter.position.set(...position);
  weapon.add(emitter);
  return { camera, weapon, emitter };
}

describe("weapon-mounted laser rendering", () => {
  test("projector ray starts on the optic or underbarrel attachment, not at the eye or muzzle", () => {
    for (const pos of [[0,.10,-.134],[0,-.09,-.241]] as [number,number,number][]) {
      const { camera, emitter } = makeMountedEmitter(pos);
      const { origin, direction } = weaponLaserRay(emitter);
      expect(origin.distanceTo(emitter.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8);
      expect(origin.distanceTo(camera.getWorldPosition(new THREE.Vector3()))).toBeGreaterThan(.35);
      expect(direction.length()).toBeCloseTo(1, 8);
      expect(direction.distanceTo(camera.getWorldDirection(new THREE.Vector3()))).toBeLessThan(1e-8);
    }
  });

  test("magazine reload pitch and roll steer the laser with the weapon, not the crosshair", () => {
    const { camera, weapon, emitter } = makeMountedEmitter([0,.10,-.134]);
    const resting = weaponLaserRay(emitter);
    const reticleDirection = camera.getWorldDirection(new THREE.Vector3());
    expect(resting.direction.distanceTo(reticleDirection)).toBeLessThan(1e-8);
    const pose = sampleReloadMotion(.5, "magazine");
    expect(Math.abs(pose.pitch)).toBeGreaterThan(.1);
    weapon.position.y += pose.dip;
    weapon.quaternion.setFromEuler(new THREE.Euler(pose.pitch,0,pose.roll,"XYZ"));
    const reloading = weaponLaserRay(emitter);
    expect(reloading.direction.distanceTo(reticleDirection)).toBeGreaterThan(.1);
    expect(reloading.origin.distanceTo(resting.origin)).toBeGreaterThan(.02);
    const barrelAxis = new THREE.Vector3(0,0,-1)
      .applyQuaternion(weapon.getWorldQuaternion(new THREE.Quaternion())).normalize();
    expect(reloading.direction.distanceTo(barrelAxis)).toBeLessThan(1e-8);
  });

  test("ADS translation and sway move the laser origin and angle independently", () => {
    const { weapon, emitter } = makeMountedEmitter([0,-.09,-.241]);
    const before = weaponLaserRay(emitter);
    weapon.position.add(new THREE.Vector3(-.2,-.24,-.18));
    const shifted = weaponLaserRay(emitter);
    expect(shifted.origin.distanceTo(before.origin)).toBeCloseTo(Math.hypot(.2,.24,.18),8);
    expect(shifted.direction.distanceTo(before.direction)).toBeLessThan(1e-8);
    // Roll moves an off-axis emitter without changing the forward direction.
    // Only yaw/pitch should steer the ray away from the reticle.
    weapon.rotateZ(-.3);
    const rolled=weaponLaserRay(emitter);
    expect(rolled.origin.distanceTo(shifted.origin)).toBeGreaterThan(.01);
    expect(rolled.direction.distanceTo(shifted.direction)).toBeLessThan(1e-8);
    weapon.rotateY(.3);
    expect(weaponLaserRay(emitter).direction.distanceTo(shifted.direction)).toBeGreaterThan(.01);
  });

  test("Akimbo lasers follow separate revolver poses rather than merging at a shared reticle", () => {
    const { camera, weapon: left, emitter: leftEmitter } = makeMountedEmitter([-.34,.06,-.15]);
    const right = new THREE.Group();
    camera.add(right);
    right.position.set(.34,-.18,-.48);
    const rightEmitter = new THREE.Object3D();
    rightEmitter.position.set(.34,.06,-.15);
    right.add(rightEmitter);
    const rightBefore=weaponLaserRay(rightEmitter);
    const leftPose=sampleReloadMotion(.5,"cylinder_speedloader");
    left.quaternion.setFromEuler(new THREE.Euler(leftPose.pitch,0,leftPose.roll,"XYZ"));
    const leftRay=weaponLaserRay(leftEmitter),rightRay=weaponLaserRay(rightEmitter);
    expect(leftRay.direction.distanceTo(rightRay.direction)).toBeGreaterThan(.05);
    expect(rightRay.direction.distanceTo(rightBefore.direction)).toBeLessThan(1e-8);
    expect(leftRay.origin.distanceTo(rightRay.origin)).toBeGreaterThan(.1);
  });
});
