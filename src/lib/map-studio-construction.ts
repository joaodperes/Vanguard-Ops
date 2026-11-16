/** Pure construction operations shared by the plan, inspector and 3D gizmos. */
import {featureFootprint,reconcileFeatureAttachments,type MapFeature} from "./map-blueprints";
import {normalizeTurns} from "./map-studio-transform";

export const CONSTRUCTION_UNIT=1;
export const WALL_THICKNESS=1;
export const DEFAULT_STOREY=5;
export function constructionDimension(value:number,grid:number){
  return grid>0?Math.max(CONSTRUCTION_UNIT,Math.round(value/CONSTRUCTION_UNIT)*CONSTRUCTION_UNIT):Math.max(.1,value);
}
export function wallBetween(a:{x:number;z:number},b:{x:number;z:number},id:string):MapFeature {
  const alongX=Math.abs(b.x-a.x)>=Math.abs(b.z-a.z);
  return {id,kind:"cover",label:"Wall",x:alongX?(a.x+b.x)/2:a.x,z:alongX?a.z:(a.z+b.z)/2,
    w:alongX?Math.max(CONSTRUCTION_UNIT,Math.abs(b.x-a.x)):WALL_THICKNESS,
    d:alongX?WALL_THICKNESS:Math.max(CONSTRUCTION_UNIT,Math.abs(b.z-a.z)),h:DEFAULT_STOREY,y:0};
}
export interface FeatureTransform {x:number;z:number;y:number;w:number;d:number;h:number;turns:number}
export function transformFeature(f:MapFeature,t:FeatureTransform):MapFeature {
  const delta=normalizeTurns(t.turns-(f.turns??0));
  if(f.kind!=="stairs")return {...f,...t,turns:normalizeTurns(t.turns)};
  let axis=f.axis??"z",sign=f.sign??1;
  for(let i=0;i<delta;i++){if(axis==="z"){axis="x";}else{axis="z";sign=sign===1?-1:1;}}
  const width=axis==="z"?t.w:t.d,run=axis==="z"?t.d:t.w;
  return {...f,x:t.x-(axis==="x"?sign*run/2:0),z:t.z-(axis==="z"?sign*run/2:0),
    w:width,d:run,h:t.h,y:t.y,axis,sign,turns:normalizeTurns(t.turns)};
}
/** Transform an assembly in one undo step, keeping all child offsets and joins. */
export function transformFeatureAssembly(features:readonly MapFeature[],id:string,t:FeatureTransform,whole=true):MapFeature[] {
  const selected=features.find(f=>f.id===id);if(!selected)return [...features];
  const pivot=featureFootprint(selected),delta=normalizeTurns(t.turns-(selected.turns??0));
  const odd=delta%2===1,sx=(odd?t.d:t.w)/pivot.w,sz=(odd?t.w:t.d)/pivot.d,sy=t.h/pivot.h;
  const members=features.filter(f=>f.id===id||(whole&&selected.assemblyId&&f.assemblyId===selected.assemblyId));
  const edited=new Set(members.map(f=>f.id));
  const next=features.map(f=>{
    if(!edited.has(f.id))return f;
    const fp=featureFootprint(f);let dx=(fp.x-pivot.x)*sx,dz=(fp.z-pivot.z)*sz;
    for(let i=0;i<delta;i++){const x=dx;dx=dz;dz=-x;}
    const w=fp.w*sx,d=fp.d*sz;
    const base=transformFeature(f,{x:t.x+dx,z:t.z+dz,y:t.y+((f.y??0)-pivot.y)*sy,
      w:odd?d:w,d:odd?w:d,h:f.h*sy,turns:normalizeTurns((f.turns??0)+delta)});
    if(base.attachment&&edited.has(base.attachment.platformId))base.attachment={...base.attachment,
      baseY:t.y+((base.attachment.baseY??f.y??0)-pivot.y)*sy,
      offset:(base.attachment.offset??0)*(["north","south"].includes(base.attachment.edge)?sx:sz)};
    // A connected stair remains parametric when editing an entire assembly.
    if(!whole&&f.kind==="stairs")delete base.attachment;
    return base;
  });
  return reconcileFeatureAttachments(next,features);
}
export function copyFeatureAssembly(features:readonly MapFeature[],id:string,makeId:()=>string,whole=true):MapFeature[] {
  const selected=features.find(f=>f.id===id);if(!selected)return [];
  const members=features.filter(f=>f.id===id||(whole&&selected.assemblyId&&f.assemblyId===selected.assemblyId));
  const ids=new Map(members.map(f=>[f.id,makeId()])),assembly=members.length>1?makeId():undefined;
  return reconcileFeatureAttachments(members.map(f=>({...f,id:ids.get(f.id)!,x:f.x+10,assemblyId:assembly,
    attachment:f.attachment&&ids.has(f.attachment.platformId)?{...f.attachment,platformId:ids.get(f.attachment.platformId)!}:undefined})));
}
/** Close a measured gap by extending one face; the opposite end stays fixed. */
export function joinFeatureFaces(a:MapFeature,b:MapFeature):MapFeature|null {
  if(a.kind==="stairs"||b.kind==="stairs")return null;
  const candidates:({axis:"x"|"z";gap:number;sign:number})[]=[];
  for(const axis of ["x","z"] as const){
    const cross=axis==="x"?"z":"x",size=axis==="x"?"w":"d",other=axis==="x"?"d":"w";
    if(Math.abs(a[cross]-b[cross])>=(a[other]+b[other])/2-.01)continue;
    const sign=b[axis]>=a[axis]?1:-1,gap=Math.abs(a[axis]-b[axis])-(a[size]+b[size])/2;
    if(gap>1e-5&&gap<=3.25)candidates.push({axis,gap,sign});
  }
  candidates.sort((x,y)=>x.gap-y.gap);const c=candidates[0];if(!c)return null;
  return {...a,[c.axis]:a[c.axis]+c.sign*c.gap/2,[c.axis==="x"?"w":"d"]:a[c.axis==="x"?"w":"d"]+c.gap};
}
