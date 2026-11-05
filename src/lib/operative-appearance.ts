import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlayerSkinDef } from "./game-data";

/**
 * Operative cosmetic geometry shared by the Armory preview and in-game models.
 * It is visual-only: no hitbox, physics, team color, or gameplay changes.
 *
 * All elements for one material on one articulated body part are combined into
 * a single mesh. This avoids a draw call per decorative rivet/plate when up to
 * 32 operatives appear in a match.
 */
export type OperativeSignature =
  | "standard" | "recon" | "sentinel" | "jungle" | "ember" | "spectre"
  | "phantom" | "crimson" | "urban" | "starlight" | "wraith"
  | "sandstorm" | "tidebreaker" | "solar" | "ion" | "verdant";

export const OPERATIVE_SIGNATURES: Readonly<Record<string, OperativeSignature>> = {
  default: "standard",
  red: "recon",
  blue: "sentinel",
  green: "jungle",
  orange: "ember",
  purple: "spectre",
  phantom: "phantom",
  crimson_lord: "crimson",
  shop_urban: "urban",
  shop_phantom: "starlight",
  shop_wraith: "wraith",
  shop_sandstorm: "sandstorm",
  shop_tide: "tidebreaker",
  shop_sentinel: "solar",
  shop_ion: "ion",
  shop_verdant: "verdant",
};

export function operativeSignature(skin: Pick<PlayerSkinDef, "id">): OperativeSignature {
  return OPERATIVE_SIGNATURES[skin.id] ?? "standard";
}

export interface OperativeBodyMounts {
  torso: THREE.Object3D;
  head: THREE.Object3D;
  upperArmL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  upperLegL: THREE.Object3D;
  upperLegR: THREE.Object3D;
}

type PartMaterial = "plate" | "shadow" | "trim" | "light";
type Mount = keyof OperativeBodyMounts;

export interface OperativeDetailResult {
  signature: OperativeSignature;
  /** Number of authored details, before geometry batching. */
  details: number;
  /** Number of actual draw meshes after batching. */
  meshes: number;
}

