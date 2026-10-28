/**
 * Shared JSON-authored layout grammar. Both the editor and the authoritative
 * server read these blueprints. Coordinates are world-space X/Z; box width/depth
 * are FULL extents in JSON (unlike CoverBox's half-extents).
 */
import {validateObjectives,type ObjectiveMap} from "./map-objectives";
import {MAP_DOCUMENTS} from "./map-documents";
import type { CoverBox, Vec3 } from "./game-protocol";

export interface MapRegion { x: number; z: number; w: number; d: number; shape?: "rect" | "circle" | "triangle" }
export interface MapFeature extends MapRegion {
  id: string; h: number; /** Bottom elevation in world units (default ground y=0). */ y?: number;
  kind: "cover" | "platform" | "accent" | "stairs"; label?: string;
  axis?: "x" | "z"; sign?: 1 | -1; autoStairs?: boolean;
  /** Saved quarter-turn orientation for Map Studio (collision extents remain axis-aligned). */
  turns?: 0 | 1 | 2 | 3;
  assemblyId?: string;
  /** Persistent landing connection. Edge is in world space; baseY is the lower floor. */
  attachment?: {platformId:string;edge:PlatformEdge;offset?:number;baseY?:number};
}
export type PlatformEdge="north"|"south"|"east"|"west";
export interface MapBlueprint extends ObjectiveMap {
  name: string; shortName: string; description: string; pace: "compact" | "balanced" | "tactical"; templateMapId?: string;
  regions: MapRegion[]; features: MapFeature[]; hazards?: MapHazard[];
  /** Indexes refer to the stable engine-authored portion of the compiled map.
   * Values are world-space box centers and full extents. */
  legacyCoverOverrides?: Record<string,MapBoxOverride>;
  legacyEnvironmentOverrides?: Record<string,MapBoxOverride>;
  /** Hide built-in collision/environment by original, stable source index. */
  legacyCoverDisabled?: number[];
  legacyEnvironmentDisabled?: number[];
  /** Stable IDs of procedurally generated city lots converted into authored props. */
  cityBuildingDisabled?: string[];
  spawns: { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] };
}
export interface MapBoxOverride {
  x:number; y:number; z:number; w:number; h:number; d:number;
  turns?: 0 | 1 | 2 | 3;
}
export function overrideBox<T extends {pos:Vec3;size:Vec3}>(box:T,edit?:MapBoxOverride):T {
  if(!edit)return box;
  return {...box,pos:[edit.x,edit.y,edit.z],size:[edit.w/2,edit.h/2,edit.d/2]} as T;
}
/** Compile inherited objects in their stable source order, excluding indices
 * deleted by Map Studio. Spatial overrides are applied by original index
 * BEFORE filtering so deleting an object never shifts another override. */
export function compileVisibleLegacyBoxes<T extends {pos:Vec3;size:Vec3}>(
  source:readonly T[],disabled:readonly number[]|undefined,
  overrides:Record<string,MapBoxOverride>|undefined,
):T[] {
  const hidden=new Set(disabled??[]);
  return source.flatMap((box,index)=>
    hidden.has(index)?[]:[overrideBox(box,overrides?.[String(index)])]);
}
export interface MapHazard {
  id: string; type: "fire" | "spikes" | "jump_pad" | "moving_platform" | "destructible_wall";
  x: number; z: number; y: number; w: number; d: number; h: number;
  dps?: number; damage?: number; period?: number; activeFor?: number; offset?: number;
  hp?: number; launchX?: number; launchY?: number; launchZ?: number;
  toX?: number; toY?: number; toZ?: number;
  turns?: 0 | 1 | 2 | 3;
}
export interface MapBlueprintFile { version: number; units: string; maps: Record<string, MapBlueprint> }
export const MAP_BLUEPRINTS:MapBlueprintFile={version:1,units:"world units; X/Z centres except stair landing anchors; widths/depths are FULL extents",maps:Object.fromEntries(Object.entries(MAP_DOCUMENTS).map(([id,d])=>[id,d.blueprint]))};

