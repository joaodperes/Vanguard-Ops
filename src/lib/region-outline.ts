/** Return only the outside edges of the union of radar regions, not seams between overlapping rectangles. */
export interface RadarRegionRect { x:number; z:number; w:number; h:number }
export type OutlineSegment = readonly [number,number,number,number];

export function unionRegionOutline(regions: readonly RadarRegionRect[]): OutlineSegment[] {
  const valid=regions.filter(r=>[r.x,r.z,r.w,r.h].every(Number.isFinite) && r.w>0 && r.h>0);
  if (!valid.length) return [];
  const xs=[...new Set(valid.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
  const zs=[...new Set(valid.flatMap(r=>[r.z,r.z+r.h]))].sort((a,b)=>a-b);
  const inside=(x:number,z:number)=>valid.some(r=>x>=r.x && x<r.x+r.w && z>=r.z && z<r.z+r.h);
  const occupied=Array.from({length:xs.length-1},(_,i)=>
    Array.from({length:zs.length-1},(_,j)=>inside((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2)));
  const segments:OutlineSegment[]=[];
  for(let i=0;i<xs.length-1;i++) for(let j=0;j<zs.length-1;j++) {
    if(!occupied[i][j])continue;
    if(i===0||!occupied[i-1][j])segments.push([xs[i],zs[j],xs[i],zs[j+1]]);
    if(i===xs.length-2||!occupied[i+1][j])segments.push([xs[i+1],zs[j],xs[i+1],zs[j+1]]);
    if(j===0||!occupied[i][j-1])segments.push([xs[i],zs[j],xs[i+1],zs[j]]);
    if(j===zs.length-2||!occupied[i][j+1])segments.push([xs[i],zs[j+1],xs[i+1],zs[j+1]]);
  }
  return segments;
}

export function unionRegionOutlinePath(regions: readonly RadarRegionRect[]): string {
  return unionRegionOutline(regions).map(([x1,z1,x2,z2])=>`M${x1} ${z1} L${x2} ${z2}`).join(" ");
}
