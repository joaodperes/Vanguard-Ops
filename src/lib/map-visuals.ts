/**
 * Visual vocabulary for each map. Colors, biome and authored landmarks live in
 * one JSON file per map; the 3D builder only knows reusable prop primitives.
 * Never use Math.random here: browser and server share collision silhouettes.
 */
import bunker from "../data/map-themes/bunker.json";
import shipyard from "../data/map-themes/shipyard.json";
import compound from "../data/map-themes/compound.json";
import terminal from "../data/map-themes/terminal.json";
import skybridge from "../data/map-themes/skybridge.json";
import arenaNeon from "../data/map-themes/arena_neon.json";
import type { CoverBox, MapTheme, Vec3 } from "./game-protocol";
import type { MapBlueprint } from "./map-blueprints";
import { insideRegions } from "./map-blueprints";

export type PropKind = "tree" | "bush" | "rock" | "ruin" | "temple" | "shop" | "lamp" |
  "container" | "crane" | "terminal" | "sign" | "antenna";
export interface MapProp {
  kind: PropKind; x: number; z: number; y?: number;
  w?: number; d?: number; h?: number; text?: string;
}
export interface MapVisualTheme {
  biome: string; label: string;
  palette: {
    floor:string; wall:string; cover:string; accent:string;
    platform:string; stair:string; sky:string; fog:string; grid:string;
  };
  ambient:number;
  vegetation:number;
  props:MapProp[];
}
export const MAP_VISUAL_THEMES: Record<string,MapVisualTheme> = {
  bunker:bunker as MapVisualTheme,shipyard:shipyard as MapVisualTheme,
  compound:compound as MapVisualTheme,terminal:terminal as MapVisualTheme,
  skybridge:skybridge as MapVisualTheme,arena_neon:arenaNeon as MapVisualTheme,
};

export function visualThemeForMap(id:string,templateMapId?:string):MapVisualTheme {
  return MAP_VISUAL_THEMES[id] ?? MAP_VISUAL_THEMES[templateMapId ?? ""] ?? MAP_VISUAL_THEMES.compound;
}
const numberColor=(s:string)=>Number.parseInt(s.slice(1),16);
export function paletteToGameTheme(spec:MapVisualTheme,base:MapTheme):MapTheme {
  const p=spec.palette;
  return {
    ...base, floor:numberColor(p.floor),floorPattern:numberColor(p.grid),
    wall:numberColor(p.wall),cover:numberColor(p.cover),coverAccent:numberColor(p.accent),
    platform:numberColor(p.platform),stair:numberColor(p.stair),sky:p.sky,fog:p.fog,
    gridColor:numberColor(p.grid),ambient:spec.ambient,
  };
}

function hashed(seed:string):number {
  let h=2166136261;
  for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619);
  return (h>>>0)/4294967296;
}
/**
 * Add atmospheric foliage along the outer edges and within courtyards.
 * Keep generated trees away from spawns and built geometry. The centre
 * stays open for actual gunfights and the foliage never forms a wall.
 */
export function mapProps(id:string,plan:MapBlueprint,theme:MapVisualTheme):MapProp[] {
  const result=[...theme.props];
  if(theme.vegetation<=0)return result;
  const spawns=[...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue];
  const frequency=Math.ceil(theme.vegetation*9);
  for(let r=0;r<plan.regions.length;r++){
    const region=plan.regions[r];
    for(let n=0;n<frequency;n++){
      const x=region.x+(hashed(id+":x:"+r+":"+n)-.5)*region.w*.82;
      const z=region.z+(hashed(id+":z:"+r+":"+n)-.5)*region.d*.82;
      if(!insideRegions(x,z,plan.regions,5))continue;
      if(spawns.some(p=>Math.hypot(p[0]-x,p[2]-z)<9))continue;
      if(plan.features.some(f=>Math.abs(f.x-x)<f.w/2+5&&Math.abs(f.z-z)<f.d/2+5))continue;
      // Avoid clutter over the inherited centre, which already contains cover.
      if(r===0&&Math.abs(x)<36&&Math.abs(z)<36)continue;
      const kind:PropKind=theme.biome==="jungle"?(n%4===0?"bush":"tree"):
        theme.biome==="highlands"?(n%2===0?"rock":"tree"):"bush";
      result.push({kind,x:Math.round(x),z:Math.round(z),h:kind==="tree"?9+hashed(id+":h:"+n+r)*5:kind==="rock"?2.5:1.6,
        w:kind==="rock"?4:undefined,d:kind==="rock"?3:undefined});
    }
  }
  return result;
}
/** Collision parity: solid props participate in server/bot/player hit tests.
 * Low foliage is atmospheric; trees have slender trunks only, not an invisible
 * solid canopy. Shop fronts/ruins are solid exteriors, not fictitious entrances.
 */
export function propColliders(props:readonly MapProp[],spawns:readonly Vec3[]):CoverBox[] {
  const result:CoverBox[]=[];
  for(const p of props){
    const h=p.h??(p.kind==="shop"?7:3);
    let size:Vec3|null=null;
    if(p.kind==="tree")size=[0.45,Math.min(3,h)/2,0.45];
    if(p.kind==="rock")size=[(p.w??4)/2,h*.38,(p.d??3)/2];
    if(p.kind==="shop"||p.kind==="ruin"||p.kind==="temple"||p.kind==="container")
      size=[(p.w??8)/2,h/2,(p.d??7)/2];
    if(!size)continue;
    if(spawns.some(s=>Math.abs(s[0]-p.x)<size[0]+3&&Math.abs(s[2]-p.z)<size[2]+3))continue;
    result.push({kind:"cover",pos:[p.x,p.y??(size[1]),p.z],size});
  }
  return result;
}
