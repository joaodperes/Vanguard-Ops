import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { batchStaticPropMeshes } from "../src/lib/static-prop-batching";

describe("static map detail batching", () => {
  test("merges opaque meshes with matching material without changing their bounds or ray hits", () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x887766 });
    for (let i = 0; i < 4; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1 + i * .2, 2, 1), mat);
      box.position.set(i * 3, 1, 0);
      box.castShadow = true;
      root.add(box);
    }
    root.updateMatrixWorld(true);
    const boundsBefore = new THREE.Box3().setFromObject(root);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObjects(root.children, true).length).toBeGreaterThan(0);
    expect(batchStaticPropMeshes(root)).toBe(3);
    root.updateMatrixWorld(true);
    const boundsAfter = new THREE.Box3().setFromObject(root);
    expect(boundsAfter.min.distanceTo(boundsBefore.min)).toBeLessThan(1e-5);
    expect(boundsAfter.max.distanceTo(boundsBefore.max)).toBeLessThan(1e-5);
    expect(ray.intersectObjects(root.children, true).length).toBeGreaterThan(0);
    expect(root.children).toHaveLength(1);
    expect((root.children[0] as THREE.Mesh).castShadow).toBe(true);
  });
  test("keeps destructible items, nested detail groups and transparent signage untouched", () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial();
    const dynamic = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    dynamic.userData.ballisticId = "fixture-1";
    root.add(dynamic);
    const nested = new THREE.Group();
    nested.userData.ballisticId = "fixture-2";
    nested.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    root.add(nested);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 1),
      new THREE.MeshBasicMaterial({ transparent: true }));
    root.add(sign);
    expect(batchStaticPropMeshes(root)).toBe(0);
    expect(root.children).toEqual([dynamic, nested, sign]);
  });
});