export function insideRegion(x:number,z:number,r:MapRegion,padding=0):boolean {
  const rx=r.w/2-padding,rz=r.d/2-padding;
  if(rx<=0||rz<=0)return false;
  const dx=Math.abs(x-r.x),dz=z-r.z;
  if(r.shape==="circle")return (dx/rx)**2+(dz/rz)**2<=1;
  if(r.shape==="triangle")return Math.abs(dz)<=rz&&dx<=rx*(dz+rz)/(2*rz);
  return dx<=rx&&Math.abs(dz)<=rz;
}
export function insideRegions(x:number,z:number,regions:readonly MapRegion[],padding=0):boolean {
  return regions.some(r=>insideRegion(x,z,r,padding));
}
/** Non-rectangular shapes are rendered in the existing AABB collision engine as
 * 2-unit strips. Rectangles remain exact. This approximation has stepped edges. */
export function regionRectangles(regions:readonly MapRegion[],step=2):MapRegion[]{
  return regions.flatMap(r=>{
    if(!r.shape||r.shape==="rect")return [{x:r.x,z:r.z,w:r.w,d:r.d}];
    const strips:MapRegion[]=[],rows=Math.min(120,Math.max(1,Math.ceil(r.d/step)));
    for(let i=0;i<rows;i++){
      const d=r.d/rows,z=r.z-r.d/2+(i+.5)*d;
      const span=r.shape==="circle"?Math.sqrt(Math.max(0,1-((z-r.z)/(r.d/2))**2)):
        (z-(r.z-r.d/2))/r.d;
      if(span>0.001)strips.push({x:r.x,z,w:r.w*span,d});
    }
    return strips;
  });
}
/** Exact union perimeter: split only at rectangle edges, then merge shared runs.
 * All concave re-entrant corners remain solid; internal shared edges disappear. */
