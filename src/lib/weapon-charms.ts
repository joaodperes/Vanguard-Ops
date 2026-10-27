import * as THREE from "three";
import { cosmeticById } from "./cosmetics";
import { WEAPON_VISUALS } from "./weapon-models";

/** The old fixed mount (.16,-.105,-.14) pushed dangling charms below the
 * visible first-person camera frustum on several weapons. Anchor each charm
 * just outside the receiver side and high enough for its pendant to hang in
 * view without covering the sight or barrel. */
export function weaponCharmMountPoint(weaponId:string,view:"firstPerson"|"thirdPerson"):[number,number,number]{
  const width=WEAPON_VISUALS[weaponId]?.receiver[0]??.13;
  const edge=Math.max(.115,width/2+.045);
  return [view==="firstPerson"?-edge:edge,.065,-.22];
}

/** Tiny 3D hanging ornaments. No colliders or impact on aiming/stats. */
export function createWeaponCharm(id:string,firstPerson=false):THREE.Group|null{
  const cosmetic=cosmeticById(id,"charm");
  if(!cosmetic||id==="none")return null;
  const root=new THREE.Group();root.name="weapon_charm";
  if(firstPerson)root.scale.setScalar(1.22);
  // Viewmodel materials must be unlit, matching the gun's MeshBasicMaterial.
  // Standard materials on the camera's pendant were almost black in dark maps.
  const silver=firstPerson
    ?new THREE.MeshBasicMaterial({color:0xb9c8d5})
    :new THREE.MeshStandardMaterial({color:0xb9c8d5,metalness:.5,roughness:.38});
  const main=firstPerson
    ?new THREE.MeshBasicMaterial({color:cosmetic.color})
    :new THREE.MeshStandardMaterial({color:cosmetic.color,metalness:.4,roughness:.34,
      emissive:new THREE.Color(cosmetic.color),emissiveIntensity:.16});
  const cap=new THREE.Mesh(new THREE.TorusGeometry(.028,.008,7,12),silver);
  cap.position.y=-.020;root.add(cap);
  const link=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.065,6),silver);
  link.position.y=-.064;root.add(link);
  const pendant=new THREE.Group();pendant.name="weapon_charm_pendant";
  pendant.position.y=-.105;root.add(pendant);
  const geometry=id==="charm_tag"?new THREE.BoxGeometry(.072,.098,.018):
    id==="charm_skull"?new THREE.DodecahedronGeometry(.052,0):
    id==="charm_reactor"?new THREE.CylinderGeometry(.047,.047,.031,6):
    new THREE.IcosahedronGeometry(.049,1);
  const core=new THREE.Mesh(geometry,main);
  core.position.y=-.042;
  if(id==="charm_reactor")core.rotation.x=Math.PI/2;
  pendant.add(core);
  if(id==="charm_skull"){
    // Jaw, dark sockets and teeth make the token visibly a skull, rather than
    // the original small featureless metallic dodecahedron.
    const black=new THREE.MeshBasicMaterial({color:0x161820});
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(.058,.027,.038),main);
    jaw.position.set(0,-.079,.016);pendant.add(jaw);
    for(const x of [-.020,.020]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.011,8,7),black);
      eye.position.set(x,-.034,.049);pendant.add(eye);
    }
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.007,.015,3),black);
    nose.position.set(0,-.055,.052);nose.rotation.z=Math.PI;pendant.add(nose);
    for(const x of [-.020,-.007,.007,.020]){
      const tooth=new THREE.Mesh(new THREE.BoxGeometry(.009,.013,.004),silver);
      tooth.position.set(x,-.088,.037);pendant.add(tooth);
    }
  }
  if(id==="charm_tag"){
    const line=new THREE.Mesh(new THREE.BoxGeometry(.052,.008,.020),silver);
    line.position.set(0,-.064,.005);pendant.add(line);
  }
  if(id==="charm_reactor"){
    const center=new THREE.Mesh(new THREE.SphereGeometry(.021,10,8),new THREE.MeshBasicMaterial({color:0x9ff6ff}));
    center.position.y=-.042;pendant.add(center);
  }
  // A camera-attached group should not disappear due to a child bounding box
  // being culled before animation settles.
  root.traverse(child=>{child.frustumCulled=false;});
  return root;
}

/** Pendant-only pendulum sway; fixed mount remains attached to the receiver. */
export function swingWeaponCharm(charm:THREE.Object3D,now:number){
  const pendant=charm.getObjectByName("weapon_charm_pendant");
  if(pendant){pendant.rotation.z=Math.sin(now*.004)*.16;pendant.rotation.x=Math.cos(now*.003)*.09;}
}
