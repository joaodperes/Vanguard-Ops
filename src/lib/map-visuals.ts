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
  w?: number; d?: number; h?: number; text?: string; color?: string;
  /** Shared day/night architectural metadata; used by rendering AND authoritative collision. */
  use?: "house" | "cafe" | "supermarket" | "bakery" | "apartments" | "office" | "hotel" | "library" | "diner";
  shape?: "rect" | "narrow" | "round";
  stairSide?: "east" | "west";
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
  // Both Afterlight editions compile the EXACT same authored geometry. Vary the
  // lot dimensions, floor heights, entrances and functions; keep roads walkable.
  if(theme.biome==="city"||theme.biome==="city_day"){
    result.push({kind:"garden",x:0,z:0,w:80,d:80});
    result.push({kind:"bandstand",x:0,z:0,w:16,d:16,h:5});
    for(let x=-30;x<=30;x+=12)for(let z=-30;z<=30;z+=12){
      if(Math.hypot(x,z)<14||Math.abs(x)<5&&Math.abs(z)<26)continue;
      result.push({kind:(x+z)%24===0?"bench":"tree",x,z,h:6.8});
    }
    const purposes=["house","cafe","supermarket","apartments","bakery","office","hotel","library","diner"] as const;
    const signs:Record<(typeof purposes)[number],string>={
      house:"RESIDENCE",cafe:"CAFÉ",supermarket:"SUPERMARKET",
      apartments:"APARTMENTS",bakery:"BAKERY",office:"OFFICES",
      hotel:"HOTEL",library:"LIBRARY",diner:"DINER",
    };
    const buildings:MapProp[]=[];
    const addBuilding=(prop:MapProp)=>{
      const w=prop.w??20,d=prop.d??20;
      // Avoid the actual park square (not just a radial exclusion), allow
      // close-in infill without swallowing the public walking paths.
      if(Math.abs(prop.x)<40+w/2+5 && Math.abs(prop.z)<40+d/2+5)return;
      if(!insideRegions(prop.x,prop.z,plan.regions,Math.max(w,d)/2+3.5))return;
      if(buildings.some(q=>Math.abs(prop.x-q.x)<(w+(q.w??20))/2+4 &&
        Math.abs(prop.z-q.z)<(d+(q.d??20))/2+4))return;
      const boxes=cityBuildingBoxes(prop);
      if(boxes.some(c=>spawns.some(s=>s[1]<c.pos[1]+c.size[1]+.3 &&
        s[1]+1.8>c.pos[1]-c.size[1] &&
        Math.abs(s[0]-c.pos[0])<c.size[0]+2.6 &&
        Math.abs(s[2]-c.pos[2])<c.size[2]+2.6)))return;
      buildings.push(prop);result.push(prop);
    };
    // Reserve small residential lots on all four park frontages FIRST.
    // Legacy arena spawns crowd several obvious lots, so probe extra
    // deterministic positions and keep at most two safe houses per frontage.
    // addBuilding still rejects spawn collisions, overlapping lots and park
    // intrusions; never bypass those constraints to meet the infill target.
    const infillOffsets=[-27,0,27,-36,-18,-9,9,18,36];
    for(const side of [-1,1])for(const onXAxis of [true,false]){
      let placed=0;
      for(const offset of infillOffsets){
        const x=onXAxis?side*55:offset,z=onXAxis?offset:side*55;
        const before=buildings.length;
        addBuilding({kind:"building",x,z,w:14,d:15,h:4.6,use:"house",
          shape:"narrow",stairSide:side>0?"east":"west",text:"RESIDENCE"});
        if(buildings.length>before && ++placed===2)break;
      }
    }
    // 32m urban blocks, with narrow homes among bigger civic / retail
    // buildings. The old 40m grid left 25m+ dead zones around the park.
    for(let x=-180;x<=180;x+=32)for(let z=-180;z<=180;z+=32){
      const n=Math.floor(hashed("use:"+x+":"+z)*purposes.length);
      const use=purposes[n];
      const variant=hashed("shape:"+x+":"+z);
      const shape:MapProp["shape"]=variant<.28?"round":variant<.52?"narrow":"rect";
      const w=shape==="round"?20:shape==="narrow"?13:use==="supermarket"?26:use==="hotel"?23:18+Math.floor(hashed("width:"+x+":"+z)*4)*2;
      const d=shape==="round"?20:shape==="narrow"?23:use==="supermarket"?25:18+Math.floor(hashed("depth:"+x+":"+z)*4)*2;
      const baseHeight=use==="hotel"?10.4:use==="apartments"?9.1:use==="office"?8.2:
        use==="house"?4.8:use==="supermarket"?6.1:use==="cafe"?5.4:6.5;
      const h=shape==="round"?Math.min(6.6,baseHeight):baseHeight;
      const jitterX=(hashed("offsetX:"+x+":"+z)-.5)*1.2;
      const jitterZ=(hashed("offsetZ:"+x+":"+z)-.5)*1.2;
      addBuilding({kind:"building",x:x+jitterX,z:z+jitterZ,w,d,h,use,shape,
        stairSide:hashed("stairs:"+x+":"+z)<.5?"east":"west",text:signs[use]});
    }
    for(const p of buildings){
      // Lamps belong in the remaining pavements, never inside rooms.
      if(hashed("light:"+Math.round(p.x)+":"+Math.round(p.z))>.7)
        result.push({kind:"lamp",x:p.x+Math.min((p.w??20)/2+4,17),z:p.z+Math.min((p.d??20)/2+4,17)});
    }
  } else {
    const frequency=Math.ceil(theme.vegetation*(theme.biome==="highlands"?36:theme.biome==="jungle"?32:18));
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
      // Same 3D spawn clearance as addBuilding: elevated spawns must not
      // disqualify safe residences many metres below them.
      return !cityBuildingBoxes(p).some(c=>spawns.some(s=>
        s[1]<c.pos[1]+c.size[1]+.3 && s[1]+1.8>c.pos[1]-c.size[1] &&
        Math.abs(s[0]-c.pos[0])<c.size[0]+2.6 &&
        Math.abs(s[2]-c.pos[2])<c.size[2]+2.6));
    const radiusX=p.kind==="tree"?0.5:(p.w??(p.kind==="rock"?4:8))/2;
    const radiusZ=p.kind==="tree"?0.5:(p.d??(p.kind==="rock"?3:7))/2;
    return !spawns.some(s=>Math.abs(s[0]-p.x)<radiusX+3&&Math.abs(s[2]-p.z)<radiusZ+3);
  });
}
/** Collision parity: solid props participate in server/bot/player hit tests.
 * Low foliage is atmospheric; trees have slender trunks only, not an invisible
 * solid canopy. Shop fronts/ruins are solid exteriors, not fictitious entrances.
 */

