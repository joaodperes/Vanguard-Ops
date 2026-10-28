import { describe, test, expect } from "bun:test";
import * as THREE from "three";
import { createWeaponCharm, weaponCharmMountPoint, swingWeaponCharm } from "../src/lib/weapon-charms";
import { WEAPON_VISUALS } from "../src/lib/weapon-models";

describe("weapon charms remain visible on gun models",()=>{
  test("mounted on visible outside of each receiver, not hanging off-screen",()=>{
    for(const id of ["rifle_dm","rifle_ar","pistol_side","smg_vector","lmg_heavy"]){
      const half=WEAPON_VISUALS[id].receiver[0]/2;
      const [x,y,z]=weaponCharmMountPoint(id,"firstPerson");
      expect(x).toBeLessThan(-half);
      expect(y).toBeGreaterThan(0);
      expect(z).toBeLessThan(-.1);
      expect(weaponCharmMountPoint(id,"thirdPerson")[0]).toBeGreaterThan(half);
    }
  });
  test("Skull Token is lit, sizeable, and has visible skull features",()=>{
    const first=createWeaponCharm("charm_skull",true)!;
    const world=createWeaponCharm("charm_skull")!;
    expect(first.name).toBe("weapon_charm");
    expect(first.scale.x).toBeGreaterThan(1);
    const pendant=first.getObjectByName("weapon_charm_pendant")!;
    expect(pendant.children.length).toBeGreaterThan(5);
    expect(first.children.some(o=>o instanceof THREE.Mesh)).toBe(true);
    const materials:THREE.Material[]=[];
    first.traverse(o=>{if(o instanceof THREE.Mesh){materials.push(o.material as THREE.Material);expect(o.frustumCulled).toBe(false);}});
    expect(materials.some(m=>m instanceof THREE.MeshBasicMaterial)).toBe(true);
    const worldMaterials:THREE.Material[]=[];
    world.traverse(o=>{if(o instanceof THREE.Mesh)worldMaterials.push(o.material as THREE.Material);});
    expect(worldMaterials.some(m=>m instanceof THREE.MeshStandardMaterial)).toBe(true);
    const initial=pendant.rotation.z;
    swingWeaponCharm(first,900);
    expect(pendant.rotation.z).not.toBe(initial);
  });
  test("unknown or empty charms render no object",()=>{
    expect(createWeaponCharm("none")).toBeNull();
    expect(createWeaponCharm("unknown_id")).toBeNull();
  });
});
