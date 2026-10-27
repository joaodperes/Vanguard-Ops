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
  "building" | "boat" | "dock" | "garden" | "bench" | "bandstand" |
  "furnace" | "conveyor" | "hydraulic_press" | "generator" | "storage_rack" |
  "vent_stack" | "industrial_pipe" | "steel_coil" | "cargo_pallet";
export interface MapProp {
  kind: PropKind; x: number; z: number; y?: number;
  /** Stable identifier for a generated lot; survives moving a promoted building. */
  lotId?: string;
  w?: number; d?: number; h?: number; text?: string; color?: string;
  /** Saved editor orientation; extent dimensions already reflect the rotation. */
  turns?: 0 | 1 | 2 | 3;
  /** Shared day/night architectural metadata; used by rendering AND authoritative collision. */
  use?: "house" | "cafe" | "supermarket" | "bakery" | "apartments" | "office" | "hotel" | "library" | "diner" | "clinic" | "workshop" | "gallery" | "florist" | "gym";
  shape?: "rect" | "narrow" | "round";
  stairSide?: "east" | "west";
  /** Buildings with no roof route have neither inner nor external stairs. */
  roofAccess?: boolean;
  facade?: "brick" | "stucco" | "concrete" | "glass" | "timber" | "industrial";
}
/** Shared runtime/editor façade recipes, blended by the renderer in linear color space. */
export const CITY_USE_FACADE_COLORS:Record<string,number>={
  house:0xac866c,cafe:0xb87d58,supermarket:0x548477,
  bakery:0xbf9569,apartments:0x8993a4,office:0x577b9c,
  hotel:0x9e7396,library:0x8b7862,diner:0xa94d66,
  clinic:0x9abfc2,workshop:0x827d68,gallery:0xb0a3bb,
  florist:0x82a979,gym:0x648d96,
};
export const CITY_FACADE_TINTS:Record<string,number>={
  brick:0xa45b48,stucco:0xd1bba0,concrete:0x92949b,
  glass:0x638aa2,timber:0x947556,industrial:0x777e86,
};
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
  const authoredBuildings=result.filter(p=>p.kind==="building");
  // Both Afterlight editions compile the EXACT same authored geometry. Vary the
  // lot dimensions, floor heights, entrances and functions; keep roads walkable.
  if(theme.biome==="city"||theme.biome==="city_day"){
    result.push({kind:"garden",x:0,z:0,w:80,d:80});
    result.push({kind:"bandstand",x:0,z:0,w:16,d:16,h:5});
    for(let x=-30;x<=30;x+=12)for(let z=-30;z<=30;z+=12){
      if(Math.hypot(x,z)<14||Math.abs(x)<5&&Math.abs(z)<26)continue;
      result.push({kind:(x+z)%24===0?"bench":"tree",x,z,h:6.8});
    }
    const purposes=["house","cafe","supermarket","apartments","bakery","office","hotel","library","diner","clinic","workshop","gallery","florist","gym"] as const;
    const facades=["brick","stucco","concrete","glass","timber","industrial"] as const;
    const signs:Record<(typeof purposes)[number],string>={
      house:"RESIDENCE",cafe:"CAFÉ",supermarket:"SUPERMARKET",
      apartments:"APARTMENTS",bakery:"BAKERY",office:"OFFICES",
      hotel:"HOTEL",library:"LIBRARY",diner:"DINER",
      clinic:"CLINIC",workshop:"WORKSHOP",gallery:"GALLERY",florist:"FLOWERS",gym:"FITNESS",
    };
    const buildings:MapProp[]=[];
    const addBuilding=(draft:MapProp)=>{
      const key=Math.round(draft.x)+":"+Math.round(draft.z);
      const lotId=draft.lotId??("city:"+Math.round(draft.x*100)+":"+Math.round(draft.z*100));
      if(plan.cityBuildingDisabled?.includes(lotId))return;
      const prop:MapProp={...draft,lotId,
        facade:draft.facade??facades[Math.floor(hashed("facade:"+key)*facades.length)],
        roofAccess:draft.roofAccess??hashed("roof:"+key)<(draft.use==="house"?.19:.39),
      };
      const w=prop.w??20,d=prop.d??20;
      // Avoid the actual park square (not just a radial exclusion), allow
      // close-in infill without swallowing the public walking paths.
      if(Math.abs(prop.x)<40+w/2+5 && Math.abs(prop.z)<40+d/2+5)return;
      const edgeShopfront=w<=11.5&&d<=14.5&&prop.roofAccess===false;
      if(edgeShopfront){
        // Boundary shops can sit a couple of metres from a district wall.
        // Test *all* corners, not just a large circular setback from its
        // centre; no walls or stairs are allowed outside the playable union.
        if(!([-1,1] as const).every(sx=>([-1,1] as const).every(sz=>
          insideRegions(prop.x+sx*w/2,prop.z+sz*d/2,plan.regions,1.45))))return;
      }else if(!insideRegions(prop.x,prop.z,plan.regions,Math.max(w,d)/2+3.5))return;
      if([...authoredBuildings,...buildings].some(q=>Math.abs(prop.x-q.x)<(w+(q.w??20))/2+4 &&
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
    // Additional residential lots in the wider districts (from dev). They
    // follow the same footprint, overlap and spawn checks as park infill.
    for(const side of [-1,1])for(const offset of [-40,-20,0,20,40])
      for(const [x,z] of [[side*78,offset],[offset,side*78]])
        addBuilding({kind:"building",x,z,w:14,d:15,h:4.6,use:"house",
          shape:"narrow",stairSide:side>0?"east":"west",text:"RESIDENCE"});
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
        use==="house"?4.8:use==="supermarket"?6.1:use==="cafe"?5.4:
        use==="clinic"?7.1:use==="workshop"?5.3:use==="gallery"?6.8:
        use==="gym"?7.2:use==="florist"?4.9:6.5;
      const h=shape==="round"?Math.min(6.6,baseHeight):baseHeight;
      const jitterX=(hashed("offsetX:"+x+":"+z)-.5)*1.2;
      const jitterZ=(hashed("offsetZ:"+x+":"+z)-.5)*1.2;
      addBuilding({kind:"building",x:x+jitterX,z:z+jitterZ,w,d,h,use,shape,
        stairSide:hashed("stairs:"+x+":"+z)<.5?"east":"west",text:signs[use]});
    }
    // Slim 10x13 shopfronts and row homes follow OUTER district walls.
    // They are deliberately added after the large blocks, filling otherwise
    // empty 20m+ roadside gaps while retaining existing spawn clearance.
    const microUses:NonNullable<MapProp["use"]>[]=["house","bakery","workshop","florist","cafe","house"];
    let fringeIndex=0;
    for(const r of plan.regions){
      const placement=(x:number,z:number)=>{
        const use=microUses[fringeIndex++%microUses.length];
        const w=10.2,d=12.8,h=4.5+Math.round(hashed("edge-height:"+x+":"+z)*2)*.55;
        addBuilding({kind:"building",x:Math.round(x*10)/10,z:Math.round(z*10)/10,
          w,d,h,use,shape:"narrow",roofAccess:false,
          facade:facades[Math.floor(hashed("edge-facade:"+x+":"+z)*facades.length)],
          text:signs[use]});
      };
      const startZ=r.z-r.d/2+9,endZ=r.z+r.d/2-9;
      for(let z=startZ;z<=endZ;z+=17){
        placement(r.x-r.w/2+5.1+1.9,z);
        placement(r.x+r.w/2-5.1-1.9,z);
      }
      const startX=r.x-r.w/2+8,endX=r.x+r.w/2-8;
      for(let x=startX;x<=endX;x+=17){
        placement(x,r.z-r.d/2+6.4+1.9);
        placement(x,r.z+r.d/2-6.4-1.9);
      }
    }
    // Independent pedestrian lighting replaces the former sparse
    // building-based 30% chance. The same seed applies to day and night.
    // Avoid façade intersections, exits, stairs, spawns and park planting.
    const lamps:MapProp[]=[];
    const candidates:[number,number][]=[];
    for(let x=-174;x<=174;x+=24)for(let z=-174;z<=174;z+=24){
      if(hashed("streetlamp:"+x+":"+z)<.31)continue;
      candidates.push([x,z]);
    }
    for(const side of [-1,1])for(let t=-32;t<=32;t+=16){
      candidates.push([side*44,t],[t,side*44]);
    }
    for(const [x,z] of candidates){
      if(lamps.length>=62)break;
      if(!insideRegions(x,z,plan.regions,2.6))continue;
      if(Math.abs(x)<40.5&&Math.abs(z)<40.5)continue;
      if(spawns.some(p=>Math.hypot(p[0]-x,p[2]-z)<6))continue;
      if(lamps.some(p=>Math.hypot(p.x-x,p.z-z)<13))continue;
      if([...authoredBuildings,...buildings].some(p=>
        Math.abs(x-p.x)<(p.w??20)/2+2.1&&Math.abs(z-p.z)<(p.d??20)/2+2.1))continue;
      if(buildings.some(p=>cityBuildingBoxes(p).some(c=>c.kind==="stair"&&
        Math.abs(x-c.pos[0])<c.size[0]+2&&Math.abs(z-c.pos[2])<c.size[2]+2)))continue;
      lamps.push({kind:"lamp",x,z,h:6.7,color:"#ffd69a"});
    }
    result.push(...lamps);
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

/** Purpose-built physical furniture and partition walls, mirrored in Three.js.
 * The rear room is separated by a real wall with a 3.4m doorway. The main
 * entrance and any interior flight aisle remain unobstructed.
 */
export type CityFixtureStyle = "partition"|"bed"|"sofa"|"table"|"counter"|
  "shelf"|"desk"|"cabinet"|"workbench"|"plant"|"bench"|"display"|
  "locker"|"reception"|"espresso"|"oven"|"checkout"|"treadmill"|
  "exam_bed"|"sculpture"|"server_rack"|"television";
export interface CityFixture { x:number;z:number;w:number;d:number;h:number;style:CityFixtureStyle }
export function cityInteriorFixtures(p:MapProp):CityFixture[]{
  const w=p.w??20,d=p.d??20,access=p.roofAccess??true,round=p.shape==="round";
  const out:CityFixture[]=[];
  const wallZ=-d*.15,doorHalf=1.7,left=-w/2+.7,right=access&&!round?w/2-4.25:w/2-.7;
  if(-doorHalf-left>.35)out.push({x:(left-doorHalf)/2,z:wallZ,w:-doorHalf-left,d:.24,h:2.85,style:"partition"});
  if(right-doorHalf>.35)out.push({x:(doorHalf+right)/2,z:wallZ,w:right-doorHalf,d:.24,h:2.85,style:"partition"});
  const dims:Record<CityFixtureStyle,[number,number,number]>={
    partition:[1,.24,2.85],bed:[2.1,2.7,.9],sofa:[2.8,1.15,1.2],
    table:[1.65,1.55,.8],counter:[2.8,1,1.2],shelf:[1.1,3.0,2.05],
    desk:[2.5,1.15,1.15],cabinet:[1.4,.82,2],workbench:[2.6,1.1,1.2],
    plant:[1,1,1.6],bench:[2.2,1,.96],display:[1.9,1.15,1.5],
    locker:[1.4,.85,2.1],reception:[2.9,1,1.2],
    espresso:[1.65,.85,1.35],oven:[2.0,1.4,1.65],checkout:[1.6,1.0,1.15],
    treadmill:[1.2,2.5,1.25],exam_bed:[1.9,2.3,1.05],
    sculpture:[1.2,1.2,1.65],server_rack:[1.35,1.0,2.15],
    television:[1.55,.45,1.45],
  };
  // Every function has its own fixtures and several different layouts.
  // Seed variations by the lot, not by map ID: day/night remain identical.
  const rooms:Record<NonNullable<MapProp["use"]>,readonly CityFixtureStyle[]>={
    house:["bed","cabinet","sofa","table","television","plant","shelf","desk"],
    apartments:["bed","cabinet","desk","sofa","television","shelf","table","plant"],
    cafe:["counter","espresso","table","table","display","shelf","plant","bench"],
    supermarket:["shelf","checkout","shelf","cabinet","shelf","display","shelf","shelf"],
    bakery:["oven","counter","display","shelf","table","espresso","cabinet","bench"],
    office:["desk","server_rack","desk","cabinet","plant","desk","shelf","reception"],
    hotel:["bed","cabinet","reception","sofa","television","plant","desk","bench"],
    library:["shelf","desk","shelf","bench","shelf","shelf","plant","table"],
    diner:["counter","table","bench","table","espresso","checkout","bench","cabinet"],
    clinic:["exam_bed","cabinet","reception","bench","desk","shelf","plant","exam_bed"],
    workshop:["workbench","shelf","workbench","cabinet","locker","workbench","shelf","bench"],
    gallery:["sculpture","display","display","bench","sculpture","display","plant","desk"],
    florist:["plant","counter","plant","shelf","display","plant","plant","table"],
    gym:["treadmill","locker","bench","treadmill","bench","locker","plant","treadmill"],
  };
  const layout=rooms[p.use??"house"],seed=(p.lotId??"authored")+":"+Math.round(p.x*10)+":"+Math.round(p.z*10);
  const varied=Math.floor(hashed("interior-var:"+seed)*3);
  // Candidate rows hug the walls; preserve an unobstructed central entrance
  // and passage to the rear room. Roof-access buildings reserve the entire
  // east-side staircase aisle, including the upper hatch approach.
  const rowZ=[-d*.33,d*.20,-d*.055,d*.36];
  for(let row=0;row<4;row++)for(let side=0;side<2;side++){
    const slot=row*2+side;
    const index=slot===0?0:1+((slot-1+varied*2)%(layout.length-1));
    const style=layout[index];
    const [fw,fd,fh]=dims[style];
    const leftSide=side===0;
    if(access&&!round&&!leftSide)continue;
    const baseX=leftSide?-w*.30:w*.30;
    const wobble=(hashed("furniture-x:"+seed+":"+slot)-.5)*.35;
    const x=baseX+wobble;
    const z=rowZ[row]+(hashed("furniture-z:"+seed+":"+slot)-.5)*.42;
    if(Math.abs(x)+fw/2>w/2-.68||Math.abs(z)+fd/2>d/2-.73)continue;
    if(Math.abs(x)<fw/2+1.7)continue;
    if(access&&!round&&x+fw/2>w/2-4.75)continue;
    if(Math.abs(z-wallZ)<fd/2+.45)continue;
    if(out.some(q=>Math.abs(q.x-x)<(q.w+fw)/2+.28&&Math.abs(q.z-z)<(q.d+fd)/2+.28))continue;
    out.push({x,z,w:fw,d:fd,h:fh,style});
  }
  return out;
}
/**
 * Shared physics and visual envelope. Rectangular and narrow buildings have
 * functional interior roof hatches; round buildings use a stepped octagonal
 * shell and a roof accessed from a separate exterior stair.
 */
export function cityBuildingBoxes(p:MapProp):CoverBox[]{
  const quarter=(((p.turns??0)%4)+4)%4;
  const odd=quarter%2===1;
  // Width/depth in authored JSON are always WORLD extents. Building layout
  // is constructed in its own coordinates, then quarter-turned as a whole.
  const w=odd?(p.d??20):(p.w??20),d=odd?(p.w??20):(p.d??20),h=p.h??6.4;
  const cosine=[1,0,-1,0][quarter],sine=[0,1,0,-1][quarter];
  const wall=.42,door=Math.min(5,w*.31),front=(w-door)/2;
  const a:CoverBox[]=[];
  const put=(x:number,y:number,z:number,hx:number,hy:number,hz:number,kind:"cover"|"platform"|"stair"="cover")=>{
    if(hx>.01&&hy>.01&&hz>.01)a.push({
      kind,pos:[p.x+cosine*x+sine*z,(p.y??0)+y,p.z-sine*x+cosine*z],
      size:[odd?hz:hx,hy,odd?hx:hz],
    });
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
    const roofKind=p.roofAccess??true?"platform":"cover";
    put(0,h+.16,0,X*.65,.16,Z,roofKind);
    put(-(X*.825),h+.16,0,X*.175,.16,Z*.63,roofKind);
    put(X*.825,h+.16,0,X*.175,.16,Z*.63,roofKind);
  }else{
    put(0,h/2,-d/2,w/2,h/2,wall);
    put(-w/2,h/2,0,wall,h/2,d/2);
    put(w/2,h/2,0,wall,h/2,d/2);
    put(-(w+door)/4,h/2,d/2,front/2,h/2,wall);
    put((w+door)/4,h/2,d/2,front/2,h/2,wall);
    put(0,(h+2.5)/2,d/2,door/2,(h-2.5)/2,wall);
    if(p.roofAccess??true){
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
    }else{
      // Sealed roof: no hatch, hidden stairs or fake fire-escape access.
      put(0,h+.16,0,w/2,.16,d/2,"platform");
    }
  }
  if(p.roofAccess??true){
    // Fire escapes only on designated climbable buildings.
    const side=p.stairSide==="east"?1:-1;
    const stairX=side*(w/2+1.65),count=Math.ceil(h/.39);
    const tread=(d-5.2)/count,crest=-d/2+3.2;
    for(let i=0;i<count;i++){
      const height=h*(i+1)/count,z=crest+(count-1-i)*tread;
      put(stairX,height/2,z,1.25,height/2+.001,tread/2+.015,"stair");
    }
    put(side*(w/2+.82),h+.16,crest,1.45,.16,1.5,"platform");
  }
  for(const fixture of cityInteriorFixtures({...p,w,d})){
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
