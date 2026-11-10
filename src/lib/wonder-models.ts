import * as THREE from "three";
import type {Vec3} from "./game-protocol";
export interface WonderWorldVisual {group:THREE.Group;dispose:()=>void;}
/** Shared Juggernaut chassis palette for the deployable suit and Survival bosses. */
export const JUGGERNAUT_VISUAL_PALETTE = {
 armor: 0x344758,
 shadow: 0x111e2e,
 visor: 0x42bfee,
} as const;
export function wonderMechModel():WonderWorldVisual{
 const group=new THREE.Group();
 const armor=new THREE.MeshStandardMaterial({color:JUGGERNAUT_VISUAL_PALETTE.armor,metalness:.72,roughness:.3});
 const shadow=new THREE.MeshStandardMaterial({color:JUGGERNAUT_VISUAL_PALETTE.shadow,metalness:.52,roughness:.32});
 const glow=new THREE.MeshStandardMaterial({color:JUGGERNAUT_VISUAL_PALETTE.visor,metalness:.42,emissive:0x137dd1,emissiveIntensity:.55});
 const block=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;};
 block(1.8,1.8,1.1,0,2,0,armor);
 block(1.6,.62,.8,0,1.15,0,shadow);
 block(.6,.67,.66,0,3.28,0,shadow);
 block(.9,.18,.13,0,3.37,-.35,glow);
 for(const sign of [-1,1]){
  block(.63,1.15,.75,sign*.6,.43,0,armor);
  block(.78,.42,.9,sign*.6,.16,-.16,shadow);
  block(.7,.8,.82,sign*1.21,2.28,0,armor);
  block(.34,1.0,.42,sign*1.32,1.45,-.22,shadow);
 }
 // Forward-facing rotary cannon and underslung scattergun are visually distinct.
 const tube=new THREE.Mesh(new THREE.CylinderGeometry(.18,.21,1.8,12),shadow);
 tube.rotation.x=Math.PI/2;tube.position.set(-1.32,1.52,-1.15);group.add(tube);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3;
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1.55,8),armor);
  barrel.rotation.x=Math.PI/2;barrel.position.set(-1.32+Math.cos(a)*.15,1.5+Math.sin(a)*.15,-1.43);
  group.add(barrel);
 }
 const shotgun=new THREE.Mesh(new THREE.CylinderGeometry(.17,.19,1.25,10),armor);
 shotgun.rotation.x=Math.PI/2;shotgun.position.set(1.34,1.4,-.99);group.add(shotgun);
 const shoulder=new THREE.Mesh(new THREE.BoxGeometry(2.8,.22,.88),glow);
 shoulder.position.set(0,2.55,0);group.add(shoulder);
 group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 return {group,dispose:()=>{group.removeFromParent();
  group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  [armor,shadow,glow].forEach(m=>m.dispose());}};
}
export function wonderAircraftModel():WonderWorldVisual{
 const group=new THREE.Group();
 const steel=new THREE.MeshStandardMaterial({color:0x303c51,metalness:.66,roughness:.38});
 const light=new THREE.MeshBasicMaterial({color:0xf8a455});
 const fuselage=new THREE.Mesh(new THREE.CapsuleGeometry(.64,3.2,6,12),steel);
 fuselage.rotation.x=Math.PI/2;group.add(fuselage);
 const wing=new THREE.Mesh(new THREE.BoxGeometry(9.2,.16,1.24),steel);wing.position.z=.25;group.add(wing);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(3.3,.17,.6),steel);tail.position.z=2;group.add(tail);
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),light);lamp.position.set(0,.2,-1.8);group.add(lamp);
 return {group,dispose:()=>{group.removeFromParent();
  group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});steel.dispose();light.dispose();}};
}
export function wonderHologramModel():WonderWorldVisual{
 // Decoys need to pass for actual armed players at combat distance. Solid opaque
 // uniform, body armour, helmet, hands and a rifle—not a transparent ghost.
 const group=new THREE.Group();
 const uniform=new THREE.MeshStandardMaterial({color:0x455563,roughness:.88});
 const armor=new THREE.MeshStandardMaterial({color:0x25323d,roughness:.75,metalness:.16});
 const skin=new THREE.MeshStandardMaterial({color:0x987c6a,roughness:1});
 const weapon=new THREE.MeshStandardMaterial({color:0x1c252c,metalness:.45,roughness:.45});
 const strap=new THREE.MeshStandardMaterial({color:0x697c85,roughness:.8});
 const cube=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);
   mesh.castShadow=true;group.add(mesh);return mesh;
 };
 cube(.50,.68,.30,0,1.30,0,uniform);
 cube(.58,.44,.38,0,1.34,-.01,armor);
 cube(.57,.09,.39,0,1.59,.01,strap);
 cube(.53,.16,.36,0,.96,.02,armor);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.205,12,10),skin);head.position.set(0,1.82,-.015);head.castShadow=true;group.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.225,12,8,0,Math.PI*2,0,Math.PI*.52),armor);
 helmet.position.set(0,1.88,-.015);group.add(helmet);
 cube(.44,.085,.29,0,1.91,-.03,armor);
 for(const side of [-1,1]){
   cube(.20,.52,.22,side*.36,1.32,-.11,uniform);
   cube(.22,.16,.26,side*.36,1.49,-.12,armor);
   cube(.14,.17,.15,side*.33,1.09,-.28,skin);
   cube(.20,.66,.24,side*.16,.58,0,uniform);
   cube(.22,.18,.27,side*.16,.53,-.08,armor);
   cube(.25,.15,.34,side*.16,.15,-.07,weapon);
 }
 // Rifle points forward (-Z) and is held at natural shoulder height.
 cube(.14,.13,.65,0,1.17,-.39,weapon);
 cube(.11,.10,.25,0,1.16,-.85,armor);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.51,10),weapon);
 barrel.rotation.x=Math.PI/2;barrel.position.set(0,1.18,-.99);group.add(barrel);
 cube(.09,.24,.10,0,.99,-.35,weapon);
 cube(.13,.035,.22,0,1.25,-.49,strap);
 const flash=new THREE.Mesh(new THREE.ConeGeometry(.105,.26,7),
   new THREE.MeshBasicMaterial({color:0xffd285,transparent:true,opacity:.86,depthWrite:false}));
 flash.name="phantom_muzzle_flash";flash.rotation.x=-Math.PI/2;
 flash.position.set(0,1.18,-1.31);flash.visible=false;group.add(flash);
 return {group,dispose:()=>{group.removeFromParent();
   group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
   [uniform,armor,skin,weapon,strap,flash.material as THREE.Material].forEach(m=>m.dispose());}};
}
/** A compact, unmistakably airborne Harbinger scout—not a second ground turret. */
export function wonderDroneModel():WonderWorldVisual{
 const group=new THREE.Group();
 const shell=new THREE.MeshStandardMaterial({color:0x344754,metalness:.66,roughness:.34});
 const dark=new THREE.MeshStandardMaterial({color:0x141d29,metalness:.52,roughness:.42});
 const sensor=new THREE.MeshStandardMaterial({color:0x4de1c4,emissive:0x13b892,emissiveIntensity:.75,metalness:.25,roughness:.3});
 const rotorMat=new THREE.MeshStandardMaterial({color:0x859da4,metalness:.64,roughness:.4,side:THREE.DoubleSide});
 const add=(geo:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);group.add(mesh);mesh.castShadow=true;return mesh;
 };
 // Main fuselage with distinctive octagonal sensor dome and forward camera.
 add(new THREE.CylinderGeometry(.30,.27,.22,8),shell).rotation.x=Math.PI/2;
 add(new THREE.SphereGeometry(.18,12,8),sensor,0,.02,-.26);
 add(new THREE.CylinderGeometry(.08,.11,.16,10),dark,0,-.15,-.15).rotation.x=Math.PI/2;
 const muzzle=add(new THREE.CylinderGeometry(.036,.05,.23,8),dark,0,-.18,-.35);
 muzzle.rotation.x=Math.PI/2;
 // Four exposed ducted rotors make the silhouette distinct from Bullet Spitter.
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=sx*.47,z=sz*.40;
  const arm=add(new THREE.BoxGeometry(.40,.055,.06),shell,sx*.29,-.015,z);
  arm.rotation.y=-sz*sx*.18;
  const duct=add(new THREE.TorusGeometry(.17,.038,8,18),dark,x,.02,z);
  duct.rotation.x=-Math.PI/2;
  const blades=add(new THREE.BoxGeometry(.31,.015,.045),rotorMat,x,.035,z);
  blades.name="harbinger_rotor";
  add(new THREE.SphereGeometry(.052,8,6),sensor,x,.045,z);
 }
 // Navigation light and downward-facing scan cone.
 add(new THREE.BoxGeometry(.13,.04,.09),sensor,0,.16,.10);
 const ring=add(new THREE.TorusGeometry(.21,.012,7,32),sensor,0,-.20,0);
 ring.rotation.x=Math.PI/2;
 return {group,dispose:()=>{
  group.removeFromParent();
  group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  [shell,dark,sensor,rotorMat].forEach(m=>m.dispose());
 }};
}
export function wonderEventParticles(scene:THREE.Scene,pos:Vec3,color:number,n=16):void{
 const geometry=new THREE.SphereGeometry(.035,6,5);
 const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9});
 const group=new THREE.Group();
 for(let i=0;i<n;i++){
  const mesh=new THREE.Mesh(geometry,material);
  const angle=i*2.39996,amount=.35+Math.random()*1.2;
  mesh.position.set(Math.sin(angle)*amount,Math.random()*1.5,Math.cos(angle)*amount);
  mesh.scale.setScalar(1+Math.random()*2);
  group.add(mesh);
 }
 group.position.set(...pos);scene.add(group);
 // Callers are responsible for removing/disposal after a short lifetime.
}
