/** Low-cost obstacle-aware 2D routing for dense maps (Bunker centre). Uses A*
 * over a coarse grid and returns the next waypoint, with no persistent state.
 * Obstacle inflation approximates bot capsule radius. */
export function botNextWaypoint(start: readonly number[], goal: readonly number[],
  cover: readonly {pos:readonly number[];size:readonly number[];kind?:string}[],
  bounds: number, step=3): [number,number,number] | null {
  const sx=Math.round(start[0]/step), sz=Math.round(start[2]/step);
  const gx=Math.round(goal[0]/step), gz=Math.round(goal[2]/step);
  const key=(x:number,z:number)=>`${x},${z}`;
  const blocked=(x:number,z:number)=> {
    const px=x*step,pz=z*step;
    if (Math.abs(px)>=bounds-1 || Math.abs(pz)>=bounds-1) return true;
    return cover.some(b=>b.kind!=="accent"&&b.kind!=="stair"&&b.kind!=="platform"&&b.pos[1]+b.size[1]>1.15 &&
      Math.abs(px-b.pos[0])<b.size[0]+.8 && Math.abs(pz-b.pos[2])<b.size[2]+.8);
  };
  if(Math.hypot(start[0]-goal[0],start[2]-goal[2])<step) return null;
  const entries=[{x:sx,z:sz,cost:0,est:Math.hypot(gx-sx,gz-sz)}];
  const best=new Map<string,number>([[key(sx,sz),0]]), parent=new Map<string,string>();
  const steps=[[1,0],[-1,0],[0,1],[0,-1]];
  let goalKey="";
  for(let iter=0;entries.length&&iter<650;iter++) {
    entries.sort((a,b)=>a.cost+a.est-b.cost-b.est);
    const cur=entries.shift()!;const here=key(cur.x,cur.z);
    if(cur.cost>(best.get(here)??Infinity))continue;
    if(Math.hypot(cur.x-gx,cur.z-gz)<=1.2){goalKey=here;break;}
    for(const [dx,dz] of steps){const nx=cur.x+dx,nz=cur.z+dz;
      if(blocked(nx,nz))continue;
      const k=key(nx,nz), cost=cur.cost+1;
      if(cost>=(best.get(k)??Infinity))continue;
      best.set(k,cost);parent.set(k,here);
      entries.push({x:nx,z:nz,cost,est:Math.hypot(nx-gx,nz-gz)});
    }
  }
  if(!goalKey)return null;
  let p=goalKey,prev=p;
  while(parent.has(p)&&parent.get(p)!==key(sx,sz)){prev=p;p=parent.get(p)!;}
  const [x,z]=(parent.has(p)?p:prev).split(",").map(Number);
  return [x*step,start[1],z*step];
}