/** A fixture is specified once and used for both the visible interior and hitbox. */
export interface CityFixture { x:number; z:number; w:number; d:number; h:number; style:"wood"|"seat"|"metal"|"display"|"shelf" }
export function cityInteriorFixtures(p:MapProp):CityFixture[]{
  const w=p.w??20,d=p.d??20;
  const x=-w*.24;
  const rear=-d*.24;
  switch(p.use){
    case "house": return [
      {x,z:0,w:3.8,d:1.35,h:.9,style:"seat"},
      {x,z:3,w:2,d:1.3,h:.65,style:"wood"},
      {x:-w*.3,z:rear,w:3.7,d:1.1,h:1.15,style:"wood"}];
    case "cafe": return [
      {x:-w*.24,z:rear,w:4.6,d:1.4,h:1.15,style:"wood"},
      {x:-w*.29,z:2,w:1.75,d:1.75,h:.78,style:"seat"},
      {x:0,z:-d*.02,w:1.75,d:1.75,h:.78,style:"seat"}];
    case "supermarket": return [
      {x:-w*.29,z:-d*.2,w:1.25,d:5.6,h:1.85,style:"shelf"},
      {x:0,z:-d*.22,w:1.3,d:5.3,h:1.85,style:"shelf"},
      {x:-w*.29,z:d*.27,w:3.6,d:1.1,h:1.05,style:"metal"}];
    case "bakery": return [
      {x:-w*.25,z:d*.19,w:4.4,d:1.15,h:1.25,style:"display"},
      {x:-w*.3,z:rear,w:3.7,d:1.5,h:1.05,style:"wood"}];
    case "library": return [
      {x:-w*.3,z:-d*.19,w:1.05,d:5.5,h:2.1,style:"shelf"},
      {x:0,z:-d*.24,w:1.05,d:4.1,h:2.1,style:"shelf"},
      {x:-w*.26,z:d*.19,w:3.4,d:1.2,h:.9,style:"wood"}];
    case "hotel": return [
      {x:-w*.22,z:d*.19,w:4.2,d:1.2,h:1.18,style:"display"},
      {x:-w*.31,z:rear,w:2.8,d:1.3,h:.9,style:"seat"}];
    case "apartments": return [
      {x:-w*.26,z:rear,w:3.8,d:1.1,h:1.08,style:"wood"},
      {x:-w*.25,z:d*.17,w:3.2,d:1.4,h:.86,style:"seat"}];
    case "office": return [
      {x:-w*.3,z:rear,w:3.2,d:1.45,h:.9,style:"metal"},
      {x:-w*.26,z:d*.2,w:3.4,d:1.4,h:.9,style:"metal"},
      {x:0,z:rear,w:1.35,d:1.35,h:1.6,style:"shelf"}];
    case "diner": return [
      {x:-w*.31,z:-d*.2,w:3,d:1.4,h:1.1,style:"display"},
      {x:-w*.3,z:d*.15,w:3.6,d:1.2,h:.8,style:"seat"}];
    default: return [];
  }
}
/**
 * Shared physics and visual envelope. Rectangular and narrow buildings have
 * functional interior roof hatches; round buildings use a stepped octagonal
 * shell and a roof accessed from a separate exterior stair.
 */
