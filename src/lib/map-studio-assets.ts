/** Editable recipes. Variants change defaults; placed instances are independent copies. */
import {STUDIO_BUILDING_PRESETS,STUDIO_STRUCTURE_PRESETS,studioBuildingPrefab,studioStructurePrefab} from "./map-studio-prefabs";
import {featureFootprint,reconcileFeatureAttachments,type MapFeature} from "./map-blueprints";
import type {MapProp} from "./map-visuals";

export interface StudioAsset {
  id:string;name:string;category:"Construction"|"Buildings"|"Props"|"My assets";
  features:MapFeature[];props:MapProp[];description?:string;
}
export const STUDIO_ASSETS:StudioAsset[]=[
  ...[4,8,16].map(length=>({id:"wall_"+length,name:length+"u wall",category:"Construction" as const,
    features:[{id:"wall",kind:"cover" as const,x:0,z:0,w:length,d:1,h:5,y:0,label:"Wall"}],props:[]})),
  ...STUDIO_STRUCTURE_PRESETS.map(p=>({id:"structure_"+p.id,name:p.label,category:"Construction" as const,features:studioStructurePrefab(p.id,0,0),props:[]})),
  ...([
    {id:"thin_wood_panel",name:"Thin wood screen",material:"thin_wood",w:6,d:.65,h:2.35},
    {id:"sheet_metal_panel",name:"Sheet metal screen",material:"sheet_metal",w:6,d:.45,h:2.35},
    {id:"glass_panel",name:"Glass partition",material:"glass",w:6,d:.38,h:3.1},
    {id:"light_cover",name:"Light barricade",material:"light_cover",w:6,d:1.1,h:1.6},
  ] as const).map(p=>({id:p.id,name:p.name,category:"Construction" as const,
    description:"Penetrable when a weapon has enough cover-penetration energy; front-facing shots lose damage.",
    features:[{id:"panel",kind:"cover" as const,x:0,z:0,w:p.w,d:p.d,h:p.h,y:0,label:p.name,material:p.material}],props:[]})),
  ...STUDIO_BUILDING_PRESETS.map(p=>({id:"building_"+p.id,name:p.label,category:"Buildings" as const,features:[],props:[studioBuildingPrefab(p.id,0,0)]})),
  ...[{id:"container",name:"Container",color:"#8c9aa8"},{id:"container_red",name:"Red container",color:"#a8483c"},
    {id:"container_blue",name:"Blue container",color:"#396b9b"}].map(p=>({id:p.id,name:p.name,category:"Props" as const,
      description:"Editable container: change color, dimensions and orientation after placement.",features:[],
      props:[{kind:"container" as const,x:0,z:0,y:0,w:12,d:5,h:5,color:p.color}]})),
];
export function assetBounds(asset:StudioAsset){
  const pieces=[...asset.features.map(featureFootprint),...asset.props.map(p=>({x:p.x,z:p.z,w:p.w??5,d:p.d??5,y:p.y??0,h:p.h??5}))];
  const minX=Math.min(...pieces.map(p=>p.x-p.w/2)),maxX=Math.max(...pieces.map(p=>p.x+p.w/2));
  const minZ=Math.min(...pieces.map(p=>p.z-p.d/2)),maxZ=Math.max(...pieces.map(p=>p.z+p.d/2));
  return {x:(minX+maxX)/2,z:(minZ+maxZ)/2,w:maxX-minX,d:maxZ-minZ};
}
export function instantiateStudioAsset(asset:StudioAsset,x:number,z:number,makeId:()=>string,y=0){
  const ids=new Map(asset.features.map(f=>[f.id,makeId()]));
  const assemblyId=asset.features.length>1?makeId():undefined;
  return {features:reconcileFeatureAttachments(asset.features.map(f=>({...structuredClone(f),id:ids.get(f.id)!,
      assemblyId,x:f.x+x,z:f.z+z,y:(f.y??0)+y,
      attachment:f.attachment&&ids.has(f.attachment.platformId)?{...f.attachment,platformId:ids.get(f.attachment.platformId)!,baseY:(f.attachment.baseY??0)+y}:undefined}))),
    props:asset.props.map(p=>({...structuredClone(p),lotId:undefined,x:p.x+x,z:p.z+z,y:(p.y??0)+y}))};
}
export function saveStudioAsset(name:string,features:readonly MapFeature[],props:readonly MapProp[],id:string):StudioAsset {
  const reference=features[0]?featureFootprint(features[0]):props[0];
  if(!reference)throw Error("Select an object or assembly first");
  const x=reference.x,z=reference.z,y=reference.y??0;
  const ids=new Set(features.map(f=>f.id));
  return {id,name:name.trim().slice(0,80)||"Custom asset",category:"My assets",
    features:features.map(f=>({...structuredClone(f),assemblyId:undefined,x:f.x-x,z:f.z-z,y:(f.y??0)-y,
      attachment:f.attachment&&ids.has(f.attachment.platformId)?{...f.attachment,baseY:(f.attachment.baseY??0)-y}:undefined})),
    props:props.map(p=>({...structuredClone(p),lotId:undefined,x:p.x-x,z:p.z-z,y:(p.y??0)-y}))};
}
/** Portable recipe import, never an executable model/script or arbitrary URL loader. */
export function importStudioAssets(input:unknown):StudioAsset[]{
  const doc=input as {version?:number;assets?:StudioAsset[]};
  if(doc?.version!==1||!Array.isArray(doc.assets)||doc.assets.length>200)throw Error("Expected a v1 asset library (up to 200 recipes)");
  const seen=new Set<string>();
  const kinds=new Set(["tree","bush","rock","ruin","temple","shop","lamp","container","crane","terminal","sign","antenna","building","boat","dock","garden","bench","bandstand","furnace","conveyor","hydraulic_press","generator","storage_rack","vent_stack","industrial_pipe","steel_coil","cargo_pallet"]);
  for(const a of doc.assets){
    if(!a||typeof a.id!=="string"||!/^[a-z][a-z0-9_-]{0,100}$/.test(a.id)||seen.has(a.id)||typeof a.name!=="string"||!a.name.trim()||a.name.length>80||
      !Array.isArray(a.features)||!Array.isArray(a.props)||a.features.length+a.props.length<1||a.features.length+a.props.length>100)throw Error("Invalid asset recipe");
    seen.add(a.id);const ids=new Set(a.features.map(f=>f.id));
    if(ids.size!==a.features.length)throw Error("Duplicate feature ID in "+a.name);
    for(const p of [...a.features,...a.props]){
      if(![p.x,p.z,p.y??0,p.w??5,p.d??5,p.h??5].every(Number.isFinite)||(p.w??5)<=0||(p.d??5)<=0||(p.h??5)<=0||
        [p.w??5,p.d??5,p.h??5,Math.abs(p.x),Math.abs(p.z),Math.abs(p.y??0)].some(n=>n>2000))throw Error("Invalid dimensions in "+a.name);
    }
    for(const f of a.features){
      if(!["cover","platform","stairs","accent"].includes(f.kind)||typeof f.id!=="string")throw Error("Unsupported feature in "+a.name);
      if(f.axis!==undefined&&!['x','z'].includes(f.axis)||f.sign!==undefined&&f.sign!==1&&f.sign!==-1)throw Error("Invalid stair direction");
      if(f.attachment&&(!ids.has(f.attachment.platformId)||!["north","south","east","west"].includes(f.attachment.edge)))throw Error("Broken asset connection");
    }
    for(const p of a.props)if(!kinds.has(p.kind)||(p.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(p.color)))throw Error("Unsupported prop or color");
  }
  return structuredClone(doc.assets).map(a=>({...a,category:"My assets"}));
}
