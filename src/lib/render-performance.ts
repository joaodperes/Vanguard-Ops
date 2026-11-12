import type { CoverBox } from "./game-protocol";

/** GPU and cosmetic options only — must never gate collision, hits or simulation. */
export type RenderQuality = "performance" | "balanced" | "quality";

export function pixelRatioCap(mode: RenderQuality, city: boolean, crowded: boolean): number {
  const cap = mode === "performance" ? (city ? 0.9 : 1.0)
    : mode === "quality" ? (city ? 1.35 : 2.0)
    : city ? 1.15 : 1.5;
  return crowded && mode !== "quality" ? cap * 0.88 : cap;
}

/** Culling is restricted to non-collision decorative city interior meshes. */
export function cityDetailDistance(mode: RenderQuality): number {
  return mode === "performance" ? 34 : mode === "quality" ? 74 : 52;
}

/** Partition visual city-cover draw calls; the actual CoverBox list is untouched. */
export function partitionCoverIntoRenderCells<T extends Pick<CoverBox,"pos">>(
  boxes: readonly T[], cellSize = 64,
): T[][] {
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError("cellSize must be positive");
  const cells=new Map<string,T[]>();
  for(const box of boxes){
    const key=Math.floor(box.pos[0]/cellSize)+":"+Math.floor(box.pos[2]/cellSize);
    let cell=cells.get(key);
    if(!cell){cell=[];cells.set(key,cell);}
    cell.push(box);
  }
  return [...cells.values()];
}

/** Cosmetic rig poses only; all actors still move, attack and take damage each tick. */
export function botAnimationIntervalMs(
  mode: RenderQuality, far: boolean, behind: boolean,
): number {
  if(!far&&!behind)return 0;
  return mode==="performance"?260:mode==="quality"?120:180;
}
