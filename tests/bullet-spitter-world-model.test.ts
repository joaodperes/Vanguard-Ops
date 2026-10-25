import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { buildBulletSpitterModel } from "../src/lib/bullet-spitter-model";
import { TURRET_MUZZLE_HEIGHT, turretDeployPosition } from "../src/lib/turret-rules";

describe("Bullet Spitter is a physical world-space 3D object", () => {
  test("has visible solid geometry at player scale, not just a light or HUD marker", () => {
    const { root, yawPivot, barrelPivot, sensor } = buildBulletSpitterModel();
    const scene = new THREE.Scene();
    const placed = turretDeployPosition([0,0,0], 0, []);
    root.position.set(...placed);
    scene.add(root);
    scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    root.traverse(node => { if (node instanceof THREE.Mesh) meshes.push(node); });
    expect(scene.children).toContain(root);
    expect(root.userData.isWorldTurret).toBe(true);
    expect(root.position.z).toBe(3.2);
    expect(root.visible).toBe(true);
    expect(meshes.length).toBeGreaterThanOrEqual(20);
    expect(meshes.filter(mesh => mesh.name === "turret-gun-barrel").length).toBe(2);
    expect(meshes.filter(mesh => mesh.name === "turret-tripod-leg").length).toBe(3);
    expect(meshes.some(mesh => mesh.name === "turret-armored-housing")).toBe(true);
    expect(meshes.some(mesh => mesh.name === "turret-base")).toBe(true);
    expect(meshes.every(mesh => mesh.visible)).toBe(true);
    expect(TURRET_MUZZLE_HEIGHT).toBeCloseTo(1.29);

    const bbox = new THREE.Box3().setFromObject(root);
    expect(bbox.max.y - bbox.min.y).toBeGreaterThan(1.5);
    expect(bbox.max.x - bbox.min.x).toBeGreaterThan(1.3);
    expect(bbox.max.z - bbox.min.z).toBeGreaterThan(1.4);

    const rootYaw = root.rotation.y;
    yawPivot.rotation.y = Math.PI / 4;
    barrelPivot.rotation.x = -0.3;
    expect(root.rotation.y).toBe(rootYaw); // tripod stays planted
    expect(sensor.parent).toBe(yawPivot);
    expect(barrelPivot.parent).toBe(yawPivot);
    expect(root.getObjectByName("turret-gun-barrel")).toBeTruthy();
    scene.remove(root);
    expect(scene.children).not.toContain(root);
  });

  test("turret body never spawns behind cover or outside arena limits", () => {
    const wall = [{ pos: [0, .75, 2], size: [1, .75, .2] }];
    const pos = turretDeployPosition([0, 0, 0], 0, wall, 30);
    expect(pos[2]).toBeLessThan(2);
    const edge = turretDeployPosition([29, 0, 0], Math.PI / 2, [], 30);
    expect(edge).toEqual([29, 0, 0]);
  });
});
