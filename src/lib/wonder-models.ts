import * as THREE from "three";
import type {Vec3} from "./game-protocol";
export interface WonderWorldVisual {group:THREE.Group;dispose:()=>void;}
export function wonderMechModel():WonderWorldVisual{
 const group=new THREE.Group();
 const armor=new THREE.MeshStandardMaterial({color:0x344758,metalness:.72,roughness:.3});
 const shadow=new THREE.MeshStandardMaterial({color:0x111e2e,metalness:.52,roughness:.32});
 const glow=new THREE.MeshStandardMaterial({color:0x42bfee,metalness:.42,emissive:0x137dd1,emissiveIntensity:.55});
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
 const group=new THREE.Group();
 const glow=new THREE.MeshBasicMaterial({color:0x5ac9ef,transparent:true,opacity:.37,depthWrite:false});
 const head=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),glow);head.position.y=1.7;group.add(head);
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.35,.39,.82,8),glow);torso.position.y=1.1;group.add(torso);
 for(const s of [-1,1]){
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.13,.12,.84,6),glow);
  arm.position.set(s*.49,1.13,0);group.add(arm);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.14,.12,.85,6),glow);
  leg.position.set(s*.19,.44,0);group.add(leg);
 }
 return {group,dispose:()=>{group.removeFromParent();
  group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  glow.dispose();}};
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
