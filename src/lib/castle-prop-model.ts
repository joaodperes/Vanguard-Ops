/** Distinct low-poly medieval services; physics is owned by castle-scenery.ts. */
import * as THREE from "three";
import type {CastleProp} from "./castle-scenery";
import {buildCastleInterior} from "./castle-interiors";
const m=(n:number,metalness=0)=>new THREE.MeshStandardMaterial({color:n,roughness:.88,metalness});
const oak=m(0x987147),beam=m(0x63472f),stone=m(0x827466),iron=m(0x454545,.55),
  slate=m(0x4b4141),thatch=m(0x927a4b),cloth=m(0x9b5340),linen=m(0xbbad91),
  hay=m(0xb5a060),char=m(0x272522),fire=new THREE.MeshBasicMaterial({color:0xf18b3c});
const cube=(g:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);b.position.set(x,y,z);
  b.castShadow=h>.6;b.receiveShadow=true;g.add(b);return b;
};
const cyl=(g:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,r:number,h:number)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),mat);
  mesh.position.set(x,y,z);mesh.castShadow=true;g.add(mesh);return mesh;
};
export function buildCastleScenery(g:THREE.Group,p:CastleProp):void {
  const q=((p.turns??0)%4+4)%4,w=q%2?p.d??10:p.w??10,d=q%2?p.w??10:p.d??10;
  const h=p.h??4.5;
  if(p.kind==="castle_building"){
    const use=p.castleUse??"barracks";
    const roof=use==="stables"||use==="granary"?thatch:use==="infirmary"?stone:slate;
    // Map cover already draws all solid masonry, roof slab and furniture.
    // These timber beams and pitched roof only dress that collision geometry.
    for(const x of [-w/2+.2,w/2-.2]){
      cube(g,beam,x,h*.47,0,.22,h*.91,d-.85);
      for(const z of [-d*.32,d*.32])cube(g,oak,x,h*.73,z,.26,.23,.3);
    }
    for(const z of [-d/2+.14,d/2-.14])cube(g,beam,0,h*.87,z,w-.55,.20,.22);
    const incline=Math.atan2(1.2,w/2);
    for(const s of [-1,1]){
      const tile=cube(g,roof,s*w*.24,h+.73,0,w/2+.65,.28,d+.84);
      tile.rotation.z=-s*incline;
    }
    cube(g,oak,0,h+1.35,0,.25,.22,d+.80);
    const door=Math.min(3.6,w*.39);
    // Closed timber shutters on the front wall: believable windows, but no
    // misleading shoot-through opening in the server-authoritative masonry.
    for(const s of [-1,1]){
      const wx=s*w*.34,wy=h*.59,zw=d/2+.50;
      const shutterW=Math.min(1.45,w*.15);
      cube(g,darkWood,wx,wy,zw,shutterW,h*.22,.13);
      for(const u of [-1,0,1])cube(g,oak,wx+u*shutterW*.27,wy,zw+.09,.11,h*.20,.08);
      for(const yy of [-h*.08,h*.08])
        cube(g,iron,wx,wy+yy,zw+.14,shutterW*.82,.07,.035);
    }
    for(const s of [-1,1])cube(g,beam,s*(door/2+.2),1.35,d/2+.43,.22,2.6,.22);
    cube(g,oak,0,2.79,d/2+.44,door+.45,.18,.25);
    if(use==="smithy"||use==="kitchens"){
      cube(g,stone,-w*.30,h+.78,-d*.28,1.0,1.85,.96);
      cube(g,char,-w*.30,h+1.71,-d*.28,.87,.13,.85);
    }
    if(use==="stables"){
      cube(g,oak,0,1.22,d/2+.45,w*.65,.23,.2);
      cube(g,hay,0,1.46,d/2+.45,w*.55,.20,.18);
    }
    // Purpose-specific furnishings and wall dressing; no building-name signs.
    buildCastleInterior(g,p);
  }else if(p.kind==="castle_well"){
    const r=Math.min(w,d)*.44,t=.72;
    for(const s of [-1,1]){
      cube(g,stone,0,.625,s*r,r*2,1.25,t);
      cube(g,stone,s*r,.625,0,t,1.25,2*(r-.36));
      cube(g,beam,s*r,2.49,0,.21,2.45,.22);
    }
    cube(g,oak,0,3.62,0,r*2+.25,.20,.23);
    cube(g,iron,0,3.02,0,.11,.95,.11);
    cyl(g,oak,0,2.38,0,.32,.6);
    cube(g,slate,0,.35,0,r*1.2,.08,r*1.2);
  }else if(p.kind==="castle_stall"){
    for(const sx of [-1,1])for(const sz of [-1,1])
      cube(g,beam,sx*(w/2-.22),h/2,sz*(d/2-.22),.35,h,.35);
    cube(g,oak,0,.64,-d*.24,w*.84,1.28,d*.26);
    const awning=p.color?new THREE.MeshStandardMaterial({color:p.color,roughness:1}):cloth;
    cube(g,awning,0,h+.28,0,w+.25,.16,d+.24);
    for(const x of [-w*.3,0,w*.3])cube(g,linen,x,h+.38,0,.13,.03,d+.2);
    cube(g,hay,0,1.29,-d*.24,w*.52,.13,d*.18);
  }else if(p.kind==="castle_cart"){
    cube(g,beam,0,.69,0,w*.87,1.28,d*.77);
    cube(g,hay,0,1.37,0,w*.67,.19,d*.61);
    for(const x of [-w*.32,w*.32])for(const z of [-d*.26,d*.26]){
      const wheel=cyl(g,iron,x,.42,z,.42,.14);wheel.rotation.z=Math.PI/2;
    }
    cube(g,oak,0,.65,d*.42,.22,.18,d*.25);
  }else if(p.kind==="castle_target"){
    cube(g,oak,0,h*.51,0,w*.79,h*.91,.3);
    for(const [r,z,material] of [[w*.38,.19,linen],[w*.22,.28,cloth],[w*.085,.38,char]] as const){
      const face=cyl(g,material,0,h*.64,z,r,.12);face.rotation.x=Math.PI/2;
    }
  }else if(p.kind==="castle_barrel"){
    cyl(g,oak,0,h/2,0,Math.min(w,d)*.42,h);
    for(const at of [.17,.82])cyl(g,iron,0,h*at,0,Math.min(w,d)*.44,.1);
  }else if(p.kind==="castle_brazier"){
    cube(g,stone,0,.32,0,w*.75,.62,d*.75);
    cyl(g,iron,0,1.06,0,w*.36,.43);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(w*.2,.8,7),fire);
    flame.position.y=1.63;g.add(flame);
  }
}
