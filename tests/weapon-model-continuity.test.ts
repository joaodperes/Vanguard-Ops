import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { WEAPON_VISUALS, buildFirstPersonWeapon } from "../src/lib/weapon-models";

/** Inspect the actual procedural meshes, not just the authored positions.
 * All coordinates are in weapon-local space; the engine rotates every part
 * together using one quaternion so an overlap here persists during animations.
 */
function build(id: string) {
  const body = new THREE.MeshBasicMaterial();
  const furniture = new THREE.MeshBasicMaterial();
  const parts: THREE.Object3D[] = [];
  buildFirstPersonWeapon(id, body, furniture, (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    parts.push(mesh);
  });
  return parts;
}
function part(parts: THREE.Object3D[], name: string) {
  const matches = parts.filter(p => p.name === name);
  expect(matches.length, `missing ${name}`).toBeGreaterThan(0);
  return matches[0];
}
function partsNamed(parts: THREE.Object3D[], name: string) {
  return parts.filter(p => p.name === name);
}
function overlap(a: THREE.Object3D, b: THREE.Object3D) {
  const aa = new THREE.Box3().setFromObject(a);
  const bb = new THREE.Box3().setFromObject(b);
  const intersection = aa.intersect(bb);
  const size = new THREE.Vector3();
  intersection.getSize(size);
  return Math.min(size.x, size.y, size.z);
}
function assertAttached(a: THREE.Object3D, b: THREE.Object3D, context: string) {
  // Strictly positive THREE-axis overlap; tangential, coplanar surfaces
  // are not considered securely attached.
  expect(overlap(a, b), context).toBeGreaterThan(0.001);
}

describe("procedural firearm physical continuity", () => {
  for (const [id, spec] of Object.entries(WEAPON_VISUALS)) {
    test(`${id}: structural receiver, barrel, grip and stock do not float`, () => {
      const meshes = build(id);
      // Bastion deliberately replaces the generic solid receiver with an
      // open revolver frame. Its named frame joins have separate detailed tests.
      if (id === "pistol_bastion") return;
      // Deployment electronics are intentionally not firearms. Enforce the
      // handheld screen and absence of a rifle receiver instead.
      if (["wonder_juggernaut","wonder_chrono","wonder_phantom"].includes(id)) {
        expect(partsNamed(meshes,"wonder_controller_display")).toHaveLength(1);
        expect(partsNamed(meshes,"weapon_receiver")).toHaveLength(0);
        return;
      }
      const receiver = part(meshes, "weapon_receiver");

      if (spec.magazine === "rocket") {
        const tube = part(meshes, "weapon_launcher_tube");
        const collar = part(meshes, "weapon_launcher_front_ring");
        const muzzleRing = part(meshes, "weapon_launcher_muzzle_ring");
        assertAttached(tube, receiver, `${id}: receiver to launcher tube`);
        assertAttached(tube, collar, `${id}: core to first muzzle collar`);
        assertAttached(tube, muzzleRing, `${id}: core to second muzzle collar`);
        return;
      }

      const guard = part(meshes, "weapon_handguard");
      const barrel = part(meshes, "weapon_barrel");
      assertAttached(receiver, guard, `${id}: receiver to handguard`);
      assertAttached(guard, barrel, `${id}: handguard to barrel`);

      const grip = part(meshes, "weapon_grip");
      const tang = partsNamed(meshes, "weapon_grip_tang")[0];
      if (tang) {
        assertAttached(receiver, tang, `${id}: receiver to lower frame tang`);
        assertAttached(tang, grip, `${id}: frame tang to grip`);
      } else {
        assertAttached(receiver, grip, `${id}: receiver to grip`);
      }

      if (spec.stock !== "none") {
        for (const stem of partsNamed(meshes, "weapon_stock_stem")) {
          assertAttached(receiver, stem, `${id}: stock stem to receiver`);
        }
      }
      if (spec.stock === "bullpup") {
        const stem = part(meshes, "weapon_stock_stem");
        const lower = part(meshes, "weapon_stock_lower");
        const bridge = part(meshes, "weapon_stock_bridge");
        assertAttached(stem, bridge, `${id}: butt upper to bridge`);
        assertAttached(lower, bridge, `${id}: butt lower to bridge`);
      }
      if (spec.features.includes("rail") || spec.features.includes("scope")) {
        assertAttached(receiver, part(meshes, "weapon_top_rail"), `${id}: optic rail`);
      }
      if (spec.features.includes("carry")) {
        const bridge = part(meshes, "weapon_carry_bridge");
        for (const post of partsNamed(meshes, "weapon_carry_post")) {
          assertAttached(receiver, post, `${id}: carry-handle post base`);
          assertAttached(bridge, post, `${id}: carry-handle post top`);
        }
      }
      if (spec.features.includes("guard")) {
        assertAttached(guard, part(meshes, "weapon_under_guard"), `${id}: underbarrel guard`);
      }
      if (spec.features.includes("bipod")) {
        const mount = part(meshes, "weapon_bipod_mount");
        assertAttached(guard, mount, `${id}: bipod mount to handguard`);
        for (const leg of partsNamed(meshes, "weapon_bipod_leg")) {
          assertAttached(mount, leg, `${id}: bipod leg to crossbar`);
        }
      }
      if (spec.features.includes("shells")) {
        const saddle = part(meshes, "weapon_shell_holder");
        assertAttached(receiver, saddle, `${id}: shotgun shell holder`);
        for (const shell of partsNamed(meshes, "weapon_shell")) {
          assertAttached(saddle, shell, `${id}: shell to side saddle`);
        }
      }
      if (id === "pistol_arc") {
        const sleeve = part(meshes, "weapon_arc_coil_sleeve");
        assertAttached(sleeve, barrel, "arc pistol: emitter housing to barrel");
        for (const coil of partsNamed(meshes, "weapon_arc_coil")) {
          assertAttached(sleeve, coil, "arc pistol: coil to emitter housing");
        }
      }
    });
  }
});
