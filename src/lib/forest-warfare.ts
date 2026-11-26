/**
 * Forest Warfare: 244 m long, predominantly rectangular wooded valley.
 * All solid shapes are shared by the renderer and both physics simulations.
 * No hidden blocking boxes: boundary rock ridges are drawn from the same
 * regionBoundary() cover boxes, and cover props are rendered at these coordinates.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { regionBoundary, type MapRegion } from "./map-blueprints";
import { CTF_TREE_X, CTF_TREE_TOP } from "./ctf-rules";

export const FOREST_HALF_EXTENT = 124;
export const FOREST_REGIONS: MapRegion[] = [
  { x: 0, z: 0, w: 218, d: 88 },
  { x: -85, z: 0, w: 73, d: 96 },
  { x: 85, z: 0, w: 73, d: 96 },
];

export type ForestObject = { kind: "tree" | "bush" | "rock" | "log"; x: number; z: number; w: number; d: number; h: number; sideways?: boolean };
const layout: ForestObject[] = [];
const samples: [number,number,"tree"|"bush"|"rock"|"log"][] = [
  [6,7,"tree"],[13,16,"rock"],[21,3,"bush"],[30,27,"tree"],
  [3,22,"log"],[30,-31,"rock"],[48,15,"tree"],[57,-8,"rock"],[86,16,"log"],
  [9,33,"bush"],[22,38,"tree"],[35,39,"rock"],
  [14,-10,"rock"],[27,-23,"tree"],[42,-8,"bush"],[50,-32,"log"],
  [59,9,"tree"],[67,23,"bush"],[72,37,"tree"],[55,-18,"rock"],
  [67,-34,"tree"],[77,-4,"rock"],[82,35,"tree"],[104,38,"bush"],
  [109,-39,"rock"],[112,22,"tree"],[111,-22,"tree"],
  [10,-34,"log"],[18,-36,"rock"],[25,13,"tree"],[33,-14,"bush"],
  [39,37,"bush"],[52,3,"tree"],[60,38,"rock"],
  [65,-5,"bush"],[73,13,"log"],[79,-37,"tree"],[85,-22,"bush"],
  [88,43,"rock"],[115,-38,"bush"],[117,5,"tree"],
];
for (const [x,z,kind] of samples) for (const side of [-1,1]) {
  // Protect the home-tree decks, the north/south climb lanes, and team spawns.
  const px=side*x;
  const w=kind==="tree"?1.35:kind==="bush"?1.8:kind==="rock"?2.3:3.3;
  const d=kind==="tree"?1.35:kind==="bush"?1.6:kind==="rock"?2.4:1.0;
  const h=kind==="tree"?9+(x+Math.abs(z))%5:kind==="bush"?1.25:kind==="rock"?1.8:1.05;
  layout.push({kind,x:px,z,w,d,h,sideways:(x+z)%2===0});
}
// Seeded asymmetrical infill: enough small cover to fracture long sight-lines
// without sealing routes, flag circles, spawns, or any of the four stairways.
// All objects participate in identical renderer / server / client collision.
let forestSeed = 0x9e3779b9;
const nextForestRandom = () => {
  forestSeed ^= forestSeed << 13;
  forestSeed ^= forestSeed >>> 17;
  forestSeed ^= forestSeed << 5;
  return (forestSeed >>> 0) / 0x100000000;
};
const protectedSpawns = [
  ...([-1,1] as const).flatMap(sign => [
    [-104*sign,-29],[-84*sign,-29],[-108*sign,18],[-81*sign,26],
    [-95*sign,41],[-113*sign,-8],[-78*sign,-16],
    [107*sign,0],[94*sign,0],
  ]),
];
let added = 0;
for(let trial=0;trial<1100 && added<72;trial++) {
  const x=(nextForestRandom()*2-1)*116;
  const z=(nextForestRandom()*2-1)*40;
  // Avoid the tree trunks, deck-access footprint, entrance runs,
  // delivery circles and spawn protection zones.
  if(Math.abs(Math.abs(x)-94)<5 && Math.abs(z)<37)continue;
  // Keep the four new canopy access flights clear from ground to landing.
  if([-45,45].some(rampX=>Math.abs(x-rampX)<4.5&&Math.abs(z)>13&&Math.abs(z)<38))continue;
  if(Math.abs(Math.abs(x)-107)<6 && Math.abs(z)<8)continue;
  if(protectedSpawns.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<5.8))continue;
  if(layout.some(o=>Math.hypot(x-o.x,z-o.z)<(o.kind==="tree"?7:5.2)))continue;
  const roll=nextForestRandom();
  const kind:ForestObject["kind"]=roll<.4?"tree":roll<.75?"bush":"rock";
  const wide=.8+nextForestRandom()*.7;
  const prop:ForestObject={
    kind,x:Math.round(x*10)/10,z:Math.round(z*10)/10,
    w:kind==="tree"?.95*wide:kind==="rock"?1.5*wide:1.2*wide,
    d:kind==="tree"?.95*wide:kind==="rock"?1.5*wide:1.1*wide,
    h:kind==="tree"?8+nextForestRandom()*6:
      kind==="rock"?1+nextForestRandom()*1.2:1.1+nextForestRandom()*.65,
  };
  layout.push(prop);
  added++;
}
export const FOREST_OBJECTS: readonly ForestObject[] = layout;
/** Stable from authored tree/log coordinates, never an array index or RNG. */
export function forestLogCoverId(p:Pick<ForestObject,"x"|"z">):string{
  return `forest:log:${p.x}:${p.z}`;
}

