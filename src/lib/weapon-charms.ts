import * as THREE from "three";
import {cosmeticById} from "./cosmetics";
/** Actual lightweight 3D hanging ornaments. Cosmetic only: no colliders, no
 * ballistic modifications, and never allowed to cover a scope or muzzle. */
export function createWeaponCharm(id:string):THREE.Group|null{
  const cosmetic=cosmeticById(id,"charm");
  if(!cosmetic||id==="none")return null;
  const root=new THREE.Group();root.name="weapon_charm";
  const silver=new THREE.MeshStandardMaterial({color:0x8a9aaa,metalness:.85,roughness:.24});
  const main=new THREE.MeshStandardMaterial({color:cosmetic.color,metalness:.65,roughness:.27,
    emissive:id==="charm_orb"||id==="charm_reactor"?cosmetic.color:"#000000",
    emissiveIntensity:id==="charm_orb"||id==="charm_reactor"?.35:0});
  const cap=new THREE.Mesh(new THREE.TorusGeometry(.025,.006,6,12),silver);
  cap.position.y=-.025;root.add(cap);
  const link=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.07,6),silver);
  link.position.y=-.074;root.add(link);
  const pendant=new THREE.Group();pendant.name="weapon_charm_pendant";
  pendant.position.y=-.109;root.add(pendant);
  const shape=id==="charm_tag"?new THREE.BoxGeometry(.062,.082,.014):
    id==="charm_skull"?new THREE.DodecahedronGeometry(.042,0):
    id==="charm_reactor"?new THREE.CylinderGeometry(.043,.043,.025,6):
    new THREE.IcosahedronGeometry(.046,1);
  const core=new THREE.Mesh(shape,main);
  core.position.y=-.046;
  if(id==="charm_reactor")core.rotation.x=Math.PI/2;
  pendant.add(core);
  if(id==="charm_skull"){
    for(const x of [-.018,.018]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.006,6,6),silver);
      eye.position.set(x,-.04,.036);pendant.add(eye);
    }
  }
  if(id==="charm_tag"){
    const line=new THREE.Mesh(new THREE.BoxGeometry(.039,.008,.018),silver);
    line.position.set(0,-.06,.005);pendant.add(line);
  }
  if(id==="charm_reactor"){
    const center=new THREE.Mesh(new THREE.SphereGeometry(.019,8,8),new THREE.MeshBasicMaterial({color:0x9ff6ff}));
    center.position.y=-.046;pendant.add(center);
  }
  return root;
}
/** Pendant-only pendulum sway; fixed mounting ring remains attached to gun. */
export function swingWeaponCharm(charm:THREE.Object3D,now:number){
  const pendant=charm.getObjectByName("weapon_charm_pendant");
  if(pendant){pendant.rotation.z=Math.sin(now*.004)*.16;pendant.rotation.x=Math.cos(now*.003)*.09;}
}
