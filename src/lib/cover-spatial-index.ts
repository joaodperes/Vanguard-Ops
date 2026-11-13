/** Immutable broadphase for static map collision. Never changes actual
 * CoverBox physics: only excludes boxes whose X/Z bounds cannot possibly
 * intersect a small local query. Use only on static maps (no moving cover). */
import type {CoverBox} from "./game-protocol";

export class CoverSpatialIndex{
  private readonly cells=new Map<string,CoverBox[]>();
  private minCellX=Infinity;
  private maxCellX=-Infinity;
  private minCellZ=Infinity;
  private maxCellZ=-Infinity;
  constructor(private readonly cover:readonly CoverBox[],private readonly cellSize=16){
    if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError("cellSize must be positive");
    for(const b of cover){
      const a=Math.floor((b.pos[0]-b.size[0])/cellSize),z0=Math.floor((b.pos[2]-b.size[2])/cellSize);
      const right=Math.floor((b.pos[0]+b.size[0])/cellSize),z1=Math.floor((b.pos[2]+b.size[2])/cellSize);
      this.minCellX=Math.min(this.minCellX,a);this.maxCellX=Math.max(this.maxCellX,right);
      this.minCellZ=Math.min(this.minCellZ,z0);this.maxCellZ=Math.max(this.maxCellZ,z1);
      for(let x=a;x<=right;x++)for(let z=z0;z<=z1;z++){
        const key=x+","+z;
        const cell=this.cells.get(key)??[];
        cell.push(b);this.cells.set(key,cell);
      }
    }
  }
  queryBox(minX:number,maxX:number,minZ:number,maxZ:number):CoverBox[]{
    if(![minX,maxX,minZ,maxZ].every(Number.isFinite)||minX>maxX||minZ>maxZ)return [];
    const x0=Math.max(this.minCellX,Math.floor(minX/this.cellSize)),x1=Math.min(this.maxCellX,Math.floor(maxX/this.cellSize));
    const z0=Math.max(this.minCellZ,Math.floor(minZ/this.cellSize)),z1=Math.min(this.maxCellZ,Math.floor(maxZ/this.cellSize));
    if(x0>x1||z0>z1)return [];
    const width=x1-x0+1,depth=z1-z0+1;
    // Very long/wide queries are cheaper as one bounded scan. This also
    // prevents huge finite packet coordinates from creating unbounded loops.
    if(width*depth>this.cells.size*2)return this.cover.filter(b=>
      b.pos[0]+b.size[0]>=minX&&b.pos[0]-b.size[0]<=maxX&&
      b.pos[2]+b.size[2]>=minZ&&b.pos[2]-b.size[2]<=maxZ);
    const selected=new Set<CoverBox>();
    for(let x=x0;x<=x1;x++)
      for(let z=z0;z<=z1;z++){
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
