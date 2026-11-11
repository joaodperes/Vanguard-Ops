import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Collapse adjacent opaque static meshes with a shared material into one
 * draw call. Only direct mesh children are considered; nested groups, mutable
 * ballistic/destructible parts, name-addressable meshes and transparent
 * ornaments are kept intact. Positions are baked in the parent's local space.
 *
 * Run once after constructing a map prop and before adding it to the scene.
 * This never alters MapDef.cover or any gameplay collision geometry.
 */
export function batchStaticPropMeshes(group: THREE.Group): number {
  const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) ||
        !(child.geometry instanceof THREE.BufferGeometry) ||
        Array.isArray(child.material) || child.material.transparent ||
        child.material.depthWrite === false ||
        child.material.blending !== THREE.NormalBlending ||
        child.children.length || child.name || Object.keys(child.userData).length)
      continue;
    const list = byMaterial.get(child.material) ?? [];
    list.push(child);
    byMaterial.set(child.material, list);
  }

  let drawsSaved = 0;
  for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    // BufferGeometryUtils requires matching indexed state and attributes.
    // Split incompatible primitives rather than risking missing geometry.
    const compatible = new Map<string, THREE.Mesh[]>();
    for (const mesh of meshes) {
      const g = mesh.geometry;
      const attributes = Object.keys(g.attributes).sort().map(key => {
        const a = g.getAttribute(key);
        return key + ":" + a.itemSize + ":" + a.normalized;
      }).join(",");
      const signature = (g.index ? "indexed:" : "unindexed:") + attributes;
      const bucket = compatible.get(signature) ?? [];
      bucket.push(mesh);
      compatible.set(signature, bucket);
    }
    for (const bucket of compatible.values()) {
      if (bucket.length < 2) continue;
      const clones = bucket.map(mesh => {
        mesh.updateMatrix();
        return mesh.geometry.clone().applyMatrix4(mesh.matrix);
      });
      const merged = mergeGeometries(clones, false);
      for (const geometry of clones) geometry.dispose();
      if (!merged) continue;
      const replacement = new THREE.Mesh(merged, material);
      replacement.castShadow = bucket.some(mesh => mesh.castShadow);
      replacement.receiveShadow = bucket.some(mesh => mesh.receiveShadow);
      replacement.renderOrder = bucket[0].renderOrder;
      replacement.name = "static_prop_batch";
      for (const mesh of bucket) group.remove(mesh);
      group.add(replacement);
      drawsSaved += bucket.length - 1;
    }
  }
  return drawsSaved;
}
