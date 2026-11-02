/** Immutable broadphase for static map collision. Never changes actual
 * CoverBox physics: only excludes boxes whose X/Z bounds cannot possibly
 * intersect a small local query. Use only on static maps (no moving cover). */
import type {CoverBox} from "./game-protocol";

export class CoverSpatialIndex{
  private readonly cells=new Map<string,CoverBox[]>();
  constructor(cover:readonly CoverBox[],private readonly cellSize=16){
    for(const b of cover){
      const a=Math.floor((b.pos[0]-b.size[0])/cellSize),z0=Math.floor((b.pos[2]-b.size[2])/cellSize);
      const right=Math.floor((b.pos[0]+b.size[0])/cellSize),z1=Math.floor((b.pos[2]+b.size[2])/cellSize);
      for(let x=a;x<=right;x++)for(let z=z0;z<=z1;z++){
        const key=x+","+z;
        const cell=this.cells.get(key)??[];
        cell.push(b);this.cells.set(key,cell);
      }
    }
  }
  queryBox(minX:number,maxX:number,minZ:number,maxZ:number):CoverBox[]{
    const selected=new Set<CoverBox>(),step=this.cellSize;
    for(let x=Math.floor(minX/step);x<=Math.floor(maxX/step);x++)
      for(let z=Math.floor(minZ/step);z<=Math.floor(maxZ/step);z++){
        for(const b of this.cells.get(x+","+z)??[])
          if(b.pos[0]+b.size[0]>=minX&&b.pos[0]-b.size[0]<=maxX&&
             b.pos[2]+b.size[2]>=minZ&&b.pos[2]-b.size[2]<=maxZ)selected.add(b);
      }
    return [...selected];
  }
  near(x:number,z:number,pad=3):CoverBox[]{
    return this.queryBox(x-pad,x+pad,z-pad,z+pad);
  }
  along(x1:number,z1:number,x2:number,z2:number,pad=2):CoverBox[]{
    return this.queryBox(Math.min(x1,x2)-pad,Math.max(x1,x2)+pad,
      Math.min(z1,z2)-pad,Math.max(z1,z2)+pad);
  }
}
