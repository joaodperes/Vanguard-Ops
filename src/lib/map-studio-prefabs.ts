/** Small, reusable, gameplay-ready pieces for Map Studio Quick Build.
 * Store them as normal MapProp values: a saved prefab has the same appearance
 * and collision in the editor, client and authoritative game simulation. */
import type { MapProp } from "./map-visuals";
import type { MapFeature } from "./map-blueprints";

import {STUDIO_STOREY_HEIGHT} from "./map-studio-snapping";

export const STUDIO_BUILDING_PRESETS = [
  {id:"house", label:"Townhouse",use:"house",shape:"narrow",w:14,d:19,h:STUDIO_STOREY_HEIGHT,facade:"brick",roofAccess:true},
  {id:"cafe", label:"Corner café",use:"cafe",shape:"rect",w:20,d:18,h:STUDIO_STOREY_HEIGHT,facade:"stucco",roofAccess:false},
  {id:"market", label:"Supermarket",use:"supermarket",shape:"rect",w:26,d:25,h:STUDIO_STOREY_HEIGHT,facade:"industrial",roofAccess:false},
  {id:"apartments", label:"Apartment block",use:"apartments",shape:"rect",w:22,d:23,h:STUDIO_STOREY_HEIGHT*2,facade:"concrete",roofAccess:true},
  {id:"office", label:"Office building",use:"office",shape:"rect",w:24,d:22,h:STUDIO_STOREY_HEIGHT*2,facade:"glass",roofAccess:true},
  {id:"round", label:"Round gallery",use:"gallery",shape:"round",w:20,d:20,h:STUDIO_STOREY_HEIGHT,facade:"stucco",roofAccess:false},
  {id:"bakery", label:"Neighbourhood bakery",use:"bakery",shape:"narrow",w:14,d:20,h:STUDIO_STOREY_HEIGHT,facade:"timber",roofAccess:false},
  {id:"hotel", label:"Hotel",use:"hotel",shape:"rect",w:23,d:24,h:STUDIO_STOREY_HEIGHT*2,facade:"brick",roofAccess:true},
] as const satisfies readonly (Readonly<Pick<MapProp,"use"|"shape"|"w"|"d"|"h"|"facade"|"roofAccess">> & {id:string;label:string})[];

export type StudioBuildingPresetId = typeof STUDIO_BUILDING_PRESETS[number]["id"];

export function studioBuildingPrefab(id:StudioBuildingPresetId,x:number,z:number):MapProp {
  const preset=STUDIO_BUILDING_PRESETS.find(p=>p.id===id);
  if(!preset)throw new Error("Unknown building preset: "+id);
  return {
    kind:"building",x,z,use:preset.use,shape:preset.shape,w:preset.w,d:preset.d,h:preset.h,
    facade:preset.facade,roofAccess:preset.roofAccess,stairSide:"east",
    text:preset.label.toUpperCase(),
  };
}

/** Reusable combat-space kits, assembled from ordinary blueprint features.
 * Child pieces remain independently editable once stamped. */
export const STUDIO_STRUCTURE_PRESETS=[
  {id:"alley",label:"Narrow alley",width:20,depth:32},
  {id:"room",label:"Room with entrance",width:24,depth:22},
  {id:"rooftop",label:"Accessible rooftop",width:22,depth:24},
  {id:"market",label:"Market stalls",width:26,depth:24},
  {id:"checkpoint",label:"Checkpoint cover",width:24,depth:14},
  {id:"stairs",label:"Independent stairwell",width:10,depth:14},
  {id:"courtyard",label:"Courtyard cover",width:26,depth:26},
] as const;
export type StudioStructurePresetId=typeof STUDIO_STRUCTURE_PRESETS[number]["id"];

/** The kit returns a multi-object geometry composition in one logical step.
 * IDs are allocated by the editor, not the prefab library. */
export function studioStructurePrefab(id:StudioStructurePresetId,x:number,z:number):MapFeature[]{
  const out:MapFeature[]=[];
  const add=(kind:MapFeature["kind"],dx:number,dz:number,w:number,d:number,h:number,
    label:string,autoStairs?:boolean)=>{
    out.push({id:id+"_"+out.length,kind,x:x+dx,z:z+dz,w,d,h,label,
      ...(kind==="platform"?{autoStairs:autoStairs??false}:{})});
  };
  switch(id){
    case "alley":
      add("cover",-9,0,1.4,32,5,"West alley wall");
      add("cover",9,0,1.4,32,5,"East alley wall");break;
    case "room":
      add("cover",0,-11,24,1,5,"Rear wall");
      add("cover",-12,0,1,22,5,"Left wall");
      add("cover",12,0,1,22,5,"Right wall");
      add("cover",-8,11,8,1,5,"Entry west");
      add("cover",8,11,8,1,5,"Entry east");break;
    case "rooftop":
      add("platform",0,0,22,24,5,"Roof deck",false);
      out.push({id:"roof_stairs",kind:"stairs",x:x+15,z:z-10,w:4,d:14,h:5,label:"Roof access",axis:"z",sign:1});break;
    case "market":
      for(const [dx,dz] of [[-8,-7],[8,-7],[-8,7],[8,7]])add("cover",dx,dz,6,5,2.5,"Market stall");
      break;
    case "checkpoint":
      add("cover",-7,0,7,2,2.3,"Left barricade");
      add("cover",7,0,7,2,2.3,"Right barricade");
      add("cover",0,-6,13,2,1.2,"Rear checkpoint cover");break;
    case "stairs":
      out.push({id:"stairwell",kind:"stairs",x,z,w:5,d:14,h:5,label:"Stairwell",axis:"z",sign:1});break;
    case "courtyard":
      for(const [dx,dz] of [[-9,-9],[9,-9],[-9,9],[9,9]])add("cover",dx,dz,4,4,1.5,"Courtyard planter");
      break;
    default:throw Error("Unknown structure preset: "+id);
  }
  return out;
}
