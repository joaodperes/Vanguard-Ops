import {describe, expect, test} from "bun:test";
import * as THREE from "three";
import {PLAYER_SKINS} from "../src/lib/game-data";
import {addOperativeSkinDetails, operativeSignature, OPERATIVE_SIGNATURES, type OperativeBodyMounts} from "../src/lib/operative-appearance";

function body() {
  const root = new THREE.Group();
  const torso = new THREE.Group(); root.add(torso);
  const head = new THREE.Group(); head.position.y = 1.62; root.add(head);
  const upperArmL = new THREE.Group(); upperArmL.position.set(.30, 1.40, 0); root.add(upperArmL);
  const upperArmR = new THREE.Group(); upperArmR.position.set(-.30, 1.40, 0); root.add(upperArmR);
  const upperLegL = new THREE.Group(); upperLegL.position.set(.13, .80, 0); root.add(upperLegL);
  const upperLegR = new THREE.Group(); upperLegR.position.set(-.13, .80, 0); root.add(upperLegR);
  return {root, mounts: {torso,head,upperArmL,upperArmR,upperLegL,upperLegR} satisfies OperativeBodyMounts};
}
function dispose(root: THREE.Group) {
  const materials = new Set<THREE.Material>();
  root.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m: THREE.Material) => materials.add(m));
      else materials.add(o.material);
    }
  });
  materials.forEach(m => m.dispose());
}
describe("operative rarity actually changes cosmetic geometry", () => {
  test("every catalog skin has its own authored identity, with no unknown fallback", () => {
    expect(Object.keys(OPERATIVE_SIGNATURES).sort()).toEqual(PLAYER_SKINS.map(s=>s.id).sort());
    const signatures=PLAYER_SKINS.map(operativeSignature);
    expect(new Set(signatures).size).toBe(PLAYER_SKINS.length);
  });

  test("rarity provides an increasing minimum amount of modeled equipment", () => {
    const minimum={common:0,rare:9,epic:17,legendary:27};
    const results: Record<string, number>={};
    for (const skin of PLAYER_SKINS) {
      const {root,mounts}=body();
      const result=addOperativeSkinDetails(skin,mounts);
      expect(result.signature).toBe(OPERATIVE_SIGNATURES[skin.id]);
      expect(result.details).toBeGreaterThanOrEqual(minimum[skin.rarity]);
      expect(result.meshes).toBeLessThanOrEqual(18);
      expect(result.details).toBeGreaterThanOrEqual(result.meshes);
      results[skin.id]=result.details;
      dispose(root);
    }
    expect(results.crimson_lord).toBeGreaterThan(results.phantom);
    expect(results.phantom).toBeGreaterThan(results.green);
    expect(results.green).toBeGreaterThan(results.red);
  });

  test("geometry stays within readable combatant silhouette and does not create hitboxes", () => {
    for (const skin of PLAYER_SKINS) {
      const {root,mounts}=body();
      const result=addOperativeSkinDetails(skin,mounts);
      if (result.meshes) {
        const bounds=new THREE.Box3().setFromObject(root);
        expect(bounds.max.x - bounds.min.x).toBeLessThan(1.65);
        expect(bounds.max.z - bounds.min.z).toBeLessThan(1.0);
        expect(bounds.max.y).toBeLessThan(2.4);
        expect(bounds.min.y).toBeGreaterThan(0.2);
        root.traverse(object=>{
          if (object instanceof THREE.Mesh) {
            expect(object.name.startsWith("operative-cosmetic-")).toBe(true);
            expect(object.userData.hitbox).toBeUndefined();
          }
        });
      }
      dispose(root);
    }
  });

  test("skin palettes remain validated hex colors and shop unlock ids stay stable", () => {
    for(const skin of PLAYER_SKINS){
      expect(skin.color).toMatch(/^#[\da-fA-F]{6}$/);
      expect(skin.accent).toMatch(/^#[\da-fA-F]{6}$/);
      expect(skin.emissive === undefined || /^#[\da-fA-F]{6}$/.test(skin.emissive)).toBe(true);
    }
    expect(PLAYER_SKINS.some(s=>s.id==="crimson_lord" && s.rarity==="legendary")).toBe(true);
    expect(PLAYER_SKINS.some(s=>s.id==="shop_phantom" && s.rarity==="legendary")).toBe(true);
  });
});