// Natural, VISIBLE cliff/rock barrier around precisely the floor union.
export const FOREST_PERIMETER: CoverBox[] = regionBoundary(FOREST_REGIONS, 10);

// Narrow, open timber flights reach each tree deck from opposite sides.
// Treads are thin surfaces (not overlapping full-height wedges), so the
// trunk remains visible and the stairs occupy a much smaller visual volume.
export const FOREST_TREE_STAIRS: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  const steps:CoverBox[]=[];
  const count=Math.ceil(CTF_TREE_TOP/.42),tread=.56,thickness=.16;
  for(const side of [-1,1] as const) for(let i=0;i<count;i++){
    const top=CTF_TREE_TOP*(i+1)/count;
    const center=side*(11.6+(count-i-.5)*tread);
    steps.push({pos:[x,top-thickness/2,center],size:[.78,thickness/2,tread/2+.025],kind:"stair"});
  }
  return steps;
});

// Fine circular collision slices closely follow the rendered 13-unit deck.
// The previous seven broad rectangles left unsupported corners at the rim.
export const FOREST_TREE_DECKS: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X,radius=13,slices=104,depth=radius*2/slices;
  return Array.from({length:slices},(_,i)=>{
    const z=-radius+(i+.5)*depth;
    const halfWidth=Math.sqrt(Math.max(0,radius*radius-z*z))+.05;
    return {
      pos:[x,CTF_TREE_TOP-.24,z] as Vec3,
      size:[Math.max(.2,halfWidth),.24,depth/2+.025] as Vec3,
      kind:"platform" as const,
    };
  });
});
/** Visible low cover flanking each root and either stair approach. */
export const FOREST_BASE_COVER: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  return [
    // Bush-height root boulders around both lower approaches.
    ...([-1,1] as const).flatMap(side=>[
      {pos:[x+side*8,1.25,-23] as Vec3,size:[2.3,1.25,2.4] as Vec3,kind:"cover" as const,material:"concrete" as const},
      {pos:[x+side*7,1.05,26] as Vec3,size:[2.0,1.05,2.6] as Vec3,kind:"cover" as const,material:"concrete" as const},
      {pos:[x+side*13,.8,-8] as Vec3,size:[3,.8,1.2] as Vec3,kind:"cover" as const,material:"concrete" as const},
    ]),
    // Keep the delivery objective open; cover sits left/right of its approach.
    {pos:[x+sign*15,1.0,-9] as Vec3,size:[2.1,1.0,1.3] as Vec3,kind:"cover" as const,material:"concrete" as const},
    {pos:[x+sign*15,1.0,9] as Vec3,size:[2.1,1.0,1.3] as Vec3,kind:"cover" as const,material:"concrete" as const},
  ];
});
/** A staggered canopy route links both home trees without a single straight bridge.
 * Overlapping landings make the turns readable and provide several route choices. */
