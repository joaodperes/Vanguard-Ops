/**
 * Small, original, retro-FPS surface generator.
 *
 * Inspired by the strong material hierarchy and tiling rhythm of classic FPS
 * environments, not copied from LibreQuake or any external art pack.
 * All textures are built once per map load and tiled in world units: one
 * cobblestone cannot suddenly stretch across an eighty-metre courtyard.
 *
 * Deliberately uses opaque CanvasTexture / MeshStandardMaterial rather than
 * external URLs, alpha-blended decals, live CDNs or hundreds of unique maps.
 * Server map collision never imports Three.js or this module.
 */
import * as THREE from "three";
import type { MapDef } from "./game-protocol";
import type { SurfacePattern, SurfaceRecipe, SurfaceSlot } from "./map-visuals";

const SLOTS: SurfaceSlot[]=["floor","wall","cover","stair","platform"];
const DEFAULTS: Record<SurfaceSlot,SurfaceRecipe>={
  floor:{pattern:"concrete",tileSize:7,roughness:.94},
  wall:{pattern:"brick",tileSize:6,roughness:.87},
  cover:{pattern:"stone",tileSize:4,roughness:.89},
  stair:{pattern:"grate",tileSize:3,roughness:.78},
  platform:{pattern:"metal",tileSize:5,roughness:.81},
};
export type MapSurfaceMaterials = {
  [K in SurfaceSlot]: THREE.MeshStandardMaterial
};
const colorString=(c:THREE.Color)=>"#"+c.getHexString();
function tone(color:number,dl:number):string {
  const c=new THREE.Color(color);
  c.offsetHSL(0,0,dl);
  return colorString(c);
}
function hash(s:string):number {
  let h=2166136261;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
  return h>>>0;
}
function rand(seed:number):()=>number{
  let value=seed || 7;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
function patternCanvas(pattern:SurfacePattern,color:number):HTMLCanvasElement {
  const c=document.createElement("canvas");c.width=128;c.height=128;
  const g=c.getContext("2d");
  if(!g)return c;
  const r=rand(hash(pattern+":"+color.toString(16)));
  const base=tone(color,.025),light=tone(color,.13),dark=tone(color,-.115);
  g.fillStyle=base;g.fillRect(0,0,128,128);
  const rule=(x1:number,y1:number,x2:number,y2:number,alpha=.5,width=2)=>{
    g.globalAlpha=alpha;g.strokeStyle=dark;g.lineWidth=width;g.beginPath();
    g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.globalAlpha=1;
  };
  const rect=(x:number,y:number,w:number,h:number,fill:string,alpha=1)=>{
    g.globalAlpha=alpha;g.fillStyle=fill;g.fillRect(x,y,w,h);g.globalAlpha=1;
  };
  if(pattern==="brick" || pattern==="pavers" || pattern==="moss"){
    const h=pattern==="brick"?24:32,w=pattern==="brick"?48:32;
    for(let row=0;row<Math.ceil(128/h)+1;row++){
      const offset=(row%2)*w/2;
      for(let x=-w;x<=128+w;x+=w){
        const px=x+offset,py=row*h;
        rect(px+2,py+2,w-4,h-4,r()>.45?light:base,pattern==="moss"?.20:.18);
        rule(px,py,px+w,py,.65,2);
        rule(px,py,px,py+h,.65,2);
      }
    }
    if(pattern==="moss"){
      for(let i=0;i<75;i++){
        const x=r()*128,y=r()*128,sz=1+r()*10;
        rect(x,y,sz,sz*.68,i%4===0?"#799b4a":"#547944",.30+r()*.25);
      }
    }
  }else if(pattern==="concrete"){
    for(let i=0;i<=128;i+=64){rule(i,0,i,128,.42,3);rule(0,i,128,i,.42,3);}
    for(let n=0;n<4;n++){
      let x=r()*128,y=r()*128;
      for(let k=0;k<5;k++){
        const nx=x+(r()-.5)*13,ny=y+(r()-.5)*11;
        rule(x,y,nx,ny,.23,1);x=nx;y=ny;
      }
    }
  }else if(pattern==="planks"){
    for(let i=0;i<=128;i+=22){
      rect(0,i+2,128,18,i%44===0?light:base,.24);
      rule(0,i,128,i,.72,2);
      for(let x=0;x<128;x+=64){
        const seam=(i%44===0?x:x+32);
        rule(seam,i,seam,i+21,.4,1);
        rect(seam+2,i+5,2,2,dark,.6);
        rect(seam+2,i+17,2,2,dark,.6);
      }
    }
  }else if(pattern==="metal" || pattern==="rust" || pattern==="grate"){
    if(pattern==="grate"){
      rect(0,0,128,128,dark,.45);
      for(let i=-128;i<256;i+=16){
        rule(i,0,i+128,128,.65,3);
        rule(i+128,0,i,128,.40,3);
      }
      for(let i=0;i<=128;i+=64){
        rect(i-3,0,6,128,light,.23);
      }
    }else {
      for(let i=0;i<=128;i+=32){
        rule(i,0,i,128,.65,3);
        rule(i+3,0,i+3,128,.32,1);
      }
      for(let i=12;i<128;i+=64)for(let j=12;j<128;j+=64){
        rect(i,j,4,4,dark,.8);
        rect(i+1,j+1,2,2,light,.64);
      }
      if(pattern==="rust"){
        for(let n=0;n<40;n++)
          rect(r()*128,r()*128,3+r()*12,2+r()*7,r()>.6?"#ba6435":"#794b34",.28);
      }
    }
  }else if(pattern==="stone"){
    for(let y=0;y<128;y+=32){
      const offset=(y/32)%2*17;
      for(let x=-48;x<130;x+=44){
        const xx=x+offset,yy=y;
        rect(xx+3,yy+3,38,26,r()>.5?light:dark,.15);
        rule(xx,yy,xx+44,yy,.54,2.5);
        rule(xx,yy,xx,yy+32,.54,2.5);
      }
    }
  }else if(pattern==="snow"){
    for(let i=0;i<42;i++){
      const x=r()*128,y=r()*128;
      rect(x,y,10+r()*16,2+r()*5,light,.23);
    }
    for(let i=0;i<12;i++){
      const x=r()*128,y=r()*128;
      rule(x,y,x+12+r()*14,y-2-r()*4,.18,2);
    }
  }else if(pattern==="asphalt"){
    for(let i=0;i<24;i++){
      const x=r()*128,y=r()*128;
      rule(x,y,x+2+r()*12,y+r()*5,.25,1);
    }
  }else if(pattern==="grass"){
    for(let i=0;i<180;i++){
      const x=r()*128,y=r()*128;
      rule(x,y,x+(r()-.5)*5,y-2-r()*6,.24,1);
    }
  }
  // Granular wear and small chipped edges echo low-resolution retro material
  // work without importing third-party image pixels.
  for(let i=0;i<330;i++){
    const x=Math.floor(r()*128),y=Math.floor(r()*128);
    rect(x,y,1+r()*2,1+r()*2,r()>.53?light:dark,.08+r()*.18);
  }
  return c;
}
export function createPatternedMaterial(color:number,recipe:SurfaceRecipe):THREE.MeshStandardMaterial {
  const tex=new THREE.CanvasTexture(patternCanvas(recipe.pattern,color));
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.magFilter=THREE.NearestFilter;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.anisotropy=4;
  return new THREE.MeshStandardMaterial({
    map:tex,color:0xffffff,roughness:recipe.roughness,
    metalness:["metal","rust","grate"].includes(recipe.pattern)?.20:0,
  });
}
export function createMapSurfaceMaterials(map:MapDef):MapSurfaceMaterials{
  const colors:Record<SurfaceSlot,number>={
    floor:map.theme.floor,wall:map.theme.wall,cover:map.theme.cover,
    stair:map.theme.stair,platform:map.theme.platform,
  };
  return Object.fromEntries(SLOTS.map(slot=>{
    const recipe=map.surfaces?.[slot]??DEFAULTS[slot];
    return [slot,createPatternedMaterial(colors[slot],recipe)];
  })) as MapSurfaceMaterials;
}
/** World-space UVs keep the surface scale consistent across differently sized
 * map-region tiles (e.g., a 5m hall next to a 100m plaza). */
export function mapFloorUV(geometry:THREE.PlaneGeometry,centerX:number,centerZ:number,tileSize:number){
  const uv=geometry.getAttribute("uv"),pos=geometry.getAttribute("position");
  for(let i=0;i<uv.count;i++){
    uv.setXY(i,(centerX+pos.getX(i))/tileSize,(centerZ-pos.getY(i))/tileSize);
  }
  uv.needsUpdate=true;
}
/** Axis-aligned combat boxes share texture scale on roof/side faces. This is
 * visual UV work only; actual CoverBox collision remains unchanged. */
export function mapBoxUV(geometry:THREE.BoxGeometry,centerX:number,centerZ:number,tileSize:number){
  const uv=geometry.getAttribute("uv"),pos=geometry.getAttribute("position"),normal=geometry.getAttribute("normal");
  for(let i=0;i<uv.count;i++){
    const x=centerX+pos.getX(i),z=centerZ+pos.getZ(i),y=pos.getY(i);
    if(Math.abs(normal.getY(i))>.5)uv.setXY(i,x/tileSize,z/tileSize);
    else if(Math.abs(normal.getX(i))>.5)uv.setXY(i,z/tileSize,y/tileSize);
    else uv.setXY(i,x/tileSize,y/tileSize);
  }
  uv.needsUpdate=true;
}
