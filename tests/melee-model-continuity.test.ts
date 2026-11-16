import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { buildMeleeWeaponParts } from "../src/lib/melee-model";

type Part = { mesh: THREE.Mesh; x: number };
const metal = new THREE.MeshBasicMaterial({ color: 0xdddddd });
const grip = new THREE.MeshBasicMaterial({ color: 0x222222 });

function build(id: string): Part[] {
  const parts: Part[] = [];
  buildMeleeWeaponParts(id, metal, grip, (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    parts.push({ mesh, x });
  });
  return parts;
}

function zSpan(mesh: THREE.Mesh): [number, number] {
  const bounds = new THREE.Box3().setFromObject(mesh);
  return [bounds.min.z, bounds.max.z];
}

function overlap(a: THREE.Mesh, b: THREE.Mesh): number {
  const [aMin, aMax] = zSpan(a);
  const [bMin, bMax] = zSpan(b);
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

describe("melee hilt/blade continuity (shared first- and third-person model)", () => {
  for (const id of ["knife_tactical", "shiv", "machete"]) {
    test(`${id}: blade tang physically overlaps handle, preserving the existing tip`, () => {
      const parts = build(id);
      const handle = parts.find(({ mesh }) => mesh.material === grip && zSpan(mesh)[1] > 0.11)?.mesh;
      const blade = parts.find(({ mesh }) => mesh.material === metal)?.mesh;
      expect(handle).toBeDefined();
      expect(blade).toBeDefined();
      expect(overlap(blade!, handle!)).toBeGreaterThan(0.015);
      const expectedTip = id === "shiv" ? -0.24 : id === "machete" ? -0.445 : -0.34;
      expect(zSpan(blade!)[0]).toBeCloseTo(expectedTip, 6);
    });
  }

  for (const id of ["knife_tactical", "machete"]) {
    test(`${id}: bolster intersects both the blade and the handle`, () => {
      const parts = build(id);
      const handle = parts.find(({ mesh }) => mesh.material === grip && zSpan(mesh)[1] > 0.11)!.mesh;
      const bolster = parts.find(({ mesh }) => mesh.material === grip && mesh !== handle)!.mesh;
      const blade = parts.find(({ mesh }) => mesh.material === metal)!.mesh;
      expect(overlap(bolster, handle)).toBeGreaterThan(0.01);
      expect(overlap(bolster, blade)).toBeGreaterThan(0.01);
    });
  }

  test("both throwing knives have blades, bolsters and handles that overlap", () => {
    const parts = build("baton");
    for (const x of [-0.055, 0.055]) {
      const pair = parts.filter(p => p.x === x).map(p => p.mesh);
      const blade = pair.find(p => p.geometry instanceof THREE.ConeGeometry)!;
      const handle = pair.find(p => p.material === grip)!;
      const bolster = pair.find(p => p.material === metal && p !== blade)!;
      expect(overlap(blade, bolster)).toBeGreaterThan(0.01);
      expect(overlap(handle, bolster)).toBeGreaterThan(0.01);
    }
  });
});