export function regionBoundary(regions: readonly MapRegion[], height = 11): CoverBox[] {
  if (!regions.length) return [];
  const tiles=regionRectangles(regions);
  const xs = [...new Set(tiles.flatMap(r => [r.x-r.w/2, r.x+r.w/2]))].sort((a,b)=>a-b);
  const zs = [...new Set(tiles.flatMap(r => [r.z-r.d/2, r.z+r.d/2]))].sort((a,b)=>a-b);
  const occupancy = Array.from({length:xs.length-1}, (_,i) =>
    Array.from({length:zs.length-1}, (_,j) =>
      insideRegions((xs[i]+xs[i+1])/2, (zs[j]+zs[j+1])/2, tiles)));
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
  const h=Math.max(0.3,feature.h),baseY=feature.y??0;
  const main: CoverBox={pos:[feature.x,baseY+h/2,feature.z],size:[feature.w/2,h/2,feature.d/2],kind:feature.kind==="stairs"?"stair":feature.kind};
  if(feature.kind==="stairs")return stairFeatureBoxes(feature);
  if(feature.kind!=="platform"||feature.autoStairs===false)return [main];
  // Two physically walkable stair flights connect each elevated roof to grade.
  // Risers stay below the 0.55-unit step threshold used by client/server AI.
  const fullRise=Math.max(.3,baseY+h);
  const count=Math.ceil(fullRise/0.42), tread=0.76;
  const steps:CoverBox[]=[];
  for(const sign of [-1,1]){
    for(let i=0;i<count;i++){
      const top=fullRise*(i+1)/count;
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

/** Independent stairs rise toward their (x,z) landing, starting in the sign direction. */
export function stairFeatureBoxes(f:MapFeature):CoverBox[] {
  const h=Math.max(.3,f.h),baseY=f.y??0,steps=Math.ceil(h/.42),depth=f.d/steps,axis=f.axis??"z",sign=f.sign??1;
  return Array.from({length:steps},(_,i)=>{
    const top=h*(i+1)/steps,offset=sign*(steps-i-.5)*depth;
    return {pos:(axis==="z"?[f.x,baseY+top/2,f.z+offset]:[f.x+offset,baseY+top/2,f.z]) as Vec3,
      size:(axis==="z"?[f.w/2,top/2,depth/2+.02]:[depth/2+.02,top/2,f.w/2]) as Vec3,kind:"stair" as const};
  });
}
/** Place ground-box cover onto the top face of the closest elevated platform.
 * Never modify its thickness when changing the base elevation. */
export function snapCoverToPlatform(cover:MapFeature,features:readonly MapFeature[]):MapFeature|null {
  const platforms=features.filter(f=>f.kind==="platform"&&f.id!==cover.id);
  if(!platforms.length)return null;
  const overlapping=platforms.filter(p=>Math.abs(p.x-cover.x)<(p.w+cover.w)/2&&Math.abs(p.z-cover.z)<(p.d+cover.d)/2);
  const choices=overlapping.length?overlapping:platforms;
  const closest=choices.reduce((best,p)=>
    Math.hypot(p.x-cover.x,p.z-cover.z)<Math.hypot(best.x-cover.x,best.z-cover.z)?p:best);
  return {...cover,y:(closest.y??0)+closest.h};
}
export function nearestPlatformSnap(stair:MapFeature,features:readonly MapFeature[]):MapFeature|null {
  const candidates=features.filter(f=>f.kind==="platform").flatMap(p=>[
    {x:p.x,z:p.z-p.d/2,axis:"z" as const,sign:-1 as const,p},
    {x:p.x,z:p.z+p.d/2,axis:"z" as const,sign:1 as const,p},
    {x:p.x-p.w/2,z:p.z,axis:"x" as const,sign:-1 as const,p},
    {x:p.x+p.w/2,z:p.z,axis:"x" as const,sign:1 as const,p},
  ]);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>Math.hypot(a.x-stair.x,a.z-stair.z)-Math.hypot(b.x-stair.x,b.z-stair.z));
  const c=candidates[0];
  const edge:PlatformEdge=c.axis==="z"?(c.sign===1?"south":"north"):(c.sign===1?"east":"west");
  return attachStairsToPlatform(stair,c.p,edge);
}

/** Shared authoring/runtime bounds: stairs are anchored at their landing, not their centre. */
export function featureFootprint(f:MapFeature):MapRegion & {y:number;h:number} {
  if(f.kind!=="stairs")return {x:f.x,z:f.z,w:f.w,d:f.d,y:f.y??0,h:f.h};
  const axis=f.axis??"z",offset=(f.sign??1)*f.d/2;
  return {x:f.x+(axis==="x"?offset:0),z:f.z+(axis==="z"?offset:0),
    w:axis==="x"?f.d:f.w,d:axis==="x"?f.w:f.d,y:f.y??0,h:f.h};
}
export function attachStairsToPlatform(stair:MapFeature,platform:MapFeature,edge:PlatformEdge):MapFeature {
  const top=(platform.y??0)+platform.h;
  const baseY=(stair.y??0)<top-.3?(stair.y??0):0;
  return resolveStairAttachments([{...stair,attachment:{platformId:platform.id,edge,baseY}},platform])[0];
}
export function rotatePlatformEdge(edge:PlatformEdge,turns:number):PlatformEdge {
  const order:PlatformEdge[]=["north","west","south","east"];
  return order[((order.indexOf(edge)+Math.round(turns))%4+4)%4];
}
/** Derive all stair geometry from the saved connection in BOTH game simulations. */
export function resolveStairAttachments(features:readonly MapFeature[]):MapFeature[] {
  return features.map(f=>{
    if(f.kind!=="stairs"||!f.attachment)return f;
    const a=f.attachment,p=features.find(q=>q.id===a.platformId&&q.kind==="platform");
    if(!p)return f; // Preserve the broken reference for diagnostics; never silently retarget it.
    const axis=a.edge==="east"||a.edge==="west"?"x":"z";
    const sign:1|-1=a.edge==="east"||a.edge==="south"?1:-1;
    const width=Math.min(f.w,axis==="z"?p.w:p.d),baseY=a.baseY??0;
    const offset=Math.max(-((axis==="z"?p.w:p.d)-width)/2,
      Math.min(((axis==="z"?p.w:p.d)-width)/2,a.offset??0));
    const h=(p.y??0)+p.h-baseY;
    return {...f,x:p.x+(axis==="x"?sign*p.w/2:offset),z:p.z+(axis==="z"?sign*p.d/2:offset),
      y:baseY,h:Math.max(.3,h),w:width,d:Math.ceil(Math.max(.3,h)/.42)*.76,axis,sign};
  });
}
/** An editor rotation moves a saved connection to the corresponding new face. */
export function reconcileFeatureAttachments(next:readonly MapFeature[],previous:readonly MapFeature[]=[]):MapFeature[] {
  return resolveStairAttachments(next.map(f=>{
    if(!f.attachment)return f;
    const old=previous.find(p=>p.id===f.attachment!.platformId),p=next.find(p=>p.id===f.attachment!.platformId);
    const delta=(p?.turns??0)-(old?.turns??0);
    const previousStair=previous.find(q=>q.id===f.id);
    if(previousStair?.attachment&&previousStair.attachment.edge!==f.attachment.edge)return f;
    if(!old||!delta)return f;
    const edge=rotatePlatformEdge(f.attachment.edge,delta);
    let dx=f.attachment.edge==="north"||f.attachment.edge==="south"?(f.attachment.offset??0):0;
    let dz=dx===0&&(f.attachment.edge==="east"||f.attachment.edge==="west")?(f.attachment.offset??0):0;
    for(let i=0;i<((delta%4+4)%4);i++){const x=dx;dx=dz;dz=-x;}
    return {...f,attachment:{...f.attachment,edge,offset:edge==="north"||edge==="south"?dx:dz}};
  }));
}
export function authoredHazardEnvironment(h:MapHazard):import("./game-protocol").EnvironmentObject {
  const base={id:h.id,pos:[h.x,h.y,h.z] as Vec3,size:[h.w/2,h.h/2,h.d/2] as Vec3};
  switch(h.type){
    case "fire":return {...base,type:"fire",dps:h.dps??7};
    case "spikes":return {...base,type:"spikes",damage:h.damage??25,period:h.period??5,activeFor:h.activeFor??2,offset:h.offset??0};
    case "jump_pad":return {...base,type:"jump_pad",launch:[h.launchX??0,h.launchY??18,h.launchZ??0] as Vec3};
    case "moving_platform":return {...base,type:"moving_platform",to:[h.toX??h.x,h.toY??h.y,h.toZ??h.z] as Vec3,period:h.period??6};
    case "destructible_wall":return {...base,type:"destructible_wall",hp:h.hp??120};
  }
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
    if(!["cover","accent","platform","stairs"].includes(f.kind)||![f.x,f.z,f.w,f.d,f.h,f.y??0].every(Number.isFinite)||f.w<=0||f.d<=0||f.h<=0)
      issues.push(`Feature ${f.id||i} has invalid geometry`);
    if(!insideRegions(f.x,f.z,b.regions??[])) issues.push(`Feature ${f.id||i} is outside walkable space`);
    if(f.assemblyId!==undefined&&(typeof f.assemblyId!=="string"||!f.assemblyId||f.assemblyId.length>160))issues.push(`Feature ${f.id} invalid assembly`);
    if(f.attachment){
      const a=f.attachment,p=(b.features??[]).find(p=>p.id===a.platformId&&p.kind==="platform");
      if(f.kind!=="stairs"||!p||!["north","south","east","west"].includes(a.edge)||
        !Number.isFinite(a.offset??0)||!Number.isFinite(a.baseY??0))issues.push(`Feature ${f.id} invalid stair connection`);
      else if((p.y??0)+p.h-(a.baseY??0)<.3)issues.push(`Stairs ${f.id} need a landing above their starting floor`);
    }
  }
  for(const [i,r] of (b.regions??[]).entries())if(r.shape && !["rect","circle","triangle"].includes(r.shape))
    issues.push(`Region ${i+1} invalid shape`);
  for(const [i,f] of (b.features??[]).entries())if(f.kind==="stairs" &&
    ((f.axis!==undefined&&!["x","z"].includes(f.axis))||(f.sign!==undefined&&f.sign!==1&&f.sign!==-1)))
    issues.push(`Stairs ${f.id||i} invalid axis/sign`);
  for(const h of b.hazards??[]){
    if(!h.id||seen.has(h.id))issues.push(`Hazard ${h.id} missing/duplicate ID`);
    seen.add(h.id);
    if(!["fire","spikes","jump_pad","moving_platform","destructible_wall"].includes(h.type))
      issues.push(`Hazard ${h.id} invalid type`);
    if(![h.x,h.z,h.y,h.w,h.d,h.h].every(Number.isFinite)||h.w<=0||h.d<=0||h.h<=0)
      issues.push(`Hazard ${h.id} invalid geometry`);
    if(!insideRegions(h.x,h.z,b.regions??[]))issues.push(`Hazard ${h.id} outside walkable space`);
    if(h.type==="fire"&&!(Number.isFinite(h.dps)&&h.dps!>0))issues.push(`Hazard ${h.id} needs DPS > 0`);
    if(h.type==="spikes"&&!(Number.isFinite(h.damage)&&h.damage!>0&&Number.isFinite(h.period)&&h.period!>0&&Number.isFinite(h.activeFor)&&h.activeFor!>0&&h.activeFor!<=h.period!))
      issues.push(`Hazard ${h.id} invalid spike timing/damage`);
    if(h.type==="destructible_wall"&&!(Number.isFinite(h.hp)&&h.hp!>0))issues.push(`Hazard ${h.id} needs HP > 0`);
    if(h.type==="moving_platform"&&!(Number.isFinite(h.period)&&h.period!>0))issues.push(`Hazard ${h.id} needs period > 0`);
  }
  for(const [name,overrides] of [
    ["legacyCoverOverrides",b.legacyCoverOverrides],
    ["legacyEnvironmentOverrides",b.legacyEnvironmentOverrides],
  ] as const){
    for(const [index,v] of Object.entries(overrides??{})){
      if(!/^(0|[1-9][0-9]*)$/.test(index))
        issues.push(`${name}: invalid index ${index}`);
      if(!v || ![v.x,v.y,v.z,v.w,v.h,v.d].every(Number.isFinite) || v.w<=0||v.h<=0||v.d<=0)
        issues.push(`${name}[${index}]: expected positive full extents and finite coordinates`);
    }
  }
  for(const [field,disabled] of [
    ["legacyCoverDisabled",b.legacyCoverDisabled],
    ["legacyEnvironmentDisabled",b.legacyEnvironmentDisabled],
  ] as const){
    if(!Array.isArray(disabled)&&disabled!==undefined){issues.push(`${field}: expected an array`);continue;}
    const seenIndices=new Set<number>();
    for(const index of disabled??[]){
      if(!Number.isSafeInteger(index)||index<0||seenIndices.has(index))
        issues.push(`${field}: invalid or duplicate index ${index}`);
      seenIndices.add(index);
    }
  }
  const cityIds=new Set<string>();
  for(const id of b.cityBuildingDisabled??[]){
    if(typeof id!=="string"||!/^city:-?[0-9]+:-?[0-9]+$/.test(id)||cityIds.has(id))
      issues.push("cityBuildingDisabled: invalid or duplicate city lot "+id);
    cityIds.add(id);
  }
  for(const team of ["ffa","red","blue"] as const){
    if(!b.spawns?.[team]?.length)issues.push(`Missing ${team} spawns`);
    for(const p of b.spawns?.[team]??[])
      if(!p.every(Number.isFinite)||!insideRegions(p[0],p[2],b.regions??[],1.1))
        issues.push(`${team} spawn at ${p[0]},${p[2]} outside walkable space`);
  }
  issues.push(...validateObjectives(b,p=>insideRegions(p[0],p[2],b.regions??[])));
  return issues;
}

/** Coarse route via the first overlapping district in the shortest region chain.
 * The fine-grained A* motor still validates every step/obstacle on the way. */
export function nextRegionPortal(start:readonly number[],goal:readonly number[],
  regions:readonly MapRegion[],cover:readonly CoverBox[]=[]):Vec3|null{
  if(regions.length<2||Math.hypot(start[0]-goal[0],start[2]-goal[2])<65)return null;
  const starts=regions.flatMap((r,i)=>insideRegions(start[0],start[2],[r])?[i]:[]);
  const ends=new Set(regions.flatMap((r,i)=>insideRegions(goal[0],goal[2],[r])?[i]:[]));
  if(!starts.length||!ends.size||starts.some(i=>ends.has(i)))return null;
  const queue=[...starts],parent=new Map<number,number>(),visited=new Set(starts);
  let reached=-1;
  while(queue.length){
    const i=queue.shift()!;
    if(ends.has(i)){reached=i;break;}
    for(let k=0;k<regions.length;k++){
      if(visited.has(k))continue;
      const a=regions[i],b=regions[k];
      const width=Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2);
      const depth=Math.min(a.z+a.d/2,b.z+b.d/2)-Math.max(a.z-a.d/2,b.z-b.d/2);
      if(width<6||depth<6)continue;
      // Bounding boxes of a circle/triangle may overlap without the shapes
      // actually meeting. Require a genuinely shared walkable portal.
      const left=Math.max(a.x-a.w/2,b.x-b.w/2),right=Math.min(a.x+a.w/2,b.x+b.w/2);
      const top=Math.max(a.z-a.d/2,b.z-b.d/2),bottom=Math.min(a.z+a.d/2,b.z+b.d/2);
      let shared=false;
      for(let ix=1;ix<=3&&!shared;ix++)for(let iz=1;iz<=3;iz++){
        const px=left+(right-left)*ix/4,pz=top+(bottom-top)*iz/4;
        if(insideRegion(px,pz,a,1)&&insideRegion(px,pz,b,1))shared=true;
      }
      if(!shared)continue;
      visited.add(k);parent.set(k,i);queue.push(k);
    }
  }
  if(reached<0)return null;
  let next=reached;
  while(parent.has(next)&&!starts.includes(parent.get(next)!))next=parent.get(next)!;
  const from=parent.get(next);if(from===undefined)return null;
  const a=regions[from],b=regions[next];
  const x0=Math.max(a.x-a.w/2,b.x-b.w/2),x1=Math.min(a.x+a.w/2,b.x+b.w/2);
  const z0=Math.max(a.z-a.d/2,b.z-b.d/2),z1=Math.min(a.z+a.d/2,b.z+b.d/2);
  const x=(x0+x1)/2,z=(z0+z1)/2;
  for(const [dx,dz] of [[0,0],[-6,0],[6,0],[0,-6],[0,6],[-6,-6],[6,6]]){
    const nx=x+dx,nz=z+dz;
    if(nx<x0+2||nx>x1-2||nz<z0+2||nz>z1-2)continue;
    if(cover.some(c=>c.kind!=="accent"&&c.pos[1]-c.size[1]<1.8&&c.pos[1]+c.size[1]>0&&
      Math.abs(nx-c.pos[0])<c.size[0]+1&&Math.abs(nz-c.pos[2])<c.size[2]+1))continue;
    return [nx,0,nz];
  }
  return [x,0,z];
}
