/**
 * Shared JSON-authored layout grammar. Both the editor and the authoritative
 * server read these blueprints. Coordinates are world-space X/Z; box width/depth
 * are FULL extents in JSON (unlike CoverBox's half-extents).
 */
import source from "../data/map-blueprints.json";
import type { CoverBox, MapId, Vec3 } from "./game-protocol";

export interface MapRegion { x: number; z: number; w: number; d: number }
export interface MapFeature extends MapRegion {
  id: string; h: number; kind: "cover" | "platform" | "accent"; label?: string;
}
export interface MapBlueprint {
  name: string; shortName: string; description: string; pace: "compact" | "balanced" | "tactical"; templateMapId?: string;
  regions: MapRegion[]; features: MapFeature[];
  spawns: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] };
}
export interface MapBlueprintFile { version: number; units: string; maps: Record<string, MapBlueprint> }
export const MAP_BLUEPRINTS = source as MapBlueprintFile;

export function insideRegions(x: number, z: number, regions: readonly MapRegion[], padding = 0): boolean {
  return regions.some(r => Math.abs(x-r.x) <= r.w/2-padding && Math.abs(z-r.z) <= r.d/2-padding);
}

/** Exact union perimeter: split only at rectangle edges, then merge shared runs.
 * All concave re-entrant corners remain solid; internal shared edges disappear. */
export function regionBoundary(regions: readonly MapRegion[], height = 11): CoverBox[] {
  if (!regions.length) return [];
  const xs = [...new Set(regions.flatMap(r => [r.x-r.w/2, r.x+r.w/2]))].sort((a,b)=>a-b);
  const zs = [...new Set(regions.flatMap(r => [r.z-r.d/2, r.z+r.d/2]))].sort((a,b)=>a-b);
  const occupancy = Array.from({length:xs.length-1}, (_,i) =>
    Array.from({length:zs.length-1}, (_,j) =>
      insideRegions((xs[i]+xs[i+1])/2, (zs[j]+zs[j+1])/2, regions)));
  type Edge={axis:"x"|"z";at:number;start:number;end:number};
  const edges: Edge[]=[];
  for(let i=0;i<xs.length-1;i++) for(let j=0;j<zs.length-1;j++){
    if(!occupancy[i][j]) continue;
    if(i===0 || !occupancy[i-1][j]) edges.push({axis:"x",at:xs[i],start:zs[j],end:zs[j+1]});
    if(i===xs.length-2 || !occupancy[i+1][j]) edges.push({axis:"x",at:xs[i+1],start:zs[j],end:zs[j+1]});
    if(j===0 || !occupancy[i][j-1]) edges.push({axis:"z",at:zs[j],start:xs[i],end:xs[i+1]});
    if(j===zs.length-2 || !occupancy[i][j+1]) edges.push({axis:"z",at:zs[j+1],start:xs[i],end:xs[i+1]});
  }
  edges.sort((a,b)=>a.axis.localeCompare(b.axis)||a.at-b.at||a.start-b.start);
  const merged: Edge[]=[];
  for(const edge of edges){
    const last=merged[merged.length-1];
    if(last && edge.axis===last.axis && edge.at===last.at && edge.start<=last.end+0.0001)
      last.end=Math.max(last.end,edge.end);
    else merged.push({...edge});
  }
  return merged.map(e=>({
    pos: (e.axis==="x" ? [e.at,height/2,(e.start+e.end)/2] : [(e.start+e.end)/2,height/2,e.at]) as Vec3,
    size: (e.axis==="x" ? [0.9,height/2,(e.end-e.start)/2+0.45] : [(e.end-e.start)/2+0.45,height/2,0.9]) as Vec3,
    kind:"solid" as const,
  }));
}

export function featureBoxes(feature: MapFeature): CoverBox[] {
  const h=Math.max(0.3,feature.h);
  const main: CoverBox={pos:[feature.x,h/2,feature.z],size:[feature.w/2,h/2,feature.d/2],kind:feature.kind};
  if(feature.kind!=="platform")return [main];
  // Two physically walkable stair flights connect each elevated roof to grade.
  // Risers stay below the 0.55-unit step threshold used by client/server AI.
  const count=Math.ceil(h/0.42), tread=0.76;
  const steps:CoverBox[]=[];
  for(const sign of [-1,1]){
    for(let i=0;i<count;i++){
      const top=h*(i+1)/count;
      const distance=(count-i-0.5)*tread;
      steps.push({
        pos:[feature.x,top/2,feature.z+sign*(feature.d/2+distance)],
        size:[Math.min(2.2,feature.w/3),top/2,tread/2+0.02],
        kind:"stair",
      });
    }
  }
  return [main,...steps];
}

/** Reject malformed or out-of-area edits before a JSON draft is published. */
export function validateBlueprint(b: MapBlueprint): string[] {
  const issues:string[]=[];
  if(!b.regions?.length) issues.push("At least one walkable region is required");
  for(const [i,r] of (b.regions??[]).entries())
    if(![r.x,r.z,r.w,r.d].every(Number.isFinite) || r.w<8 || r.d<8)
      issues.push(`Region ${i+1} needs finite coordinates and at least 8x8 units`);
  const seen=new Set<string>();
  for(const [i,f] of (b.features??[]).entries()){
    if(!f.id || seen.has(f.id))issues.push(`Feature ${i+1} has a missing or duplicate ID`);
    seen.add(f.id);
    if(!["cover","accent","platform"].includes(f.kind)||![f.x,f.z,f.w,f.d,f.h].every(Number.isFinite)||f.w<=0||f.d<=0||f.h<=0)
      issues.push(`Feature ${f.id||i} has invalid geometry`);
    if(!insideRegions(f.x,f.z,b.regions??[])) issues.push(`Feature ${f.id||i} is outside walkable space`);
  }
  for(const team of ["ffa","red","blue"] as const){
    if(!b.spawns?.[team]?.length)issues.push(`Missing ${team} spawns`);
    for(const p of b.spawns?.[team]??[])
      if(!p.every(Number.isFinite)||!insideRegions(p[0],p[2],b.regions??[],1.1))
        issues.push(`${team} spawn at ${p[0]},${p[2]} outside walkable space`);
  }
  return issues;
}