export function cityBuildingBoxes(p:MapProp):CoverBox[]{
  const w=p.w??20,d=p.d??20,h=p.h??6.4;
  const wall=.42,door=Math.min(5,w*.31),front=(w-door)/2;
  const a:CoverBox[]=[];
  const put=(x:number,y:number,z:number,hx:number,hy:number,hz:number,kind:"cover"|"platform"|"stair"="cover")=>{
    if(hx>.01&&hy>.01&&hz>.01)a.push({kind,pos:[p.x+x,y,p.z+z],size:[hx,hy,hz]});
  };
  if(p.shape==="round"){
    // Twelve connected orthogonal faces approximate an octagon without
    // introducing rotated hitboxes (server/player physics uses AABBs).
    const X=w/2,Z=d/2,shoulderX=X*.64,shoulderZ=Z*.64;
    put(0,h/2,-Z,shoulderX,h/2,wall);
    for(const side of [-1,1]){
      put(side*shoulderX,h/2,-(Z+shoulderZ)/2,wall,h/2,(Z-shoulderZ)/2);
      put(side*(X+shoulderX)/2,h/2,-shoulderZ,(X-shoulderX)/2,h/2,wall);
      put(side*X,h/2,0,wall,h/2,shoulderZ);
      put(side*(X+shoulderX)/2,h/2,shoulderZ,(X-shoulderX)/2,h/2,wall);
      put(side*shoulderX,h/2,(Z+shoulderZ)/2,wall,h/2,(Z-shoulderZ)/2);
      put(side*(shoulderX+door/2)/2,h/2,Z,(shoulderX-door/2)/2,h/2,wall);
    }
    put(0,(h+2.5)/2,Z,door,(h-2.5)/2,wall);
    // Walkable roof follows the smaller stepped footprint.
    put(0,h+.16,0,X*.65,.16,Z);
    put(-(X*.825),h+.16,0,X*.175,.16,Z*.63);
    put(X*.825,h+.16,0,X*.175,.16,Z*.63);
  }else{
    put(0,h/2,-d/2,w/2,h/2,wall);
    put(-w/2,h/2,0,wall,h/2,d/2);
    put(w/2,h/2,0,wall,h/2,d/2);
    put(-(w+door)/4,h/2,d/2,front/2,h/2,wall);
    put((w+door)/4,h/2,d/2,front/2,h/2,wall);
    put(0,(h+2.5)/2,d/2,door/2,(h-2.5)/2,wall);
    // Four real slab sections frame the working internal hatch.
    const hatchX=w/2-2.8,hatchZ=-d/2+3.4,hatchW=3.6,hatchD=5.2;
    const ax=hatchX-hatchW/2,bx=hatchX+hatchW/2;
    const az=hatchZ-hatchD/2,bz=hatchZ+hatchD/2;
    put((-w/2+ax)/2,h+.16,0,(ax+w/2)/2,.16,d/2,"platform");
    put((bx+w/2)/2,h+.16,0,(w/2-bx)/2,.16,d/2,"platform");
    put((ax+bx)/2,h+.16,(-d/2+az)/2,(bx-ax)/2,.16,(az+d/2)/2,"platform");
    put((ax+bx)/2,h+.16,(bz+d/2)/2,(bx-ax)/2,.16,(d/2-bz)/2,"platform");
    // Interior flight occupies its own east-side aisle, climbs toward
    // the back and terminates INSIDE the roof aperture.
    const count=Math.ceil(h/.39),tread=(d-5.2)/count;
    const crest=-d/2+3.2;
    for(let i=0;i<count;i++){
      const height=h*(i+1)/count,z=crest+(count-1-i)*tread;
      put(hatchX,height/2,z,1.15,height/2+.001,tread/2+.015,"stair");
    }
    put(hatchX,h+.16,crest,1.45,.16,1.2,"platform");
  }
  // Exterior fire escape direction varies by lot. The tread lengths adjust to
  // each depth/height instead of creating staircases outside narrow houses.
  const side=p.stairSide==="east"?1:-1;
  const stairX=side*(w/2+1.65),count=Math.ceil(h/.39);
  const tread=(d-5.2)/count,crest=-d/2+3.2;
  for(let i=0;i<count;i++){
    const height=h*(i+1)/count,z=crest+(count-1-i)*tread;
    put(stairX,height/2,z,1.25,height/2+.001,tread/2+.015,"stair");
  }
  put(side*(w/2+.82),h+.16,crest,1.45,.16,1.5,"platform");
  for(const fixture of cityInteriorFixtures(p)){
    put(fixture.x,fixture.h/2,fixture.z,fixture.w/2,fixture.h/2,fixture.d/2);
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
