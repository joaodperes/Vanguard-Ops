/** Small, reusable, gameplay-ready pieces for Map Studio Quick Build.
 * Store them as normal MapProp values: a saved prefab has the same appearance
 * and collision in the editor, client and authoritative game simulation. */
import type { MapProp } from "./map-visuals";

export const STUDIO_BUILDING_PRESETS = [
  {id:"house", label:"Townhouse",use:"house",shape:"narrow",w:14,d:19,h:5.2,facade:"brick",roofAccess:true},
  {id:"cafe", label:"Corner café",use:"cafe",shape:"rect",w:20,d:18,h:5.5,facade:"stucco",roofAccess:false},
  {id:"market", label:"Supermarket",use:"supermarket",shape:"rect",w:26,d:25,h:6.1,facade:"industrial",roofAccess:false},
  {id:"apartments", label:"Apartment block",use:"apartments",shape:"rect",w:22,d:23,h:9.1,facade:"concrete",roofAccess:true},
  {id:"office", label:"Office building",use:"office",shape:"rect",w:24,d:22,h:8.2,facade:"glass",roofAccess:true},
  {id:"round", label:"Round gallery",use:"gallery",shape:"round",w:20,d:20,h:6.2,facade:"stucco",roofAccess:false},
  {id:"bakery", label:"Neighbourhood bakery",use:"bakery",shape:"narrow",w:14,d:20,h:5.3,facade:"timber",roofAccess:false},
  {id:"hotel", label:"Hotel",use:"hotel",shape:"rect",w:23,d:24,h:10.4,facade:"brick",roofAccess:true},
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
