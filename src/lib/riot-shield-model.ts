import * as THREE from "three";
import { shieldPanel } from "./riot-shield";
/** A bulletproof viewport remains transparent; it has exactly the same collision as the plate. */
export function createRiotShieldModel(unlit=false): THREE.Group {
  const root=new THREE.Group();
  const plate=unlit?new THREE.MeshBasicMaterial({color:0x344655}):new THREE.MeshStandardMaterial({color:0x344655,metalness:.7,roughness:.4});
  const trim=unlit?new THREE.MeshBasicMaterial({color:0xb69d5c}):new THREE.MeshStandardMaterial({color:0xb69d5c,metalness:.6,roughness:.35});
  const glass=new THREE.MeshStandardMaterial({color:0xb5e5ee,transparent:true,opacity:.16,metalness:.1,roughness:.15,side:THREE.DoubleSide,depthWrite:false});
  const box=(x:number,y:number,w:number,h:number,mat:THREE.Material)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.065),mat);m.position.set(x,y,0);root.add(m);
  };
  // Normalized to the raised collision rectangle. Hip pose scales to its dimensions.
  const p=shieldPanel(true), w=p.width,h=p.height;
  box(0,-.30,w,h-.60,plate);
  box(0,.95,w,.22,plate);
  box(-w/2+.06,.65,.12,.60,plate);box(w/2-.06,.65,.12,.60,plate);
  box(0,.64,w-.24,.39,glass);
  box(0,.36,w,.045,trim);box(0,-.70,w*.6,.06,trim);
  for(const x of [-.52,.52])box(x,-.22,.045,.46,trim);
  return root;
}