export const FOREST_CANOPY_COVER: CoverBox[] = [
  // Main route: alternating offsets and widened junctions make the route bend.
  {pos:[-78,11.92,0],size:[18,.10,2],kind:"platform"},
  {pos:[-57,11.92,2],size:[3,.10,4],kind:"platform"},
  {pos:[-36,11.92,4],size:[18,.10,2],kind:"platform"},
  {pos:[-15,11.92,0],size:[3,.10,5],kind:"platform"},
  {pos:[0,11.92,-3],size:[12,.10,2],kind:"platform"},
  {pos:[15,11.92,0],size:[3,.10,5],kind:"platform"},
  {pos:[36,11.92,4],size:[18,.10,2],kind:"platform"},
  {pos:[57,11.92,2],size:[3,.10,4],kind:"platform"},
  {pos:[78,11.92,0],size:[18,.10,2],kind:"platform"},
  // A northern loop gives the west-to-centre transition a genuine alternative.
  {pos:[-36,11.92,-3],size:[2,.10,5],kind:"platform"},
  {pos:[-24,11.92,-10],size:[12,.10,2],kind:"platform"},
  {pos:[-12,11.92,-6.5],size:[2,.10,1.5],kind:"platform"},
  // A short southern lookout spur offers a risky alternate firing position.
  {pos:[42,11.92,11],size:[2,.10,5],kind:"platform"},
  {pos:[42,11.92,19],size:[5,.10,3],kind:"platform"},
];
/** Low, staggered natural obstacles break the long sightline without sealing the walkway. */
export const FOREST_CANOPY_OBSTACLES: CoverBox[] = [
  {pos:[-69,12.52,.25],size:[.72,.5,.62],kind:"cover",material:"reinforced"},
  {pos:[-39,12.48,4.1],size:[1.05,.46,.38],kind:"cover",material:"thin_wood",ballisticId:"forest:canopy:log:west"},
  {pos:[-18,12.43,-3.4],size:[.55,.41,.55],kind:"cover",material:"reinforced"},
  {pos:[9,12.49,-2.4],size:[.8,.47,.72],kind:"cover",material:"reinforced"},
  {pos:[41,12.48,4.2],size:[1.1,.46,.38],kind:"cover",material:"thin_wood",ballisticId:"forest:canopy:log:east"},
  {pos:[70,12.50,-.15],size:[.7,.48,.68],kind:"cover",material:"reinforced"},
  {pos:[-24,12.45,-10],size:[.7,.42,.7],kind:"cover",material:"reinforced"},
  {pos:[40,12.45,19],size:[.7,.42,.7],kind:"cover",material:"reinforced"},
];
/** Timber support posts beneath exposed bridge joints, deliberately offset from the ground lanes. */
export const FOREST_CANOPY_SUPPORTS: CoverBox[] = [
  {pos:[-55,5.9,0],size:[.28,5.9,.28],kind:"cover",material:"thin_wood"},
  {pos:[-15,5.9,0],size:[.28,5.9,.28],kind:"cover",material:"thin_wood"},
  {pos:[20,5.9,4],size:[.28,5.9,.28],kind:"cover",material:"thin_wood"},
  {pos:[55,5.9,0],size:[.28,5.9,.28],kind:"cover",material:"thin_wood"},
];
/** Waist-high parapets, interrupted where the stairs meet the flag deck. */
export const FOREST_TREE_PARAPETS: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  return ([-1,1] as const).flatMap(side=>[
    {pos:[x+side*10.3,12.65,0] as Vec3,size:[.7,.65,4.1] as Vec3,kind:"cover" as const,material:"thin_wood" as const,ballisticId:`forest:parapet:${sign}:${side}:0`},
    {pos:[x+side*7.7,12.65,8.0] as Vec3,size:[2.8,.65,.65] as Vec3,kind:"cover" as const,material:"thin_wood" as const,ballisticId:`forest:parapet:${sign}:${side}:1`},
    {pos:[x+side*7.7,12.65,-8.0] as Vec3,size:[2.8,.65,.65] as Vec3,kind:"cover" as const,material:"thin_wood" as const,ballisticId:`forest:parapet:${sign}:${side}:2`},
  ]);
});
export const FOREST_WARFARE_COVER: CoverBox[]=[
  ...FOREST_PERIMETER,
  ...([-1,1] as const).map(sign=>({
    // The trunk ends exactly at the underside of the deck; no intersecting
    // coplanar volumes at the tree/bridge join.
    pos:[sign*CTF_TREE_X,5.76,0] as Vec3,size:[2.65,5.76,2.65] as Vec3,kind:"solid" as const,
  })),
  ...FOREST_TREE_DECKS,
  ...FOREST_CANOPY_COVER,
  ...FOREST_CANOPY_OBSTACLES,
  ...FOREST_CANOPY_SUPPORTS,
  ...FOREST_TREE_STAIRS,
  ...FOREST_BASE_COVER,
  ...FOREST_TREE_PARAPETS,
  // Foliage is visual-only; fallen logs splinter while mature trunks
  // remain too thick for the thin-wood penetration profile.
  ...layout.filter(p=>p.kind!=="bush").map(p=>({
    pos:[p.x,p.kind==="tree"?2.65:p.kind==="log"?.95:p.h/2,p.z] as Vec3,
    size:[p.w,p.kind==="tree"?2.65:p.kind==="log"?.95:p.h/2,p.d] as Vec3,
    kind:p.kind==="rock"?"platform" as const:"cover" as const,
    ...(p.kind==="log"
      ?{material:"thin_wood" as const,ballisticId:forestLogCoverId(p)}
      :p.kind==="tree"?{material:"reinforced" as const}:{}),
  })),
];
// All spawns are on solid ground around their home tree, outside the ramp lanes.
export const FOREST_SPAWNS={
  red:[[-104,0,-29],[-84,0,-29],[-108,0,18],[-81,0,26],[-95,0,41],[-113,0,-8],[-78,0,-16]] as Vec3[],
  blue:[[104,0,-29],[84,0,-29],[108,0,18],[81,0,26],[95,0,41],[113,0,-8],[78,0,-16]] as Vec3[],
  ffa:[[-104,0,-29],[104,0,-29],[-45,0,0],[45,0,0],[-95,0,41],[95,0,41]] as Vec3[],
};
