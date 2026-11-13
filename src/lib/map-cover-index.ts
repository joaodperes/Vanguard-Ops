import { CoverSpatialIndex } from "./cover-spatial-index";
import type { CoverBox } from "./game-protocol";

type CoverMap = { cover: CoverBox[] };

/** Static cells plus live environment boxes. Moving platforms, deployed cover
 * and falling freight never enter an immutable cell at an obsolete position. */
class MapCoverIndex extends CoverSpatialIndex {
  constructor(cover: readonly CoverBox[], private readonly dynamic: readonly CoverBox[]) {
    super(cover.filter(box => !box.environmentId));
  }
  override queryBox(minX: number, maxX: number, minZ: number, maxZ: number): CoverBox[] {
    if(![minX,maxX,minZ,maxZ].every(Number.isFinite)||minX>maxX||minZ>maxZ)return [];
    const found = super.queryBox(minX, maxX, minZ, maxZ);
    for (const box of this.dynamic)
      if (box.pos[0] + box.size[0] >= minX && box.pos[0] - box.size[0] <= maxX &&
          box.pos[2] + box.size[2] >= minZ && box.pos[2] - box.size[2] <= maxZ) found.push(box);
    return found;
  }
}

const indexes = new WeakMap<CoverMap, { source: CoverBox[]; length: number; index: MapCoverIndex }>();

export function invalidateMapCoverIndex(map: CoverMap): void { indexes.delete(map); }

export function mapCoverIndex(map: CoverMap): CoverSpatialIndex {
  let cached = indexes.get(map);
  if (!cached || cached.source !== map.cover || cached.length !== map.cover.length) {
    cached = { source: map.cover, length: map.cover.length,
      index: new MapCoverIndex(map.cover, map.cover.filter(box => !!box.environmentId)) };
    indexes.set(map, cached);
  }
  return cached.index;
}
