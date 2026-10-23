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
import { insideRegions, featureBoxes } from "./map-blueprints";

export type PropKind = "tree" | "bush" | "rock" | "ruin" | "temple" | "shop" | "lamp" |
  "container" | "crane" | "terminal" | "sign" | "antenna" |
  "building" | "boat" | "dock" | "garden" | "bench" | "bandstand";
export interface MapProp {
  kind: PropKind; x: number; z: number; y?: number;
  w?: number; d?: number; h?: number; text?: string;
}
export interface MapVisualTheme {
  biome: string; label: string; inheritPropsFrom?: string;
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
  const own=MAP_VISUAL_THEMES[id] ?? MAP_VISUAL_THEMES[templateMapId ?? ""] ?? MAP_VISUAL_THEMES.compound;
  const parent=own.inheritPropsFrom ? MAP_VISUAL_THEMES[own.inheritPropsFrom] : undefined;
  return parent ? {...own, props:[...parent.props,...own.props]} : own;
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
export function mapProps(id:string,plan:MapBlueprint,theme:MapVisualTheme,extraSpawns:Vec3[]=[]):MapProp[] {
  const spawns=[...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...extraSpawns];
  const result=[...theme.props].filter(p=>insideRegions(p.x,p.z,plan.regions,2));
  // Shared city layout generator for both daytime and nighttime Afterlight:
  // wide streets, building blocks, real enterable facades and open central park.
  // No procedural random wall/corridor pieces.
  if(theme.biome==="city"||theme.biome==="city_day"){
    result.push({kind:"garden",x:0,z:0,w:80,d:80});
    result.push({kind:"bandstand",x:0,z:0,w:16,d:16,h:5});
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){
      if(i===0&&j===0)continue;
      const x=i*14,z=j*14;
      if(Math.hypot(x,z)>32)continue;
      result.push({kind:(i+j)%4===0?"bench":(i+j)%3===0?"bush":"tree",x,z,h:5.5});
    }
    const labels=["CAFÉ","BAKERY","ARCADE","METRO","HOTEL","MARKET","DINER","LIBRARY"];
    for(let x=-174;x<=174;x+=58)for(let z=-174;z<=174;z+=58){
      if(Math.hypot(x,z)<62)continue;
      if(!insideRegions(x,z,plan.regions,24))continue;
      const kind:PropKind=(Math.abs(x+z)%3===0)?"building":"shop";
      const h=kind==="building"?8.6+Math.round(hashed(x+":"+z)*4):8+Math.round(hashed(z+":"+x)*6);
      result.push({kind,x,z,w:35,d:35,h,text:labels[Math.floor(hashed(x+":"+z)*labels.length)]});
      if(hashed("light"+x+":"+z)>.69)result.push({kind:"lamp",x:x+23,z:z+23});
    }
  } else {
    const frequency=Math.ceil(theme.vegetation*(theme.biome==="highlands"?24:18));
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
  }
  // An authored façade must never render at a spawn while its collider is
  // silently suppressed: both visual and physics representations must agree.
  const solidKinds=new Set<PropKind>(["tree","rock","ruin","temple","shop","building","container","boat","dock"]);
  return result.filter(p=>{
    if(!solidKinds.has(p.kind))return true;
    const h=p.h??(p.kind==="shop"||p.kind==="building"?7:3);
    const radiusX=p.kind==="tree" ? 0.5 :(p.w??(p.kind==="rock"?4:8))/2;
    const radiusZ=p.kind==="tree" ? 0.5 :(p.d??(p.kind==="rock"?3:7))/2 + (p.kind==="building" ? 17 : 0);
    return !spawns.some(s=>Math.abs(s[0]-p.x)<radiusX+3&&Math.abs(s[2]-p.z)<radiusZ+3);
  });
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
    if(p.kind==="shop"||p.kind==="ruin"||p.kind==="temple"||p.kind==="container"||p.kind==="boat"||p.kind==="dock")
      size=[(p.w??8)/2,h/2,(p.d??7)/2];
    if(p.kind==="building"){
      // Four accessible walls; the south façade has a six-meter doorway.
      // Rooftop is a thin physical platform, NOT a solid filled box.
      const w=p.w??35,d=p.d??35, wall=.45,door=6;
      const front=(w-door)/2;
      const wallBoxes:CoverBox[]=[
        {kind:"cover",pos:[p.x,h/2,p.z-d/2],size:[w/2,h/2,wall]},
        {kind:"cover",pos:[p.x-w/2,h/2,p.z],size:[wall,h/2,d/2]},
        {kind:"cover",pos:[p.x+w/2,h/2,p.z],size:[wall,h/2,d/2]},
        {kind:"cover",pos:[p.x-(w+door)/4,h/2,p.z+d/2],size:[front/2,h/2,wall]},
        {kind:"cover",pos:[p.x+(w+door)/4,h/2,p.z+d/2],size:[front/2,h/2,wall]},
        {kind:"cover",pos:[p.x,h-1.2,p.z+d/2],size:[door/2,Math.max(.4,(h-2.4)/2),wall]},
        {kind:"platform",pos:[p.x,h+.22,p.z],size:[w/2,.22,d/2]},
      ];
      // External stairs along two sides, leave the south doorway free.
      wallBoxes.push(...featureBoxes({id:"roof",kind:"platform",x:p.x,z:p.z,w,d,h}).slice(1));
      if(!wallBoxes.some(c=>spawns.some(s=>Math.abs(s[0]-c.pos[0])<c.size[0]+1.5&&Math.abs(s[2]-c.pos[2])<c.size[2]+1.5)))
        result.push(...wallBoxes);
      continue;
    }
    if(p.kind==="bench"){
      result.push({kind:"cover",pos:[p.x,.56,p.z],size:[1.3,.56,.53]});
      continue;
    }
    if(p.kind==="bandstand"){
      const w=p.w??16,d=p.d??16;
      const roof:CoverBox={kind:"platform",pos:[p.x,h+.22,p.z],size:[w/2,.22,d/2]};
      const steps=featureBoxes({id:"bandstand",kind:"platform",x:p.x,z:p.z,w,d,h}).slice(1);
      result.push(roof,...steps);
      continue;
    }
    if(!size)continue;
    if(spawns.some(s=>Math.abs(s[0]-p.x)<size[0]+3&&Math.abs(s[2]-p.z)<size[2]+3))continue;
    result.push({kind:"cover",pos:[p.x,p.y??(size[1]),p.z],size});
  }
  return result;
}
