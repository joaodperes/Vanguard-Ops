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
  [6,7,"tree"],[13,16,"rock"],[21,3,"bush"],[30,27,"tree"],[38,15,"log"],
  [9,33,"bush"],[22,38,"tree"],[35,39,"rock"],[46,28,"tree"],
  [14,-10,"rock"],[27,-23,"tree"],[42,-8,"bush"],[50,-32,"log"],
  [59,9,"tree"],[67,23,"bush"],[72,37,"tree"],[55,-18,"rock"],
  [67,-34,"tree"],[77,-4,"rock"],[82,35,"tree"],[104,38,"bush"],
  [109,-39,"rock"],[112,22,"tree"],[111,-22,"tree"],
  [10,-34,"log"],[18,-36,"rock"],[25,13,"tree"],[33,-14,"bush"],
  [39,37,"bush"],[47,-38,"tree"],[52,3,"tree"],[60,38,"rock"],
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
export const FOREST_OBJECTS: readonly ForestObject[] = layout;

// Natural, VISIBLE cliff/rock barrier around precisely the floor union.
export const FOREST_PERIMETER: CoverBox[] = regionBoundary(FOREST_REGIONS, 10);

// Discrete long flights of half-metre steps. Both stair geometry and render
// share these boxes; the final riser directly meets the deck rim.
export const FOREST_TREE_STAIRS: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  const steps:CoverBox[]=[];
  const count=24,tread=.94;
  for(const side of [-1,1] as const) for(let i=0;i<count;i++){
    const top=CTF_TREE_TOP*(i+1)/count;
    const center=side*(11.6+(count-i-.5)*tread);
    steps.push({pos:[x,top/2,center],size:[2.7,top/2,tread/2+.025],kind:"stair"});
  }
  return steps;
});

// Slices approximate the circular treetop, so collision extends to the
// visually rendered round deck (unlike a hidden square platform).
export const FOREST_TREE_DECKS: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  const strips:[number,number,number][]=[
    [0,3,11.6],[-4.3,1.3,10.5],[4.3,1.3,10.5],
    [-7.1,1.5,8.8],[7.1,1.5,8.8],[-9.8,2.1,5.7],[9.8,2.1,5.7],
  ];
  return strips.map(([z,hz,hx])=>({
    pos:[x,CTF_TREE_TOP-.24,z] as Vec3,
    size:[hx,.24,hz] as Vec3,
    kind:"platform" as const,
  }));
});
/** Visible low cover flanking each root and either stair approach. */
export const FOREST_BASE_COVER: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  return [
    // Bush-height root boulders around both lower approaches.
    ...([-1,1] as const).flatMap(side=>[
      {pos:[x+side*8,1.25,-23] as Vec3,size:[2.3,1.25,2.4] as Vec3,kind:"cover" as const},
      {pos:[x+side*7,1.05,26] as Vec3,size:[2.0,1.05,2.6] as Vec3,kind:"cover" as const},
      {pos:[x+side*13,.8,-8] as Vec3,size:[3,.8,1.2] as Vec3,kind:"cover" as const},
    ]),
    // Keep the delivery objective open; cover sits left/right of its approach.
    {pos:[x+sign*15,1.0,-9] as Vec3,size:[2.1,1.0,1.3] as Vec3,kind:"cover" as const},
    {pos:[x+sign*15,1.0,9] as Vec3,size:[2.1,1.0,1.3] as Vec3,kind:"cover" as const},
  ];
});
/** Waist-high parapets, interrupted where the stairs meet the flag deck. */
export const FOREST_TREE_PARAPETS: CoverBox[] = ([-1,1] as const).flatMap(sign=>{
  const x=sign*CTF_TREE_X;
  return ([-1,1] as const).flatMap(side=>[
    {pos:[x+side*10.3,12.65,0] as Vec3,size:[.7,.65,4.1] as Vec3,kind:"cover" as const},
    {pos:[x+side*7.7,12.65,8.0] as Vec3,size:[2.8,.65,.65] as Vec3,kind:"cover" as const},
    {pos:[x+side*7.7,12.65,-8.0] as Vec3,size:[2.8,.65,.65] as Vec3,kind:"cover" as const},
  ]);
});
export const FOREST_WARFARE_COVER: CoverBox[]=[
  ...FOREST_PERIMETER,
  ...([-1,1] as const).map(sign=>({
    pos:[sign*CTF_TREE_X,5.9,0] as Vec3,size:[2.65,5.9,2.65] as Vec3,kind:"solid" as const,
  })),
  ...FOREST_TREE_DECKS,
  ...FOREST_TREE_STAIRS,
  ...FOREST_BASE_COVER,
  ...FOREST_TREE_PARAPETS,
  ...layout.map(p=>({
    pos:[p.x,p.kind==="tree"?2.65:p.h/2,p.z] as Vec3,
    size:[p.w,p.kind==="tree"?2.65:p.h/2,p.d] as Vec3,
    kind:p.kind==="rock"?"platform" as const:"cover" as const,
  })),
];
// All spawns are on solid ground around their home tree, outside the ramp lanes.
export const FOREST_SPAWNS={
  red:[[-104,0,-29],[-84,0,-29],[-108,0,18],[-81,0,26],[-95,0,41],[-113,0,-8],[-78,0,-16]] as Vec3[],
  blue:[[104,0,-29],[84,0,-29],[108,0,18],[81,0,26],[95,0,41],[113,0,-8],[78,0,-16]] as Vec3[],
  ffa:[[-104,0,-29],[104,0,-29],[-45,0,0],[45,0,0],[-95,0,41],[95,0,41]] as Vec3[],
};
