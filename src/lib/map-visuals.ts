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
export const SURFACE_PATTERNS = ["concrete","metal","grate","planks","rust","moss","brick","stone","pavers","snow","asphalt","grass"] as const;
export type SurfacePattern = typeof SURFACE_PATTERNS[number];
export type SurfaceSlot = "floor" | "wall" | "cover" | "stair" | "platform";
/** Physical texture scale is in WORLD units, not arbitrary geometry UV units. */
export interface SurfaceRecipe { pattern: SurfacePattern; tileSize: number; roughness: number }
export type MapSurfaceRecipes = Record<SurfaceSlot, SurfaceRecipe>;
export interface MapVisualTheme {
  biome: string; label: string; inheritPropsFrom?: string;
  surfaces?: MapSurfaceRecipes;
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
    // Garden foliage stays off both stair approaches of the pavilion.
    for(let x=-30;x<=30;x+=12)for(let z=-30;z<=30;z+=12){
      if(Math.hypot(x,z)<14||Math.abs(x)<5&&Math.abs(z)<26)continue;
      result.push({kind:(x+z)%24===0?"bench":"tree",x,z,h:6.8});
    }
    const labels=["CAFÉ","BAKERY","ARCADE","METRO","HOTEL","MARKET","DINER","LIBRARY"];
    // 40m blocks with 14m streets: substantially denser than old 58m
    // spacing. Both map editions use identical coordinate seeds and bounds.
    for(let x=-180;x<=180;x+=40)for(let z=-180;z<=180;z+=40){
      if(Math.hypot(x,z)<62)continue;
      if(!insideRegions(x,z,plan.regions,17))continue;
      const kind:PropKind=(Math.abs(x+z)%5===0)?"building":"shop";
      const h=kind==="building"?6.4:7.8;
      const prop:MapProp={kind,x,z,w:26,d:26,h,text:labels[Math.floor(hashed(x+":"+z)*labels.length)]};
      if(kind==="building"){
        const boxes=cityBuildingBoxes(prop);
        if(boxes.some(b=>spawns.some(s=>Math.abs(s[0]-b.pos[0])<b.size[0]+2&&
          Math.abs(s[2]-b.pos[2])<b.size[2]+2)))continue;
      }
      result.push(prop);
      // Street lamps set OUTSIDE the structure, not above the stair entrance.
      if(hashed("light"+x+":"+z)>.35)result.push({kind:"lamp",x:x+17,z:z+17});
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
  // Deterministic visual/physics parity: do not render an actor-blocking
  // structure whose generated hitboxes would be missing or intersect a spawn.
  const solidKinds=new Set<PropKind>(["tree","rock","ruin","temple","shop","building","container","boat","dock"]);
  const stairways=result.filter(p=>p.kind==="building"||p.kind==="bandstand")
    .flatMap(p=>(p.kind==="building"?cityBuildingBoxes(p):cityBandstandBoxes(p)).filter(c=>c.kind==="stair"));
  return result.filter(p=>{
    if(p.kind==="tree"||p.kind==="bush"||p.kind==="bench"){
      if(stairways.some(c=>Math.abs(c.pos[0]-p.x)<c.size[0]+3&&
        Math.abs(c.pos[2]-p.z)<c.size[2]+3))return false;
    }
    if(!solidKinds.has(p.kind))return true;
    if(p.kind==="building")
      return !cityBuildingBoxes(p).some(c=>spawns.some(s=>
        Math.abs(s[0]-c.pos[0])<c.size[0]+2&&Math.abs(s[2]-c.pos[2])<c.size[2]+2));
    const radiusX=p.kind==="tree"?0.5:(p.w??(p.kind==="rock"?4:8))/2;
    const radiusZ=p.kind==="tree"?0.5:(p.d??(p.kind==="rock"?3:7))/2;
    return !spawns.some(s=>Math.abs(s[0]-p.x)<radiusX+3&&Math.abs(s[2]-p.z)<radiusZ+3);
  });
}
/** Collision parity: solid props participate in server/bot/player hit tests.
 * Low foliage is atmospheric; trees have slender trunks only, not an invisible
 * solid canopy. Shop fronts/ruins are solid exteriors, not fictitious entrances.
 */

/**
 * Identical physics and art plan for every enterable city block.
 * Outer stairs are mounted against the west flank; interior stairs rise from
 * the south doorway to an actual aperture in the upper floor.
 * Never silently drop collision while still displaying a building.
 */
export function cityBuildingBoxes(p:MapProp):CoverBox[]{
  const w=p.w??26,d=p.d??26,h=p.h??6.4;
  const wall=.45,door=6,front=(w-door)/2;
  const a:CoverBox[]=[
    {kind:"cover",pos:[p.x,h/2,p.z-d/2],size:[w/2,h/2,wall]},
    {kind:"cover",pos:[p.x-w/2,h/2,p.z],size:[wall,h/2,d/2]},
    {kind:"cover",pos:[p.x+w/2,h/2,p.z],size:[wall,h/2,d/2]},
    {kind:"cover",pos:[p.x-(w+door)/4,h/2,p.z+d/2],size:[front/2,h/2,wall]},
    {kind:"cover",pos:[p.x+(w+door)/4,h/2,p.z+d/2],size:[front/2,h/2,wall]},
    {kind:"cover",pos:[p.x,h-1.2,p.z+d/2],size:[door/2,Math.max(.4,(h-2.4)/2),wall]},
  ];
  const addRoof=(x:number,z:number,width:number,depth:number)=>{
    if(width>.2&&depth>.2)a.push({kind:"platform",pos:[p.x+x,h+.16,p.z+z],size:[width/2,.16,depth/2]});
  };
  // The roof hatch (about 4.4 × 6) sits over the crest of the inside stair.
  const hatchX=w/2-4,hatchZ=-2,hatchW=4.4,hatchD=6;
  const left=-w/2,right=w/2,bottom=-d/2,top=d/2;
  const ax=hatchX-hatchW/2,bx=hatchX+hatchW/2;
  const az=hatchZ-hatchD/2,bz=hatchZ+hatchD/2;
  addRoof((left+ax)/2,0,ax-left,d);
  addRoof((bx+right)/2,0,right-bx,d);
  addRoof((ax+bx)/2,(bottom+az)/2,bx-ax,az-bottom);
  addRoof((ax+bx)/2,(bz+top)/2,bx-ax,top-bz);

  const count=Math.ceil(h/.4),step=h/count,tread=.78;
  // Interior flight: start by the doorway on the east, climb northwards.
  const insideX=p.x+hatchX;
  const endZ=p.z+hatchZ;
  for(let i=0;i<count;i++){
    const height=(i+1)*step;
    const z=endZ+(count-i-.5)*tread;
    a.push({kind:"stair",pos:[insideX,height/2,z],size:[1.45,height/2+.001,tread/2+.015]});
  }
  // Hatch landing joins the interior staircase to the surrounding roof deck.
  a.push({kind:"platform",pos:[p.x+ax+1.3,h+.16,p.z+hatchZ],
    size:[1.3,.16,1.55]});
  // Small west roof landing connects the concealed outside stair to the roof
  // without forcing the player to walk through the building's wall.
  a.push({kind:"platform",pos:[p.x-w/2-1.35,h+.16,p.z-1.4],
    size:[2.05,.16,1.75]});
  // Concealed exterior staircase alongside the west wall, ascending towards
  // the northern half of the facade, not directly in front of the doorway.
  const outsideX=p.x-w/2-2.2;
  const exitZ=p.z-1.4;
  for(let i=0;i<count;i++){
    const height=(i+1)*step,z=exitZ+(count-i-.5)*tread;
    a.push({kind:"stair",pos:[outsideX,height/2,z],size:[1.5,height/2+.001,tread/2+.015]});
  }
  return a;
}
export function cityBandstandBoxes(p:MapProp):CoverBox[]{
  const w=p.w??16,d=p.d??16,h=p.h??5;
  const roof:CoverBox={kind:"platform",pos:[p.x,h+.22,p.z],size:[w/2,.22,d/2]};
  const steps=featureBoxes({id:"bandstand",kind:"platform",x:p.x,z:p.z,w,d,h}).slice(1);
  const pillars:CoverBox[]=[];
  for(const x of [-w*.42,w*.42])for(const z of [-d*.42,d*.42])
    pillars.push({kind:"cover",pos:[p.x+x,(h+5.2)/2,p.z+z],size:[.36,(h+5.2)/2,.36]});
  return [roof,...steps,...pillars];
}

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
      result.push(...cityBuildingBoxes(p));
      continue;
    }
    if(p.kind==="bench"){
      result.push({kind:"cover",pos:[p.x,.56,p.z],size:[1.3,.56,.53]});
      continue;
    }
    if(p.kind==="bandstand"){
      result.push(...cityBandstandBoxes(p));
      continue;
    }
    if(!size)continue;
    if(spawns.some(s=>Math.abs(s[0]-p.x)<size[0]+3&&Math.abs(s[2]-p.z)<size[2]+3))continue;
    result.push({kind:"cover",pos:[p.x,p.y??(size[1]),p.z],size});
  }
  return result;
}
