/**
 * City physics proxy meshes must not z-fight with detailed prop meshes.
 *
 * All colliders stay in MapDef.cover for movement, bullets and server parity.
 * This file only identifies the subset whose visual representation already
 * comes from buildMapProps(). Building walls/roof/stairs remain visible through
 * the normal instanced cover renderer.
 */
import type { CoverBox } from "./game-protocol";
import { cityBandstandBoxes, cityBuildingBoxes, cityInteriorFixtures,
  propColliders, type MapProp } from "./map-visuals";

/** Stable at authored/map-physics precision, including rotated fixtures. */
export function cityCoverKey(box: Pick<CoverBox, "pos" | "size">): string {
  return [...box.pos, ...box.size].map(n => n.toFixed(4)).join(":");
}

/** Detail meshes take precedence; never remove the actual physics boxes. */
export function hiddenCityColliderKeys(props: readonly MapProp[]): Set<string> {
  const hidden = new Set<string>();
  const hide = (boxes: readonly CoverBox[]) => {
    for (const box of boxes) hidden.add(cityCoverKey(box));
  };

  for (const prop of props) {
    if (prop.kind === "building") {
      const turn = (((prop.turns ?? 0) % 4) + 4) % 4;
      const w = turn % 2 ? prop.d ?? 20 : prop.w ?? 20;
      const d = turn % 2 ? prop.w ?? 20 : prop.d ?? 20;
      const fixtureCount = cityInteriorFixtures({ ...prop, w, d }).length;
      // cityBuildingBoxes appends furniture + partition AABBs after the
      // architectural walls, roofs and real staircase treads.
      if (fixtureCount) hide(cityBuildingBoxes(prop).slice(-fixtureCount));
    } else if (prop.kind === "bandstand") {
      // The four decorative columns coincide exactly with pillar colliders.
      hide(cityBandstandBoxes(prop).slice(-4));
    } else if (prop.kind === "bench" || prop.kind === "shop" ||
      prop.kind === "container" || prop.kind === "boat" || prop.kind === "dock") {
      // These detailed solid props already fill or dress their own proxy.
      hide(propColliders([prop], []));
    }
  }
  return hidden;
}
