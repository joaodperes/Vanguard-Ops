import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {WEAPONS} from "../src/lib/game-data";
import {WEAPON_VISUALS,buildFirstPersonWeapon} from "../src/lib/weapon-models";
import {adsClearance} from "../src/lib/viewmodel-clearance";

/** Geometric regression: shoot a camera-centred ray through the actual
 * procedural weapon mesh placed in its stable ADS pose. An iron-sight gun
 * body must not physically obscure the crosshair, regardless of category.
 */
describe("rendered ADS geometry avoids eye-level sight occlusion",()=>{
 test("all default-iron gun bodies clear the camera ray including Hydra and Reclaimer",()=>{
  const scale=1.20;
  const candidates=WEAPONS.filter(w=>!w.disabled&&!w.wonder&&w.category!=="melee"&&
    (w.baseSightType??"iron")==="iron");
  expect(candidates.length).toBeGreaterThan(25);
  for(const weapon of candidates){
    const material=new THREE.MeshBasicMaterial({color:0x556677});
    const group=new THREE.Group();
    const clearance=adsClearance(weapon,"iron",WEAPON_VISUALS[weapon.id]?.receiver?.[1]);
    buildFirstPersonWeapon(weapon.id,material,material,(part,x,y,z)=>{
      part.position.set(x*scale,y*scale+clearance.bodyY,z*scale-.38);
      part.scale.multiplyScalar(scale);
      group.add(part);
    });
    group.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1),.01,5);
    const intersections=ray.intersectObject(group,true);
    expect(intersections.length,
      `${weapon.id}: body intersects ADS crosshair at ${intersections[0]?.distance}`).toBe(0);
    group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    material.dispose();
  }
 });
});
