import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { JUGGERNAUT_VISUAL_PALETTE, wonderMechModel } from "../src/lib/wonder-models";
import { addSurvivalBossArmor, updateSurvivalBossArmor } from "../src/lib/survival-boss-visuals";

function makeBossRig() {
  const root = new THREE.Group();
  const torso = new THREE.Group(); root.add(torso);
  const head = new THREE.Group(); head.position.y = 1.62; root.add(head);
  const arm = (side: number) => {
    const upper = new THREE.Group();
    upper.position.set(side * 0.30, 1.40, 0);
    root.add(upper);
    return upper;
  };
  const leg = (side: number) => {
    const upper = new THREE.Group();
    upper.position.set(side * 0.13, 0.80, 0);
    const lower = new THREE.Group();
    lower.position.y = -0.42;
    upper.add(lower);
    root.add(upper);
    return { upper, lower };
  };
  const left = leg(1), right = leg(-1);
  const upperArmL = arm(1), upperArmR = arm(-1);
  const parts = {
    root, torso, head, upperArmL, upperArmR,
    upperLegL: left.upper, upperLegR: right.upper,
    lowerLegL: left.lower, lowerLegR: right.lower,
  };
  const visual = addSurvivalBossArmor(parts);
  root.updateMatrixWorld(true);
  return { parts, visual, root };
}
function mesh(root: THREE.Object3D, name: string): THREE.Mesh {
  const found = root.getObjectByName("survival_boss_" + name);
  expect(found instanceof THREE.Mesh).toBe(true);
  return found as THREE.Mesh;
}
function shellBounds(root: THREE.Group) {
  const bounds = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o instanceof THREE.Mesh && o.name.startsWith("survival_boss_")
        && !o.name.includes("shockwave")) bounds.union(new THREE.Box3().setFromObject(o));
  });
  return bounds;
}

describe("Survival boss Juggernaut suit", () => {
  test("uses the same blue-grey chassis and visible blue visor as the player's drop", () => {
    const { root, visual } = makeBossRig();
    const mech = wonderMechModel();
    const mechArmor = mech.group.children.find(o =>
      o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).color.getHex() === JUGGERNAUT_VISUAL_PALETTE.armor);
    expect(mechArmor).toBeTruthy();
    expect((mesh(root, "chassis").material as THREE.MeshStandardMaterial).color.getHex())
      .toBe(JUGGERNAUT_VISUAL_PALETTE.armor);
    expect((mesh(root, "helmet_visor").material as THREE.MeshStandardMaterial).color.getHex())
      .toBe(JUGGERNAUT_VISUAL_PALETTE.visor);
    expect(visual.core.name).toBe("survival_boss_reactor_core");
    expect(visual.chargedParts).toHaveLength(3);
    mech.dispose();
  });

  test("has an unmistakable heavy-mech silhouette without modifying collision", () => {
    const { root, parts } = makeBossRig();
    const bounds = shellBounds(root);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(1.75); // big raised shoulder housings
    expect(bounds.max.y).toBeGreaterThan(2.0); // armored rear reactor fins
    expect(bounds.max.y).toBeLessThan(2.25); // clear the ordinary nameplate
    expect(mesh(root, "shoulder_left").parent).toBe(parts.torso);
    expect(mesh(root, "upper_arm_left").parent).toBe(parts.upperArmL);
    expect(mesh(root, "shin_left").parent).toBe(parts.lowerLegL);
    expect(mesh(root, "boot_right").parent).toBe(parts.lowerLegR);
    root.traverse(o => {
      if (o instanceof THREE.Mesh && o.name.startsWith("survival_boss_")) {
        expect(o.userData.hitbox).toBeUndefined();
        expect(o.userData.collider).toBeUndefined();
      }
    });
  });

  test("arm and leg shells follow the animated joints", () => {
    const { root, parts } = makeBossRig();
    const sleeve = mesh(root, "upper_arm_left");
    const boot = mesh(root, "boot_right");
    const armStart = sleeve.getWorldPosition(new THREE.Vector3());
    const bootStart = boot.getWorldPosition(new THREE.Vector3());
    parts.upperArmL.rotation.z = Math.PI / 3;
    parts.lowerLegR.rotation.x = Math.PI / 4;
    root.updateMatrixWorld(true);
    expect(sleeve.getWorldPosition(new THREE.Vector3()).distanceTo(armStart)).toBeGreaterThan(0.1);
    expect(boot.getWorldPosition(new THREE.Vector3()).distanceTo(bootStart)).toBeGreaterThan(0.1);
    expect(mesh(root, "chassis").parent).toBe(parts.torso);
  });

  test("phase color and shockwave warnings remain readable beside the blue visor", () => {
    const { root, visual } = makeBossRig();
    const visor = mesh(root, "helmet_visor").material as THREE.MeshStandardMaterial;
    updateSurvivalBossArmor(visual, "shotgun_auto", 0.5, 10000);
    expect((visual.core.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xffae39);
    expect((visual.warningRing.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0);
    expect(visor.color.getHex()).toBe(JUGGERNAUT_VISUAL_PALETTE.visor);
    updateSurvivalBossArmor(visual, "rifle_heavy", 1, 10100);
    expect((visual.core.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x9d73ff);
    updateSurvivalBossArmor(visual, "rifle_heavy", 0, 10200);
    expect((visual.shockwaveRing.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0);
    expect((visual.warningRing.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    expect(visual.warningRing.material.depthTest).toBe(true);
    expect(visual.shockwaveRing.material.depthTest).toBe(true);
  });
});