export function addOperativeSkinDetails(
  skin: PlayerSkinDef,
  mounts: OperativeBodyMounts,
): OperativeDetailResult {
  const signature = operativeSignature(skin);
  if (skin.rarity === "common") {
    return { signature, details: 0, meshes: 0 };
  }

  const plateColor = new THREE.Color(skin.color).lerp(new THREE.Color("#aab8ca"), 0.24);
  const accentColor = new THREE.Color(skin.accent);
  const lightColor = new THREE.Color(skin.emissive ?? skin.accent);
  const materials: Record<PartMaterial, THREE.Material> = {
    plate: new THREE.MeshStandardMaterial({ color: plateColor, metalness: .62, roughness: .43 }),
    shadow: new THREE.MeshStandardMaterial({ color: new THREE.Color(skin.color).multiplyScalar(.36), metalness: .44, roughness: .66 }),
    trim: new THREE.MeshStandardMaterial({ color: accentColor, metalness: .73, roughness: .28 }),
    light: new THREE.MeshStandardMaterial({
      color: lightColor, emissive: lightColor,
      emissiveIntensity: skin.rarity === "legendary" ? .95 : .52,
      metalness: .34, roughness: .32,
    }),
  };

  const batches = new Map<Mount, Map<PartMaterial, THREE.BufferGeometry[]>>();
  let details = 0;
  function box(mount: Mount, mat: PartMaterial, x: number, y: number, z: number,
               w: number, h: number, d: number, rotation = 0) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    if (rotation) geometry.rotateZ(rotation);
    geometry.translate(x, y, z);
    let byMaterial = batches.get(mount);
    if (!byMaterial) { byMaterial = new Map(); batches.set(mount, byMaterial); }
    const geometries = byMaterial.get(mat) ?? [];
    geometries.push(geometry);
    byMaterial.set(mat, geometries);
    details++;
  }
  function paired(mountsPair: [Mount, Mount], mat: PartMaterial,
                  x: number, y: number, z: number, w: number, h: number, d: number,
                  rotation = 0) {
    box(mountsPair[0], mat, x, y, z, w, h, d, rotation);
    box(mountsPair[1], mat, -x, y, z, w, h, d, -rotation);
  }

  // All Rare+ outfits have actual equipment, rather than just a palette swap.
  box("torso", "plate", 0, 1.21, .167, .34, .34, .075);
  box("torso", "shadow", 0, 1.04, .178, .40, .055, .06);
  paired(["upperArmL", "upperArmR"], "plate", 0, -.10, 0, .205, .16, .215);
  paired(["upperLegL", "upperLegR"], "shadow", 0, -.14, .11, .19, .22, .08);

  if (skin.rarity === "epic" || skin.rarity === "legendary") {
    // Epic has a different armored silhouette: raised collar, overlapping
    // plates, heavy guards and a rear equipment harness.
    paired(["upperArmL", "upperArmR"], "trim", 0, -.085, .112, .15, .045, .025);
    box("torso", "plate", 0, 1.47, -.02, .55, .10, .34);
    box("torso", "shadow", 0, 1.25, -.23, .38, .47, .15);
    box("torso", "trim", 0, 1.27, .22, .19, .10, .035);
    box("head", "shadow", 0, .02, -.13, .31, .31, .11);
    paired(["upperLegL", "upperLegR"], "plate", 0, -.19, .115, .15, .16, .045);
  }

  if (skin.rarity === "legendary") {
    // Legend-tier baseline: flared pauldrons, high-crested helmet, sculpted
    // chest and an energized rear core. Every legendary adds its own signature.
    paired(["upperArmL", "upperArmR"], "plate", 0, .055, -.04, .32, .11, .34, .18);
    paired(["upperArmL", "upperArmR"], "trim", 0, .105, -.03, .27, .025, .30, .18);
    box("torso", "plate", 0, 1.27, .245, .31, .27, .075);
    box("torso", "light", 0, 1.27, .296, .10, .11, .03);
    box("torso", "light", 0, 1.24, -.325, .12, .24, .04);
    paired(["upperLegL", "upperLegR"], "trim", 0, -.21, .145, .12, .025, .03);
    box("head", "plate", 0, .205, -.025, .20, .10, .25);
  }

  switch (signature) {
    case "jungle":
      // Broken ghillie outline / foliage packs.
      box("head", "plate", 0, .17, -.08, .36, .10, .29);
      paired(["upperArmL","upperArmR"], "shadow", .105, -.07, -.07, .11, .26, .13, .30);
      box("torso", "shadow", -.18, 1.08, .22, .12, .17, .08);
      box("torso", "shadow", .18, 1.08, .22, .12, .17, .08);
      break;
    case "ember":
      // Heat-resistant rescue/assault rig with twin rear tanks.
      box("torso", "trim", 0, 1.25, .23, .20, .05, .04);
      box("torso", "shadow", -.13, 1.18, -.31, .13, .34, .14);
      box("torso", "shadow", .13, 1.18, -.31, .13, .34, .14);
      box("head", "plate", 0, .15, 0, .30, .08, .31);
      break;
    case "spectre":
      // Faceted covert helmet and asymmetrical surveillance antenna.
      box("head", "shadow", -.17, .11, -.02, .07, .30, .11);
      box("head", "trim", .16, .20, -.08, .035, .23, .035);
      box("torso", "trim", -.12, 1.26, .22, .05, .26, .025, -.16);
      box("torso", "trim", .12, 1.26, .22, .05, .26, .025, .16);
      break;
    case "wraith":
      // Gas-mask muzzle, two filter cartridges, scavenged hood.
      box("head", "shadow", 0, -.075, .19, .17, .12, .12);
      box("head", "trim", -.13, -.085, .19, .09, .08, .12);
      box("head", "trim", .13, -.085, .19, .09, .08, .12);
      box("head", "plate", 0, .17, -.08, .35, .10, .34);
      box("torso", "shadow", -.18, 1.16, -.28, .10, .37, .08);
      break;
    case "phantom":
      // Low-profile stealth helmet, twin optical channels, cold power spine.
      box("head", "plate", 0, .18, -.035, .36, .11, .31);
      box("head", "light", -.095, .035, .165, .065, .035, .025);
      box("head", "light", .095, .035, .165, .065, .035, .025);
      box("torso", "light", 0, 1.22, -.324, .055, .33, .04);
      paired(["upperArmL", "upperArmR"], "shadow", 0, -.15, -.14, .17, .20, .06);
      break;
    case "urban":
      // Urban breach specialist: radio backpack, dual sensors, armor clips.
      box("torso", "shadow", .18, 1.24, -.33, .13, .38, .15);
      box("head", "plate", 0, .20, -.04, .32, .09, .32);
      box("head", "trim", .16, .20, .01, .05, .13, .08);
      box("torso", "trim", -.15, 1.21, .22, .055, .24, .035);
      paired(["upperLegL","upperLegR"], "shadow", .045, -.29, .1, .13, .15, .11);
      break;
    case "sandstorm":
      // Desert expedition wrap and face scarf, oversized shoulder cape.
      box("head", "plate", 0, .16, -.07, .40, .11, .32);
      box("head", "shadow", 0, -.08, .16, .27, .12, .07);
      box("torso", "plate", -.28, 1.25, -.04, .16, .50, .40, -.12);
      box("torso", "plate", .29, 1.20, -.04, .15, .43, .40, .15);
      box("torso", "trim", 0, 1.47, .06, .49, .06, .31);
      break;
    case "tidebreaker":
      // Heavy amphibious plating and distinctive twin breathing tanks.
      paired(["upperArmL","upperArmR"], "plate", 0, .07, .02, .30, .15, .31);
      box("head", "shadow", 0, -.09, .17, .18, .12, .12);
      box("torso", "plate", -.17, 1.20, -.32, .14, .44, .17);
      box("torso", "plate", .17, 1.20, -.32, .14, .44, .17);
      box("torso", "light", 0, 1.42, .21, .19, .05, .025);
      break;
    case "crimson":
      // Dark command armor with broad mantle, opposing crown fins.
      paired(["upperArmL","upperArmR"], "shadow", 0, -.25, -.11, .23, .39, .14);
      box("head", "trim", -.15, .30, -.03, .065, .25, .15, -.28);
      box("head", "trim", .15, .30, -.03, .065, .25, .15, .28);
      box("torso", "shadow", 0, 1.02, -.28, .50, .38, .11);
      box("torso", "light", 0, 1.27, .325, .06, .19, .02);
      break;
    case "starlight":
      // Celestial ranger with swept wing pauldrons and a star crest.
      paired(["upperArmL","upperArmR"], "trim", .13, .14, -.06, .17, .28, .12, .35);
      box("head", "light", 0, .36, -.02, .055, .20, .08);
      box("torso", "light", -.14, 1.26, .31, .045, .17, .02, .5);
      box("torso", "light", .14, 1.26, .31, .045, .17, .02, -.5);
      box("torso", "plate", 0, 1.16, -.39, .40, .36, .08);
      break;
    case "solar":
      // Solar-engine exosuit: radiator fins and a strong central power cell.
      box("head", "trim", -.16, .29, -.03, .07, .25, .14, -.24);
      box("head", "trim", .16, .29, -.03, .07, .25, .14, .24);
      box("torso", "light", 0, 1.27, .337, .19, .19, .02);
      box("torso", "trim", -.29, 1.23, -.30, .08, .48, .18, -.24);
      box("torso", "trim", .29, 1.23, -.30, .08, .48, .18, .24);
      break;
    case "ion":
      // Electromagnetic warfare suit: twin antenna towers and arc ribs.
      box("torso", "shadow", -.24, 1.30, -.32, .15, .45, .17);
      box("torso", "shadow", .24, 1.30, -.32, .15, .45, .17);
      box("torso", "light", -.24, 1.60, -.32, .055, .27, .055);
      box("torso", "light", .24, 1.60, -.32, .055, .27, .055);
      box("head", "light", 0, .045, .175, .24, .035, .025);
      box("torso", "light", -.20, 1.27, .265, .035, .27, .02);
      box("torso", "light", .20, 1.27, .265, .035, .27, .02);
      break;
    case "verdant":
      // Bio-tech guardian: branching canopy helmet, layered leaf-like armor.
      box("head", "plate", 0, .23, -.04, .39, .10, .30);
      box("head", "trim", -.17, .36, -.08, .07, .24, .13, -.35);
      box("head", "trim", .17, .36, -.08, .07, .24, .13, .35);
      paired(["upperArmL","upperArmR"], "plate", .14, .04, -.07, .16, .35, .18, .35);
      box("torso", "light", 0, 1.27, .334, .09, .24, .025);
      box("torso", "plate", 0, 1.03, -.32, .43, .30, .11);
      break;
  }

  let meshes = 0;
  for (const [mount, byMaterial] of batches) {
    for (const [material, geometries] of byMaterial) {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      if (!merged) throw new Error("Unable to combine operative cosmetic geometry");
      if (geometries.length > 1) geometries.forEach(geometry => geometry.dispose());
      const mesh = new THREE.Mesh(merged, materials[material]);
      mesh.name = "operative-cosmetic-" + signature + "-" + material;
      mesh.castShadow = material !== "light";
      mounts[mount].add(mesh);
      meshes++;
    }
  }
  // Materials only used by some variants do not need to remain allocated.
  for (const [name, material] of Object.entries(materials)) {
    if (![...batches.values()].some(byMaterial => byMaterial.has(name as PartMaterial))) material.dispose();
  }
  return { signature, details, meshes };
}
